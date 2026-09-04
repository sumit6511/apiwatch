from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.enums import NotificationType

MAX_BOT_TOKEN_LENGTH = 200
MAX_CHAT_ID_LENGTH = 100


class NotificationChannelCreate(BaseModel):
    """Which fields are required depends on `type` -- validated together in
    validate_config_for_type rather than as separate always-required fields,
    since exactly one group applies per channel."""

    type: NotificationType = NotificationType.DISCORD
    name: str = Field(min_length=1, max_length=100)
    enabled: bool = True

    webhook_url: str | None = Field(default=None, max_length=2048)  # discord
    bot_token: str | None = Field(default=None, max_length=MAX_BOT_TOKEN_LENGTH)  # telegram
    chat_id: str | None = Field(default=None, max_length=MAX_CHAT_ID_LENGTH)  # telegram
    to_email: EmailStr | None = None  # email

    @model_validator(mode="after")
    def validate_config_for_type(self) -> "NotificationChannelCreate":
        if self.type == NotificationType.DISCORD:
            if not self.webhook_url or not self.webhook_url.strip().startswith("https://"):
                raise ValueError("Discord channels require a webhook_url starting with https://.")
            self.webhook_url = self.webhook_url.strip()
        elif self.type == NotificationType.TELEGRAM:
            if not self.bot_token or not self.chat_id:
                raise ValueError("Telegram channels require both bot_token and chat_id.")
            self.bot_token = self.bot_token.strip()
            self.chat_id = self.chat_id.strip()
        elif self.type == NotificationType.EMAIL:
            if not self.to_email:
                raise ValueError("Email channels require to_email.")
        return self

    def to_config(self) -> dict[str, str]:
        if self.type == NotificationType.DISCORD:
            return {"webhook_url": self.webhook_url}  # type: ignore[dict-item]
        if self.type == NotificationType.TELEGRAM:
            return {"bot_token": self.bot_token, "chat_id": self.chat_id}  # type: ignore[dict-item]
        return {"to_email": str(self.to_email)}


class NotificationChannelUpdate(BaseModel):
    """No `type` here -- changing a channel's type would require an entirely
    different config shape, so that's a delete-and-recreate, not an update."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    enabled: bool | None = None

    webhook_url: str | None = Field(default=None, max_length=2048)
    bot_token: str | None = Field(default=None, max_length=MAX_BOT_TOKEN_LENGTH)
    chat_id: str | None = Field(default=None, max_length=MAX_CHAT_ID_LENGTH)
    to_email: EmailStr | None = None

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
    target_masked: str
    enabled: bool
    created_at: datetime


class NotificationTestResult(BaseModel):
    success: bool
    message: str
