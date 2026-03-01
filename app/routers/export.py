"""Document export endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Response

from app.deps import get_store
from app.models.export import ExportRequest, ExportFormat
from app.services.pdf import render_findings_pdf
from app.services.redis_store import RedisStore

router = APIRouter(prefix="/export", tags=["export"])


@router.post("")
async def export_findings(
    payload: ExportRequest,
    store: RedisStore = Depends(get_store),
) -> Response:
    """Generate and return final findings as a downloadable PDF file."""
    if payload.format != ExportFormat.PDF:
        raise HTTPException(status_code=422, detail="Only PDF export is enabled in v1.")

    findings = await store.get_findings(payload.session_id)
    if findings is None:
        raise HTTPException(status_code=409, detail="Findings are not available yet.")

    config = await store.get_session_config(payload.session_id)
    pdf_bytes = await render_findings_pdf(
        session_id=payload.session_id,
        question=config.question,
        findings_markdown=findings,
    )
    filename = f"roundtable-{payload.session_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

