from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase


class CheckRepository:
    def __init__(self, db: AsyncDatabase):
        self._collection = db.checks

    async def insert(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self._collection.insert_one(document)
        return await self._collection.find_one({"_id": result.inserted_id})

    async def list_for_monitor(
        self,
        monitor_id: str,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"monitor_id": ObjectId(monitor_id)}
        checked_at_filter: dict[str, Any] = {}
        if from_dt is not None:
            checked_at_filter["$gte"] = from_dt
        if to_dt is not None:
            checked_at_filter["$lte"] = to_dt
        if checked_at_filter:
            query["checked_at"] = checked_at_filter

        cursor = self._collection.find(query).sort("checked_at", -1).limit(min(limit, 1000))
        return [doc async for doc in cursor]

    async def latest_for_monitor(self, monitor_id: str) -> dict[str, Any] | None:
        cursor = self._collection.find({"monitor_id": ObjectId(monitor_id)}).sort("checked_at", -1).limit(1)
        async for doc in cursor:
            return doc
        return None

    async def uptime_stats(self, monitor_id: str, since: datetime) -> dict[str, int]:
        pipeline = [
            {"$match": {"monitor_id": ObjectId(monitor_id), "checked_at": {"$gte": since}}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "successful": {"$sum": {"$cond": [{"$eq": ["$status", "UP"]}, 1, 0]}},
                }
            },
        ]
        cursor = await self._collection.aggregate(pipeline)
        async for doc in cursor:
            return {"total": doc["total"], "successful": doc["successful"]}
        return {"total": 0, "successful": 0}

    async def global_uptime_stats(self, since: datetime) -> dict[str, int]:
        pipeline = [
            {"$match": {"checked_at": {"$gte": since}}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "successful": {"$sum": {"$cond": [{"$eq": ["$status", "UP"]}, 1, 0]}},
                }
            },
        ]
        cursor = await self._collection.aggregate(pipeline)
        async for doc in cursor:
            return {"total": doc["total"], "successful": doc["successful"]}
        return {"total": 0, "successful": 0}

    async def delete_older_than(self, cutoff: datetime) -> int:
        result = await self._collection.delete_many({"checked_at": {"$lt": cutoff}})
        return result.deleted_count

    async def delete_for_monitor(self, monitor_id: str) -> int:
        result = await self._collection.delete_many({"monitor_id": ObjectId(monitor_id)})
        return result.deleted_count
