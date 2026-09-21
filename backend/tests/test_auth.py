from fastapi.testclient import TestClient
from app.main import app


def test_root():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert response.json() == {"message": "TraceX API is running"}


def test_login_success():
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"badge_id": "MP-IO-4471", "password": "demo1234"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["officer"]["badge_id"] == "MP-IO-4471"
        assert data["officer"]["name"] == "A. Sharma"


def test_login_invalid_password():
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"badge_id": "MP-IO-4471", "password": "wrongpassword"},
        )
        assert response.status_code == 401


def test_get_current_officer():
    with TestClient(app) as client:
        login_resp = client.post(
            "/api/auth/login",
            json={"badge_id": "MP-IO-4471", "password": "demo1234"},
        )
        token = login_resp.json()["access_token"]

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["badge_id"] == "MP-IO-4471"
        assert data["name"] == "A. Sharma"
        assert data["station_name"] == "Bhopal Cyber Cell"


def test_get_current_officer_unauthorized():
    with TestClient(app) as client:
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalidtoken"},
        )
        assert response.status_code == 401
