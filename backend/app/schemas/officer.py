from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class OfficerBase(BaseModel):
    badge_id: str
    name: str
    station_name: str


class OfficerCreate(OfficerBase):
    password: str


class OfficerRead(OfficerBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OfficerLogin(BaseModel):
    badge_id: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    officer: OfficerRead


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
