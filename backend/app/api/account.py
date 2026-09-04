from fastapi import APIRouter, Depends

from app.dependencies import get_current_user_id, get_status_page_service
from app.schemas.status_page import StatusPageSlugOut
from app.services.status_page_service import StatusPageService

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/status-page", response_model=StatusPageSlugOut)
async def get_status_page(
    user_id: str = Depends(get_current_user_id),
    status_pages: StatusPageService = Depends(get_status_page_service),
) -> StatusPageSlugOut:
    """Returns this account's public status page slug, assigning one on
    first request (most accounts never mark a monitor public, so slugs are
    generated lazily rather than at signup)."""
    return await status_pages.get_or_create_slug(user_id)


@router.post("/status-page/regenerate", response_model=StatusPageSlugOut)
async def regenerate_status_page(
    user_id: str = Depends(get_current_user_id),
    status_pages: StatusPageService = Depends(get_status_page_service),
) -> StatusPageSlugOut:
    """Issues a new slug, invalidating the old link -- for when it's leaked
    somewhere it shouldn't have been."""
    return await status_pages.regenerate_slug(user_id)
