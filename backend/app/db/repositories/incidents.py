from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase


class IncidentRepository:
    def __init__(self, db: AsyncDatabase):
        self._collection = db.incidents

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self._collection.insert_one(document)
        return await self._collection.find_one({"_id": result.inserted_id})

    async def get_open_for_monitor(self, monitor_id: str) -> dict[str, Any] | None:
        return await self._collection.find_one({"monitor_id": ObjectId(monitor_id), "status": "OPEN"})

    async def resolve(self, incident_id: str, resolved_at: datetime) -> dict[str, Any] | None:
        return await self._collection.find_one_and_update(
            {"_id": ObjectId(incident_id)},
            {"$set": {"status": "RESOLVED", "resolved_at": resolved_at}},
            return_document=ReturnDocument.AFTER,
        )

    async def list_for_monitor(self, monitor_id: str, limit: int = 50) -> list[dict[str, Any]]:
        cursor = (
            self._collection.find({"monitor_id": ObjectId(monitor_id)})
            .sort("started_at", -1)
            .limit(min(limit, 200))
        )
        return [doc async for doc in cursor]

    async def list_all(self, owner_id: str, limit: int = 100) -> list[dict[str, Any]]:
        cursor = (
            self._collection.find({"owner_id": ObjectId(owner_id)})
            .sort("started_at", -1)
            .limit(min(limit, 500))
        )
        return [doc async for doc in cursor]

    async def delete_for_monitor(self, monitor_id: str) -> int:
        result = await self._collection.delete_many({"monitor_id": ObjectId(monitor_id)})
        return result.deleted_count
