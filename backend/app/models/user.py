from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import PyObjectId


class UserDocument(BaseModel):
    """Shape of a document in the `users` collection."""

    id: PyObjectId = Field(alias="_id")
    email: str
    password_hash: str
    created_at: datetime

    model_config = {"populate_by_name": True}
