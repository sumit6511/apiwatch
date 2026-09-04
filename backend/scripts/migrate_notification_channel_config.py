"""One-off migration: convert notification_channels documents from the old
single-field shape (`webhook_url_encrypted`, Discord-only) to the new
generalized shape (`config_encrypted`, a Fernet-encrypted JSON object whose
keys depend on `type` -- see app/models/notification.py).

Every existing channel predates multi-provider support, so every one is a
Discord channel: `{"webhook_url": "..."}`.

Not part of the running app -- run manually, once, after deploying the
notification-providers feature.

Usage:
    cd backend
    .venv/bin/python scripts/migrate_notification_channel_config.py          # dry run
    .venv/bin/python scripts/migrate_notification_channel_config.py --apply  # writes changes
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo import AsyncMongoClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.security import decrypt_secret, encrypt_secret  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default: dry run)")
    args = parser.parse_args()

    settings = get_settings()
    client = AsyncMongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    db = client[settings.mongodb_database]

    try:
        print(f"Database: {settings.mongodb_database}")
        print("Mode:", "APPLY (writing changes)" if args.apply else "DRY RUN (no changes will be made)")
        print()

        cursor = db.notification_channels.find({"config_encrypted": {"$exists": False}})
        legacy_docs = [doc async for doc in cursor]
        print(f"Found {len(legacy_docs)} legacy channel(s) to migrate.")

        for doc in legacy_docs:
            webhook_url = decrypt_secret(doc["webhook_url_encrypted"])
            config_encrypted = encrypt_secret(json.dumps({"webhook_url": webhook_url}))
            print(f"  {doc['_id']} ({doc.get('name', 'unnamed')}) -> config_encrypted")
            if args.apply:
                await db.notification_channels.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"config_encrypted": config_encrypted}, "$unset": {"webhook_url_encrypted": ""}},
                )

        if not args.apply:
            print("\nDry run only. Re-run with --apply to write these changes.")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
