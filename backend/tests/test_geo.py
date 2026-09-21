from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.services.geo.heatmap import load_ifsc_lookup, load_pin_lookup, resolve_district, get_district_heatmap
from app.db.database import SessionLocal
from app.db.models import Case


def test_lookup_loading():
    ifsc_data = load_ifsc_lookup()
    assert len(ifsc_data) >= 15
    # Check SBIN0004 maps to Bhopal
    sbin_entry = next((item for item in ifsc_data if item[0] == "SBIN0004"), None)
    assert sbin_entry is not None
    assert sbin_entry[1] == "Bhopal"

    pin_data = load_pin_lookup()
    assert len(pin_data) >= 15
    assert pin_data["462"] == "Bhopal"
    assert pin_data["452"] == "Indore"


def test_resolve_district_and_heatmap_api():
    with TestClient(app) as client:
        # Auth login
        res = client.post("/api/auth/login", json={"badge_id": "MP-IO-4471", "password": "demo1234"})
        assert res.status_code == 200
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create a case without district
        case_res = client.post(
            "/api/cases",
            headers=headers,
            json={
                "victim_name": "R. K. Verma",
                "scam_type": "digital_scam",
                "district": None,
            },
        )
        assert case_res.status_code == 201
        case_id = case_res.json()["id"]

        # 2. Upload Bank evidence with SBIN0004412
        with open(Path("data/sample/mock_bank_upi.xlsx"), "rb") as f:
            ev_res = client.post(
                f"/api/cases/{case_id}/evidence",
                headers=headers,
                data={"evidence_category": "bank_upi"},
                files={"file": ("mock_bank_upi.xlsx", f, "application/octet-stream")},
            )
            assert ev_res.status_code == 201

        # 3. Check that case district was automatically resolved to Bhopal
        case_detail = client.get(f"/api/cases/{case_id}", headers=headers).json()
        assert case_detail["district"] == "Bhopal", f"Expected Bhopal, got {case_detail['district']}"

        # 4. Create another case with a PIN code in district field
        case2_res = client.post(
            "/api/cases",
            headers=headers,
            json={
                "victim_name": "Meena Saxena",
                "scam_type": "phishing_vishing",
                "district": "PIN 452001 (Indore Area)",
            },
        )
        case2_id = case2_res.json()["id"]

        # Directly resolve district
        db = SessionLocal()
        try:
            resolved = resolve_district(case2_id, db)
            assert resolved == "Indore"
        finally:
            db.close()

        # 5. Test GET /api/geo/heatmap
        heatmap_res = client.get("/api/geo/heatmap", headers=headers)
        assert heatmap_res.status_code == 200
        heatmap = heatmap_res.json()
        assert len(heatmap) >= 1
        districts = [item["district"] for item in heatmap]
        assert "Bhopal" in districts
        for item in heatmap:
            assert "district" in item
            assert "case_count" in item
            assert "level" in item
            assert item["level"] in ["low", "medium", "high"]
