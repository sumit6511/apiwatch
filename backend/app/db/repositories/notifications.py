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

    async def get(self, channel_id: str, owner_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(channel_id):
            return None
        return await self._collection.find_one(
            {"_id": ObjectId(channel_id), "owner_id": ObjectId(owner_id)}
        )

    async def list_all(self, owner_id: str) -> list[dict[str, Any]]:
        cursor = self._collection.find({"owner_id": ObjectId(owner_id)}).sort("created_at", -1)
        return [doc async for doc in cursor]

    async def count_by_ids_and_owner(self, ids: list[str], owner_id: str) -> int:
        """Used to validate that every notification_channel_id a monitor
        references actually belongs to the monitor's owner -- without this,
        one account could point a monitor at another account's Discord
        channel and spam it with outage alerts for a monitor they don't
        control."""
        object_ids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
        if not object_ids:
            return 0
        return await self._collection.count_documents(
            {"_id": {"$in": object_ids}, "owner_id": ObjectId(owner_id)}
        )

    async def list_enabled_by_ids(self, ids: list[str]) -> list[dict[str, Any]]:
        """No owner filter -- called from the background checker pipeline
        (no per-request user context), against channel ids that were already
        validated to belong to the monitor's owner when the monitor was
        saved (see count_by_ids_and_owner)."""
        object_ids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
        if not object_ids:
            return []
        cursor = self._collection.find({"_id": {"$in": object_ids}, "enabled": True})
        return [doc async for doc in cursor]

    async def update(self, channel_id: str, owner_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        if not ObjectId.is_valid(channel_id):
            return None
        return await self._collection.find_one_and_update(
            {"_id": ObjectId(channel_id), "owner_id": ObjectId(owner_id)},
            {"$set": fields},
            return_document=ReturnDocument.AFTER,
        )

    async def delete(self, channel_id: str, owner_id: str) -> bool:
        if not ObjectId.is_valid(channel_id):
            return False
        result = await self._collection.delete_one(
            {"_id": ObjectId(channel_id), "owner_id": ObjectId(owner_id)}
        )
        return result.deleted_count > 0
