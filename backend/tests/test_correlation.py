from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app


def test_correlation_engine_and_graph():
    with TestClient(app) as client:
        # Auth login
        res = client.post("/api/auth/login", json={"badge_id": "MP-IO-4471", "password": "demo1234"})
        assert res.status_code == 200
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create Case 1
        case1_res = client.post(
            "/api/cases",
            headers=headers,
            json={
                "victim_name": "Suresh Patel",
                "scam_type": "digital_scam",
                "district": "Bhopal Central",
            },
        )
        assert case1_res.status_code == 201
        case1_id = case1_res.json()["id"]
        case1_num = case1_res.json()["case_number"]

        # 2. Upload CDR evidence
        with open(Path("data/sample/mock_cdr.csv"), "rb") as f:
            r = client.post(
                f"/api/cases/{case1_id}/evidence",
                headers=headers,
                data={"evidence_category": "telecom"},
                files={"file": ("mock_cdr.csv", f, "text/csv")},
            )
            assert r.status_code == 201

        # Upload Bank evidence
        with open(Path("data/sample/mock_bank_upi.xlsx"), "rb") as f:
            r = client.post(
                f"/api/cases/{case1_id}/evidence",
                headers=headers,
                data={"evidence_category": "bank_upi"},
                files={"file": ("mock_bank_upi.xlsx", f, "application/octet-stream")},
            )
            assert r.status_code == 201

        # Upload Email evidence
        with open(Path("data/sample/mock_email.eml"), "rb") as f:
            r = client.post(
                f"/api/cases/{case1_id}/evidence",
                headers=headers,
                data={"evidence_category": "other"},
                files={"file": ("mock_email.eml", f, "message/rfc822")},
            )
            assert r.status_code == 201

        # Upload APK dump evidence
        with open(Path("data/sample/mock_apk_dump.json"), "rb") as f:
            r = client.post(
                f"/api/cases/{case1_id}/evidence",
                headers=headers,
                data={"evidence_category": "other"},
                files={"file": ("mock_apk_dump.json", f, "application/json")},
            )
            assert r.status_code == 201

        # 3. Trigger correlation
        corr_res = client.post(f"/api/cases/{case1_id}/correlate", headers=headers)
        assert corr_res.status_code == 200
        corr_data = corr_res.json()

        assert "records_by_category" in corr_data
        assert corr_data["records_by_category"]["telecom"] > 0
        assert corr_data["records_by_category"]["bank_upi"] > 0
        assert corr_data["records_by_category"]["total"] > 0
        assert corr_data["links_count"] > 0

        graph = corr_data["graph"]
        assert "nodes" in graph
        assert "edges" in graph
        assert len(graph["nodes"]) > 0
        assert len(graph["edges"]) > 0

        # Verify edge bases
        bases = {e["basis"] for e in graph["edges"]}
        assert "shared_upi_handle" in bases, f"Expected shared_upi_handle in {bases}"
        assert "shared_imei" in bases, f"Expected shared_imei in {bases}"

        # Verify source_evidence_ids populated on edges
        for e in graph["edges"]:
            assert isinstance(e["source_evidence_ids"], list)
            assert len(e["source_evidence_ids"]) > 0

        # 4. Verify GET /graph returns identical graph without rerunning
        graph_res = client.get(f"/api/cases/{case1_id}/graph", headers=headers)
        assert graph_res.status_code == 200
        assert len(graph_res.json()["nodes"]) == len(graph["nodes"])
        assert len(graph_res.json()["edges"]) == len(graph["edges"])

        # 5. Verify top-risk entities
        top_risk_res = client.get(f"/api/cases/{case1_id}/entities/top-risk", headers=headers)
        assert top_risk_res.status_code == 200
        top_risk = top_risk_res.json()
        assert len(top_risk) <= 5
        assert len(top_risk) > 0
        assert any(e["risk_level"] == "high" for e in top_risk)

        # 6. Test Cross-Case Correlation
        case2_res = client.post(
            "/api/cases",
            headers=headers,
            json={
                "victim_name": "Anita Roy",
                "scam_type": "phishing_vishing",
                "district": "Indore East",
            },
        )
        assert case2_res.status_code == 201
        case2_id = case2_res.json()["id"]

        # Upload APK dump (contains overlapping IMEI 860123456789012)
        with open(Path("data/sample/mock_apk_dump.json"), "rb") as f:
            client.post(
                f"/api/cases/{case2_id}/evidence",
                headers=headers,
                data={"evidence_category": "other"},
                files={"file": ("mock_apk_dump.json", f, "application/json")},
            )

        # Run correlation on Case 2
        case2_corr = client.post(f"/api/cases/{case2_id}/correlate", headers=headers)
        assert case2_corr.status_code == 200
        case2_edges = case2_corr.json()["graph"]["edges"]

        # Check for cross-case link pointing to Case 1
        cross_case_edges = [
            e for e in case2_edges
            if e.get("extra") and e["extra"].get("cross_case") is True
        ]
        assert len(cross_case_edges) > 0, f"Expected cross-case edges, got: {case2_edges}"
        matched_case_numbers = [e["extra"]["matched_case_number"] for e in cross_case_edges]
        assert case1_num in matched_case_numbers, f"Expected {case1_num} in {matched_case_numbers}"
