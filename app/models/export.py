from enum import Enum

from pydantic import BaseModel


class ExportFormat(str, Enum):
    """Supported document export formats."""

    PDF = "pdf"


class ExportRequest(BaseModel):
    """Request payload for exporting findings document."""

    session_id: str
    format: ExportFormat
