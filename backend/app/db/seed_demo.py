import os
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Case, EvidenceFile, EvidenceCategory, UploadStatus, Officer, CaseStatus, RiskLevel
from app.utils.hashing import compute_sha256
from app.utils.file_storage import save_upload_file
from app.services.ingestion.router import process_evidence_file
from app.services.correlation.entity_correlation import correlate_case
from app.services.risk.scoring import score_case
from app.services.geo.heatmap import resolve_district
from app.services.ai.case_summary import generate_case_summary


def ingest_file_through_pipeline(db: Session, case_id: int, file_path: Path, category: str) -> EvidenceFile:
    """Ingest a physical file through the exact production normalization pipeline."""
    with open(file_path, "rb") as f:
        content = f.read()

    filename = file_path.name
    sha256_hash = compute_sha256(content)
    saved_path = save_upload_file(case_id, filename, content)

    evidence_record = EvidenceFile(
        case_id=case_id,
        original_filename=filename,
        evidence_category=EvidenceCategory(category.lower()),
        file_path=str(saved_path),
        sha256_hash=sha256_hash,
        upload_status=UploadStatus.queued,
    )
    db.add(evidence_record)
    db.commit()
    db.refresh(evidence_record)

    # Run parser & entity extraction
    process_evidence_file(db, evidence_record)
    db.refresh(evidence_record)
    return evidence_record


def seed_demo_cases(db: Session = None):
    """Seed 4 realistic demo cases across risk levels and scam types if cases table is empty."""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        case_count = db.query(Case).count()
        if case_count > 0:
            print(f"[seed_demo] Cases table already contains {case_count} records. Skipping seed.")
            return

        # Ensure default officer exists
        officer = db.query(Officer).first()
        if not officer:
            from app.db.seed import seed_data
            seed_data(db)
            officer = db.query(Officer).first()

        sample_dir = Path(__file__).resolve().parent.parent.parent / "data" / "sample"
        cdr_file = sample_dir / "mock_cdr.csv"
        bank_file = sample_dir / "mock_bank_upi.xlsx"
        email_file = sample_dir / "mock_email.eml"
        apk_file = sample_dir / "mock_apk_dump.json"

        # -------------------------------------------------------------
        # CASE 1: HIGH RISK — Digital Scam (Multi-Hop Mule Network)
        # -------------------------------------------------------------
        case1 = Case(
            case_number="#4471",
            victim_name="Rameshwar Patel",
            scam_type="digital_scam",
            registered_by=officer.id,
            status=CaseStatus.correlating,
        )
        db.add(case1)
        db.commit()
        db.refresh(case1)

        if bank_file.exists():
            ingest_file_through_pipeline(db, case1.id, bank_file, "bank_upi")
        if cdr_file.exists():
            ingest_file_through_pipeline(db, case1.id, cdr_file, "telecom")

        correlate_case(case1.id, db)
        score_case(case1.id, db)
        resolve_district(case1.id, db)
        try:
            generate_case_summary(case1.id, db)
        except Exception:
            pass

        # -------------------------------------------------------------
        # CASE 2: MEDIUM RISK — Malicious APK (Trojan SMS Forwarder)
        # -------------------------------------------------------------
        case2 = Case(
            case_number="#4472",
            victim_name="Meenakshi Sundaram",
            scam_type="malicious_apk",
            registered_by=officer.id,
            status=CaseStatus.correlating,
        )
        db.add(case2)
        db.commit()
        db.refresh(case2)

        if apk_file.exists():
            ingest_file_through_pipeline(db, case2.id, apk_file, "other")

        correlate_case(case2.id, db)
        score_case(case2.id, db)
        resolve_district(case2.id, db)
        if not case2.district:
            case2.district = "Indore East"
            db.commit()
        try:
            generate_case_summary(case2.id, db)
        except Exception:
            pass

        # -------------------------------------------------------------
        # CASE 3: LOW / MODERATE RISK — Phishing / Vishing (Bank Impersonation)
        # -------------------------------------------------------------
        case3 = Case(
            case_number="#4473",
            victim_name="Dr. Alok Verma",
            scam_type="phishing_vishing",
            registered_by=officer.id,
            status=CaseStatus.correlating,
        )
        db.add(case3)
        db.commit()
        db.refresh(case3)

        if email_file.exists():
            ingest_file_through_pipeline(db, case3.id, email_file, "other")

        correlate_case(case3.id, db)
        score_case(case3.id, db)
        resolve_district(case3.id, db)
        if not case3.district:
            case3.district = "Jabalpur"
            db.commit()
        try:
            generate_case_summary(case3.id, db)
        except Exception:
            pass

        # -------------------------------------------------------------
        # CASE 4: FRESH / AWAITING CORRELATION (No evidence uploaded yet)
        # -------------------------------------------------------------
        case4 = Case(
            case_number="#4474",
            victim_name="Sunita Deshmukh",
            scam_type="digital_scam",
            registered_by=officer.id,
            status=CaseStatus.open,
            district="Gwalior",
        )
        db.add(case4)
        db.commit()
        db.refresh(case4)

        print("[seed_demo] Successfully seeded 4 realistic demo cases (#4471 - #4474) with complete correlation & scoring.")

    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    seed_demo_cases()
