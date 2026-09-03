from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import NotificationType


class NotificationChannelCreate(BaseModel):
    type: NotificationType = NotificationType.DISCORD
    name: str = Field(min_length=1, max_length=100)
    webhook_url: str = Field(min_length=1, max_length=2048)
    enabled: bool = True

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook_url(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("https://"):
            raise ValueError("Webhook URL must use https://.")
        return value


class NotificationChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    webhook_url: str | None = Field(default=None, min_length=1, max_length=2048)
    enabled: bool | None = None

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value.startswith("https://"):
            raise ValueError("Webhook URL must use https://.")
        return value


class NotificationChannelOut(BaseModel):
    id: str
    type: NotificationType
    name: str
    webhook_url_masked: str
    enabled: bool
    created_at: datetime


class NotificationTestResult(BaseModel):
    success: bool
    message: str
