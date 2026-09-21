from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Case, EvidenceFile, EvidenceCategory, UploadStatus, Officer
from app.schemas.evidence import EvidenceFileRead
from app.api.routes.auth import get_current_officer
from app.utils.hashing import compute_sha256
from app.utils.file_storage import save_upload_file
from app.services.ingestion.router import process_evidence_file

router = APIRouter(tags=["evidence"])


@router.post("/cases/{case_id}/evidence", response_model=EvidenceFileRead, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    case_id: int,
    file: UploadFile = File(...),
    evidence_category: str = Form(...),
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    cat_clean = evidence_category.strip().lower()
    if cat_clean not in ["telecom", "bank_upi", "other"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid evidence_category. Must be 'telecom', 'bank_upi', or 'other'.",
        )

    # Read file content into memory
    content = await file.read()
    sha256_hash = compute_sha256(content)

    # Save raw file under backend/uploads/{case_id}/
    saved_path = save_upload_file(case_id, file.filename, content)

    # Create EvidenceFile record in queued status
    evidence_record = EvidenceFile(
        case_id=case_id,
        original_filename=file.filename,
        evidence_category=EvidenceCategory(cat_clean),
        file_path=str(saved_path),
        sha256_hash=sha256_hash,
        upload_status=UploadStatus.queued,
    )
    db.add(evidence_record)
    db.commit()
    db.refresh(evidence_record)

    # Normalize file and persist entities
    try:
        process_evidence_file(db, evidence_record)
        db.refresh(evidence_record)

        # Automatically resolve case district from evidence indicators (IFSC / PIN)
        from app.services.geo.heatmap import resolve_district
        resolve_district(case_id, db)

    except Exception as exc:
        # Status has been set to failed by process_evidence_file
        db.refresh(evidence_record)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process evidence file: {str(exc)}",
        )

    return evidence_record


@router.get("/cases/{case_id}/evidence", response_model=List[EvidenceFileRead])
def list_case_evidence(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    files = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.case_id == case_id)
        .order_by(EvidenceFile.uploaded_at.desc())
        .all()
    )
    return files


@router.get("/evidence/unprocessed")
def get_unprocessed_evidence(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    files = (
        db.query(EvidenceFile, Case.case_number)
        .join(Case, Case.id == EvidenceFile.case_id)
        .filter(EvidenceFile.upload_status.in_([UploadStatus.queued, UploadStatus.processing]))
        .order_by(EvidenceFile.uploaded_at.desc())
        .all()
    )
    result = []
    for ef, case_num in files:
        result.append({
            "id": ef.id,
            "case_id": ef.case_id,
            "case_number": case_num,
            "original_filename": ef.original_filename,
            "evidence_category": ef.evidence_category.value if hasattr(ef.evidence_category, "value") else str(ef.evidence_category),
            "upload_status": ef.upload_status.value if hasattr(ef.upload_status, "value") else str(ef.upload_status),
            "uploaded_at": ef.uploaded_at.isoformat() if ef.uploaded_at else None,
            "row_count": ef.row_count,
            "sha256_hash": ef.sha256_hash,
        })
    return result

