import logging

from pymongo.asynchronous.database import AsyncDatabase

logger = logging.getLogger("apiwatch.db")


async def ensure_indexes(db: AsyncDatabase) -> None:
    """Create indexes idempotently. Safe to call on every startup."""
    await db.monitors.create_index("is_active")
    await db.monitors.create_index("created_at")

    await db.checks.create_index([("monitor_id", 1), ("checked_at", -1)])

    await db.incidents.create_index([("monitor_id", 1), ("status", 1)])
    await db.incidents.create_index([("monitor_id", 1), ("started_at", -1)])

    await db.notification_channels.create_index("enabled")

    logger.info("mongodb_indexes_ready")
