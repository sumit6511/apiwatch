from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import PyObjectId
from app.models.enums import NotificationType


class NotificationChannelDocument(BaseModel):
    """Shape of a document in the `notification_channels` collection.

    `config_encrypted` stores a Fernet ciphertext of a JSON object whose
    shape depends on `type`:
        discord:  {"webhook_url": "..."}
        telegram: {"bot_token": "...", "chat_id": "..."}
        email:    {"to_email": "..."}  -- the sender identity is one shared
                  SMTP configuration for the whole deployment, not per-channel.
    Never the plaintext credential.
    """

    id: PyObjectId = Field(alias="_id")
    owner_id: PyObjectId
    type: NotificationType = NotificationType.DISCORD
    name: str
    config_encrypted: str
    enabled: bool = True
    created_at: datetime

    model_config = {"populate_by_name": True}
