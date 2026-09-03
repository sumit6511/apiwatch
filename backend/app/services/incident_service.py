import logging
from datetime import datetime
from typing import Any

from bson import ObjectId

from app.db.repositories.incidents import IncidentRepository

logger = logging.getLogger("apiwatch.incidents")


class IncidentService:
    """Thin persistence wrapper. The decision of *when* to open/resolve an
    incident lives in the state machine (monitoring/state.py) and is driven
    by MonitorChecker -- this service only knows how to record it."""

    def __init__(self, repo: IncidentRepository):
        self._repo = repo

    async def open_incident(
        self, monitor_id: str, owner_id: str, reason: str, started_at: datetime
    ) -> dict[str, Any]:
        document = {
            "monitor_id": ObjectId(monitor_id),
            "owner_id": ObjectId(owner_id),
            "status": "OPEN",
            "reason": reason,
            "started_at": started_at,
            "resolved_at": None,
        }
        created = await self._repo.create(document)
        logger.info("incident_opened monitor_id=%s reason=%s", monitor_id, reason)
        return created

    async def resolve_incident(self, incident_id: str, resolved_at: datetime) -> dict[str, Any] | None:
        resolved = await self._repo.resolve(incident_id, resolved_at)
        logger.info("incident_resolved incident_id=%s", incident_id)
        return resolved

    async def list_for_monitor(self, monitor_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return await self._repo.list_for_monitor(monitor_id, limit)

    async def list_all(self, owner_id: str, limit: int = 100) -> list[dict[str, Any]]:
        return await self._repo.list_all(owner_id, limit)
