from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.utils.hashing import compute_sha256


def test_pdf_reports_generation():
    with TestClient(app) as client:
        # 1. Login
        res = client.post("/api/auth/login", json={"badge_id": "MP-IO-4471", "password": "demo1234"})
        assert res.status_code == 200
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create a Case
        case_res = client.post(
            "/api/cases",
            headers=headers,
            json={
                "victim_name": "Kavita Rao",
                "scam_type": "digital_scam",
                "district": "Bhopal",
            },
        )
        assert case_res.status_code == 201
        case_id = case_res.json()["id"]

        # 3. Upload Bank evidence
        with open(Path("data/sample/mock_bank_upi.xlsx"), "rb") as f:
            client.post(
                f"/api/cases/{case_id}/evidence",
                headers=headers,
                data={"evidence_category": "bank_upi"},
                files={"file": ("mock_bank_upi.xlsx", f, "application/octet-stream")},
            )

        # Upload Email evidence (contains known malicious URLs)
        with open(Path("data/sample/mock_email.eml"), "rb") as f:
            client.post(
                f"/api/cases/{case_id}/evidence",
                headers=headers,
                data={"evidence_category": "other"},
                files={"file": ("mock_email.eml", f, "message/rfc822")},
            )

        # 4. Correlate case
        client.post(f"/api/cases/{case_id}/correlate", headers=headers)

        # 5. Generate Investigative Brief PDF
        brief_res = client.post(f"/api/cases/{case_id}/reports/investigative-brief", headers=headers)
        assert brief_res.status_code == 200
        assert brief_res.headers["content-type"] == "application/pdf"
        assert "investigative_brief" in brief_res.headers["content-disposition"]
        brief_hash = brief_res.headers.get("x-document-sha256")
        assert brief_hash is not None and len(brief_hash) == 64
        # Verify content integrity
        assert compute_sha256(brief_res.content) == brief_hash
        assert len(brief_res.content) > 1000

        # Check file was saved under backend/uploads/{case_id}/reports/
        clean_num = case_res.json()["case_number"].replace("#", "").strip()
        expected_brief_path = Path(f"uploads/{case_id}/reports/investigative_brief_{clean_num}.pdf")
        assert expected_brief_path.exists(), f"Brief file not found on disk at {expected_brief_path}"

        # 6. Generate Takedown Request PDF
        takedown_res = client.post(f"/api/cases/{case_id}/reports/takedown-request", headers=headers)
        assert takedown_res.status_code == 200
        assert takedown_res.headers["content-type"] == "application/pdf"
        assert "takedown_request" in takedown_res.headers["content-disposition"]
        takedown_hash = takedown_res.headers.get("x-document-sha256")
        assert takedown_hash is not None and len(takedown_hash) == 64
        assert compute_sha256(takedown_res.content) == takedown_hash
        assert len(takedown_res.content) > 1000

        # Check matched threat indicators
        matched_count = int(takedown_res.headers.get("x-matched-count", "0"))
        assert matched_count > 0, "Expected at least 1 matched threat indicator from mock email URLs"

        expected_takedown_path = Path(f"uploads/{case_id}/reports/takedown_request_{clean_num}.pdf")
        assert expected_takedown_path.exists(), f"Takedown file not found on disk at {expected_takedown_path}"
