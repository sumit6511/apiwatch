from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import PyObjectId


class UserDocument(BaseModel):
    """Shape of a document in the `users` collection."""

    id: PyObjectId = Field(alias="_id")
    email: str
    password_hash: str
    created_at: datetime
    # Unguessable identifier for this account's public status page
    # (/status/<public_slug>), assigned lazily on first request rather than
    # at signup -- most accounts will never use it. None until then.
    public_slug: str | None = None

    model_config = {"populate_by_name": True}
