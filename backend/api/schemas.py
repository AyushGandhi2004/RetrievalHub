import uuid
from pydantic import BaseModel, field_validator
from typing import Optional


def _must_be_uuid4(v: str) -> str:
    try:
        parsed = uuid.UUID(v, version=4)
        if str(parsed) != v.lower():
            raise ValueError()
    except (ValueError, AttributeError):
        raise ValueError("session_id must be a valid UUID4")
    return v


class IngestRequest(BaseModel):
    file_url:   str
    file_key:   Optional[str] = None
    session_id: str

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v):
        return _must_be_uuid4(v)


class IngestResponse(BaseModel):
    session_id: str
    status:     str = "ingesting"


class QueryRequest(BaseModel):
    question:   str
    session_id: str

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v):
        return _must_be_uuid4(v)


class DeleteResponse(BaseModel):
    status:     str = "deleted"
    session_id: str


class HealthResponse(BaseModel):
    status: str = "ok"
