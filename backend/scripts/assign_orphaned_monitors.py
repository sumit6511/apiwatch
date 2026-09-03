"""One-off migration: assign every monitor/check/incident/notification_channel
document that predates the multi-user feature (no `owner_id` field) to a
specific account.

Not part of the running app -- run manually, once, after you've signed up
for your account.

Usage:
    cd backend
    .venv/bin/python scripts/assign_orphaned_monitors.py you@example.com

Defaults to a dry run (reports what it *would* change). Pass --apply to
actually write:

    .venv/bin/python scripts/assign_orphaned_monitors.py you@example.com --apply
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo import AsyncMongoClient  # noqa: E402

from app.config import get_settings  # noqa: E402

COLLECTIONS = ["monitors", "checks", "incidents", "notification_channels"]


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email", help="Account email to assign orphaned documents to")
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default: dry run)")
    args = parser.parse_args()

    settings = get_settings()
    client = AsyncMongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    db = client[settings.mongodb_database]

    try:
        user = await db.users.find_one({"email": args.email.lower()})
        if user is None:
            print(f"No account found for {args.email}. Sign up first, then re-run this script.")
            return

        owner_id = user["_id"]
        print(f"Target account: {args.email} ({owner_id})")
        print(f"Database: {settings.mongodb_database}")
        print("Mode:", "APPLY (writing changes)" if args.apply else "DRY RUN (no changes will be made)")
        print()

        for name in COLLECTIONS:
            collection = db[name]
            count = await collection.count_documents({"owner_id": {"$exists": False}})
            print(f"{name}: {count} document(s) with no owner_id")
            if count and args.apply:
                result = await collection.update_many(
                    {"owner_id": {"$exists": False}}, {"$set": {"owner_id": owner_id}}
                )
                print(f"  -> updated {result.modified_count}")

        if not args.apply:
            print("\nDry run only. Re-run with --apply to write these changes.")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
