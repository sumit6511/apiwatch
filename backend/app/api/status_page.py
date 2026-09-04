from fastapi import APIRouter, Depends

from app.dependencies import get_status_page_service
from app.schemas.status_page import PublicStatusPage
from app.services.status_page_service import StatusPageService

router = APIRouter(prefix="/api/public/status", tags=["status-page"])


@router.get("/{slug}", response_model=PublicStatusPage)
async def get_public_status_page(
    slug: str,
    status_pages: StatusPageService = Depends(get_status_page_service),
) -> PublicStatusPage:
    """Deliberately unauthenticated (see app/main.py router wiring) -- this
    is the whole point of a public status page. Access control is the slug
    itself: unguessable, and scoped server-side to exactly one account's
    monitors that account explicitly opted into showing here."""
    return await status_pages.get_public_page(slug)
