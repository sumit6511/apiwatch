from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase


class MonitorRepository:
    def __init__(self, db: AsyncDatabase):
        self._collection = db.monitors

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self._collection.insert_one(document)
        return await self._collection.find_one({"_id": result.inserted_id})

    async def get(self, monitor_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(monitor_id):
            return None
        return await self._collection.find_one({"_id": ObjectId(monitor_id)})

    async def list_all(self, active_only: bool = False) -> list[dict[str, Any]]:
        query = {"is_active": True} if active_only else {}
        cursor = self._collection.find(query).sort("created_at", -1)
        return [doc async for doc in cursor]

    async def update(self, monitor_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        if not ObjectId.is_valid(monitor_id):
            return None
        fields = {**fields, "updated_at": datetime.now(UTC)}
        return await self._collection.find_one_and_update(
            {"_id": ObjectId(monitor_id)},
            {"$set": fields},
            return_document=ReturnDocument.AFTER,
        )

    async def delete(self, monitor_id: str) -> bool:
        if not ObjectId.is_valid(monitor_id):
            return False
        result = await self._collection.delete_one({"_id": ObjectId(monitor_id)})
        return result.deleted_count > 0

    async def count_by_status(self) -> dict[str, int]:
        pipeline = [{"$group": {"_id": "$current_status", "count": {"$sum": 1}}}]
        cursor = await self._collection.aggregate(pipeline)
        return {doc["_id"]: doc["count"] async for doc in cursor}

    async def total_count(self) -> int:
        return await self._collection.count_documents({})
