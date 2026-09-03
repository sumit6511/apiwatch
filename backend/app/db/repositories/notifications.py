from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase


class NotificationRepository:
    def __init__(self, db: AsyncDatabase):
        self._collection = db.notification_channels

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self._collection.insert_one(document)
        return await self._collection.find_one({"_id": result.inserted_id})

    async def get(self, channel_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(channel_id):
            return None
        return await self._collection.find_one({"_id": ObjectId(channel_id)})

    async def list_all(self) -> list[dict[str, Any]]:
        cursor = self._collection.find({}).sort("created_at", -1)
        return [doc async for doc in cursor]

    async def list_enabled_by_ids(self, ids: list[str]) -> list[dict[str, Any]]:
        object_ids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
        if not object_ids:
            return []
        cursor = self._collection.find({"_id": {"$in": object_ids}, "enabled": True})
        return [doc async for doc in cursor]

    async def update(self, channel_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        if not ObjectId.is_valid(channel_id):
            return None
        return await self._collection.find_one_and_update(
            {"_id": ObjectId(channel_id)},
            {"$set": fields},
            return_document=ReturnDocument.AFTER,
        )

    async def delete(self, channel_id: str) -> bool:
        if not ObjectId.is_valid(channel_id):
            return False
        result = await self._collection.delete_one({"_id": ObjectId(channel_id)})
        return result.deleted_count > 0
