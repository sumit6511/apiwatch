from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase


class UserRepository:
    def __init__(self, db: AsyncDatabase):
        self._collection = db.users

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self._collection.insert_one(document)
        return await self._collection.find_one({"_id": result.inserted_id})

    async def get_by_email(self, email: str) -> dict[str, Any] | None:
        return await self._collection.find_one({"email": email})

    async def get_by_id(self, user_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(user_id):
            return None
        return await self._collection.find_one({"_id": ObjectId(user_id)})

    async def get_by_public_slug(self, slug: str) -> dict[str, Any] | None:
        return await self._collection.find_one({"public_slug": slug})

    async def set_public_slug(self, user_id: str, slug: str) -> None:
        await self._collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"public_slug": slug}})
