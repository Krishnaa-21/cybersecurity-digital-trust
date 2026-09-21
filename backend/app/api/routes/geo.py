from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Officer
from app.api.routes.auth import get_current_officer
from app.services.geo.heatmap import get_district_heatmap

router = APIRouter(prefix="/geo", tags=["geo"])


class DistrictHeatmapItem(BaseModel):
    district: str
    case_count: int
    level: str  # "low", "medium", "high"


@router.get("/heatmap", response_model=List[DistrictHeatmapItem])
def get_heatmap(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    """Return district-level case counts and density levels for the fraud heatmap."""
    return get_district_heatmap(db)
