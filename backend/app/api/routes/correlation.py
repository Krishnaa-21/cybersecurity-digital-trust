from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import case as sa_case, func

from app.db.database import get_db
from app.db.models import Case, EvidenceFile, Entity, CaseSummary, EvidenceCategory, RiskLevel, Officer
from app.schemas.entity import EntityRead
from app.schemas.report import CaseSummaryRead
from app.api.routes.auth import get_current_officer
from app.services.correlation.entity_correlation import correlate_case
from app.services.correlation.graph_builder import build_case_graph
from app.services.ai.case_summary import generate_case_summary

router = APIRouter(prefix="/cases", tags=["correlation"])


def get_records_by_category(case_id: int, db: Session) -> Dict[str, int]:
    """Compute evidence row counts partitioned by category and grand total."""
    evidence_files = db.query(EvidenceFile).filter(EvidenceFile.case_id == case_id).all()

    telecom_count = 0
    bank_upi_count = 0
    other_count = 0

    for ef in evidence_files:
        cat_str = ef.evidence_category.value if hasattr(ef.evidence_category, "value") else str(ef.evidence_category)
        count = ef.row_count or 0
        if cat_str == "telecom":
            telecom_count += count
        elif cat_str == "bank_upi":
            bank_upi_count += count
        else:
            other_count += count

    total = telecom_count + bank_upi_count + other_count
    return {
        "telecom": telecom_count,
        "bank_upi": bank_upi_count,
        "other": other_count,
        "total": total,
    }


@router.post("/{case_id}/correlate")
def run_correlation(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    links = correlate_case(case_id, db)
    graph_data = build_case_graph(case_id, db)
    records_stats = get_records_by_category(case_id, db)

    return {
        "records_by_category": records_stats,
        "links_count": len(links),
        "graph": graph_data,
    }


@router.get("/{case_id}/graph")
def get_graph(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    graph_data = build_case_graph(case_id, db)
    records_stats = get_records_by_category(case_id, db)
    graph_data["records_by_category"] = records_stats
    return graph_data


@router.get("/{case_id}/entities/top-risk", response_model=List[EntityRead])
def get_top_risk_entities(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    risk_order = sa_case(
        (Entity.risk_level == RiskLevel.high, 1),
        (Entity.risk_level == RiskLevel.medium, 2),
        (Entity.risk_level == RiskLevel.low, 3),
        else_=4,
    )

    entities = (
        db.query(Entity)
        .filter(Entity.case_id == case_id)
        .order_by(risk_order, Entity.id)
        .limit(5)
        .all()
    )
    return entities


@router.get("/{case_id}/summary", response_model=CaseSummaryRead)
def get_case_summary(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    latest_summary = (
        db.query(CaseSummary)
        .filter(CaseSummary.case_id == case_id)
        .order_by(CaseSummary.generated_at.desc())
        .first()
    )
    if latest_summary:
        return latest_summary

    summary = generate_case_summary(case_id, db)
    return summary


@router.post("/{case_id}/summary/regenerate", response_model=CaseSummaryRead)
def regenerate_case_summary(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    summary = generate_case_summary(case_id, db)
    return summary
