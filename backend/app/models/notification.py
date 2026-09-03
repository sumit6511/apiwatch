from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import PyObjectId
from app.models.enums import NotificationType


class NotificationChannelDocument(BaseModel):
    """Shape of a document in the `notification_channels` collection.

    `webhook_url_encrypted` stores a Fernet ciphertext, never the plaintext webhook URL.
    """

    id: PyObjectId = Field(alias="_id")
    type: NotificationType = NotificationType.DISCORD
    name: str
    webhook_url_encrypted: str
    enabled: bool = True
    created_at: datetime

    model_config = {"populate_by_name": True}
