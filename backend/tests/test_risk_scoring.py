from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.services.risk.scoring import load_profile, score_case
from app.db.database import SessionLocal
from app.db.models import Case, RiskLevel


def test_profile_loading():
    p_digital = load_profile("digital_scam")
    assert "multi_hop_speed" in p_digital
    assert "shared_upi_handle" in p_digital

    p_phishing = load_profile("phishing_vishing")
    assert "spoofed_caller_pattern" in p_phishing

    p_apk = load_profile("malicious_apk")
    assert "high_risk_permissions" in p_apk
    assert "known_c2_server" in p_apk


def test_case_scoring_and_why_flagged():
    with TestClient(app) as client:
        # Auth login
        res = client.post("/api/auth/login", json={"badge_id": "MP-IO-4471", "password": "demo1234"})
        assert res.status_code == 200
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create a Digital Scam case
        case_res = client.post(
            "/api/cases",
            headers=headers,
            json={
                "victim_name": "R. K. Verma",
                "scam_type": "digital_scam",
                "district": "Bhopal North",
            },
        )
        assert case_res.status_code == 201
        case_id = case_res.json()["id"]

        # 2. Upload Bank evidence (contains mule UPI and accounts)
        with open(Path("data/sample/mock_bank_upi.xlsx"), "rb") as f:
            client.post(
                f"/api/cases/{case_id}/evidence",
                headers=headers,
                data={"evidence_category": "bank_upi"},
                files={"file": ("mock_bank_upi.xlsx", f, "application/octet-stream")},
            )

        # Upload Email evidence (contains overlapping UPI handle)
        with open(Path("data/sample/mock_email.eml"), "rb") as f:
            client.post(
                f"/api/cases/{case_id}/evidence",
                headers=headers,
                data={"evidence_category": "other"},
                files={"file": ("mock_email.eml", f, "message/rfc822")},
            )

        # 3. Correlate (which automatically triggers score_case)
        corr_res = client.post(f"/api/cases/{case_id}/correlate", headers=headers)
        assert corr_res.status_code == 200

        # 4. Check case details
        case_detail = client.get(f"/api/cases/{case_id}", headers=headers).json()
        assert case_detail["risk_score"] is not None
        assert 0.0 <= case_detail["risk_score"] <= 100.0
        assert case_detail["risk_level"] in ["low", "medium", "high"]
        assert case_detail["why_flagged"] is not None
        assert len(case_detail["why_flagged"]) > 0

        # 5. Check cases queue
        cases_list = client.get("/api/cases", headers=headers).json()
        found_case = next(c for c in cases_list if c["id"] == case_id)
        assert found_case["why_flagged"] == case_detail["why_flagged"]
        assert found_case["risk_score"] == case_detail["risk_score"]


def test_malicious_apk_scoring():
    with TestClient(app) as client:
        res = client.post("/api/auth/login", json={"badge_id": "MP-IO-4471", "password": "demo1234"})
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create Malicious APK case
        case_res = client.post(
            "/api/cases",
            headers=headers,
            json={
                "victim_name": "Deepak Sen",
                "scam_type": "malicious_apk",
                "district": "Jabalpur",
            },
        )
        case_id = case_res.json()["id"]

        # Upload APK dump
        with open(Path("data/sample/mock_apk_dump.json"), "rb") as f:
            client.post(
                f"/api/cases/{case_id}/evidence",
                headers=headers,
                data={"evidence_category": "other"},
                files={"file": ("mock_apk_dump.json", f, "application/json")},
            )

        # Correlate and score
        client.post(f"/api/cases/{case_id}/correlate", headers=headers)

        case_detail = client.get(f"/api/cases/{case_id}", headers=headers).json()
        assert case_detail["risk_score"] >= 40.0
        assert case_detail["why_flagged"] is not None
        # High-risk permissions or C2 server should be highlighted in why_flagged
        assert any(
            keyword in case_detail["why_flagged"].lower()
            for keyword in ["permission", "c2", "command", "apk"]
        )
