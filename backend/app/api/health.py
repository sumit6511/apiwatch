import logging

from fastapi import APIRouter, Request

from app.db.client import get_client

logger = logging.getLogger("apiwatch.health")

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health(request: Request) -> dict:
    """Never expose MongoDB URIs, webhook URLs, secrets, or filesystem paths here."""
    database_status = "ok"
    try:
        await get_client().admin.command("ping")
    except Exception:
        logger.warning("health_check_database_unreachable")
        database_status = "error"

    scheduler = getattr(request.app.state, "scheduler", None)
    scheduler_status = "ok" if scheduler is not None else "disabled"

    overall_status = "ok" if database_status == "ok" else "degraded"

    return {"status": overall_status, "database": database_status, "scheduler": scheduler_status}
