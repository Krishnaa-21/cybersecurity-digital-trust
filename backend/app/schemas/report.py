from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CaseSummaryBase(BaseModel):
    case_id: int
    narrative_text: str


class CaseSummaryCreate(CaseSummaryBase):
    pass


class CaseSummaryRead(CaseSummaryBase):
    id: int
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
