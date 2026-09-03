import logging

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.config import get_settings

logger = logging.getLogger("apiwatch.db")

_client: AsyncMongoClient | None = None


async def connect_to_mongo() -> AsyncMongoClient:
    """Create the single application-level MongoDB client. Call once at startup."""
    global _client
    settings = get_settings()
    _client = AsyncMongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=8000,
        connectTimeoutMS=8000,
    )
    # Fail fast if Atlas is unreachable rather than lazily on first request.
    await _client.admin.command("ping")
    logger.info("mongodb_connected database=%s", settings.mongodb_database)
    return _client


async def close_mongo_connection() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
        logger.info("mongodb_connection_closed")


def get_client() -> AsyncMongoClient:
    if _client is None:
        raise RuntimeError("MongoDB client has not been initialized. Call connect_to_mongo() first.")
    return _client


def get_database() -> AsyncDatabase:
    settings = get_settings()
    return get_client()[settings.mongodb_database]
