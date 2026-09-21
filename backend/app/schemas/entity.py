from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.db.models import EntityType, RiskLevel


class EntityBase(BaseModel):
    case_id: int
    entity_type: EntityType
    value: str
    risk_level: RiskLevel = RiskLevel.low
    anomaly_reason: Optional[str] = None
    evidence_file_id: Optional[int] = None
    source_evidence_ids: Optional[List[int]] = None
    extra: Optional[Dict[str, Any]] = None


class EntityCreate(EntityBase):
    pass


class EntityRead(EntityBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class EntityLinkBase(BaseModel):
    case_id: int
    entity_a_id: int
    entity_b_id: int
    basis: str
    confidence: float
    source_evidence_ids: Optional[List[int]] = None
    extra: Optional[Dict[str, Any]] = None


class EntityLinkCreate(EntityLinkBase):
    pass


class EntityLinkRead(EntityLinkBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
