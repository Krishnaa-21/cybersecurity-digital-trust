from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.db.models import EvidenceCategory, UploadStatus


class EvidenceFileBase(BaseModel):
    case_id: int
    original_filename: str
    evidence_category: EvidenceCategory


class EvidenceFileCreate(EvidenceFileBase):
    file_path: str
    sha256_hash: str
    row_count: Optional[int] = None
    upload_status: Optional[UploadStatus] = UploadStatus.queued


class EvidenceFileRead(EvidenceFileBase):
    id: int
    file_path: str
    sha256_hash: str
    row_count: Optional[int] = None
    upload_status: UploadStatus
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)
