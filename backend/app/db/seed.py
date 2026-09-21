from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Officer
from app.core.security import get_password_hash


def seed_data(db: Session = None):
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        officer_count = db.query(Officer).count()
        if officer_count == 0:
            seed_officer = Officer(
                badge_id="MP-IO-4471",
                name="A. Sharma",
                station_name="Bhopal Cyber Cell",
                password_hash=get_password_hash("demo1234"),
            )
            db.add(seed_officer)
            db.commit()
            print("Seeded default officer: MP-IO-4471 (A. Sharma)")
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    seed_data()
