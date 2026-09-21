from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app


def test_ai_case_summary_workflow():
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
                "victim_name": "Rajiv Nambiar",
                "scam_type": "digital_scam",
                "district": "Bhopal",
            },
        )
        assert case_res.status_code == 201
        case_id = case_res.json()["id"]

        # 2. Upload Bank and Email evidence
        with open(Path("data/sample/mock_bank_upi.xlsx"), "rb") as f:
            client.post(
                f"/api/cases/{case_id}/evidence",
                headers=headers,
                data={"evidence_category": "bank_upi"},
                files={"file": ("mock_bank_upi.xlsx", f, "application/octet-stream")},
            )

        with open(Path("data/sample/mock_email.eml"), "rb") as f:
            client.post(
                f"/api/cases/{case_id}/evidence",
                headers=headers,
                data={"evidence_category": "other"},
                files={"file": ("mock_email.eml", f, "message/rfc822")},
            )

        # 3. Trigger correlation
        client.post(f"/api/cases/{case_id}/correlate", headers=headers)

        # 4. Fetch summary via GET /api/cases/{case_id}/summary
        # (Since none exists yet, it should automatically generate one)
        sum_res = client.get(f"/api/cases/{case_id}/summary", headers=headers)
        assert sum_res.status_code == 200
        summary_data = sum_res.json()
        assert "narrative_text" in summary_data
        narrative = summary_data["narrative_text"]

        # Verify narrative content
        assert "Rajiv Nambiar" in narrative
        assert len(narrative) > 100
        paragraphs = [p for p in narrative.split("\n\n") if p.strip()]
        assert len(paragraphs) >= 2, f"Expected at least 2 paragraphs, got {len(paragraphs)}"

        # Verify key entities and action directives are highlighted
        assert "fraudster.mule99@ybl" in narrative or "UPI" in narrative or "mule" in narrative
        assert "Section 91" in narrative or "freez" in narrative.lower() or "requisition" in narrative.lower()

        # 5. Fetch again - should return the cached summary
        cached_res = client.get(f"/api/cases/{case_id}/summary", headers=headers)
        assert cached_res.status_code == 200
        assert cached_res.json()["id"] == summary_data["id"]

        # 6. Test POST /summary/regenerate
        regen_res = client.post(f"/api/cases/{case_id}/summary/regenerate", headers=headers)
        assert regen_res.status_code == 200
        regen_data = regen_res.json()
        assert regen_data["id"] != summary_data["id"]
        assert len(regen_data["narrative_text"]) > 100
