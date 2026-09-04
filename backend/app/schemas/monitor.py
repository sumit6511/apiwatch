import json
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.config import get_settings
from app.constants import (
    MAX_HEADER_KEY_LENGTH,
    MAX_HEADER_VALUE_LENGTH,
    MAX_HEADERS,
    MAX_INTERVAL_SECONDS,
    MAX_NAME_LENGTH,
    MAX_STATUS_CODE,
    MAX_TAG_LENGTH,
    MAX_TAGS,
    MAX_TIMEOUT_SECONDS,
    MAX_URL_LENGTH,
    MIN_INTERVAL_SECONDS,
    MIN_STATUS_CODE,
    MIN_TIMEOUT_SECONDS,
)
from app.models.enums import HttpMethod, MonitorStatus


def _validate_headers(headers: dict[str, str]) -> dict[str, str]:
    if len(headers) > MAX_HEADERS:
        raise ValueError(f"A monitor may define at most {MAX_HEADERS} headers.")
    for key, value in headers.items():
        if not key or len(key) > MAX_HEADER_KEY_LENGTH:
            raise ValueError(f"Header names must be 1-{MAX_HEADER_KEY_LENGTH} characters.")
        if len(value) > MAX_HEADER_VALUE_LENGTH:
            raise ValueError(f"Header values must be at most {MAX_HEADER_VALUE_LENGTH} characters.")
    return headers


def _validate_tags(tags: list[str]) -> list[str]:
    if len(tags) > MAX_TAGS:
        raise ValueError(f"A monitor may have at most {MAX_TAGS} tags.")
    cleaned: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        trimmed = tag.strip()
        if not trimmed:
            raise ValueError("Tags cannot be blank.")
        if len(trimmed) > MAX_TAG_LENGTH:
            raise ValueError(f"Tags must be at most {MAX_TAG_LENGTH} characters.")
        if trimmed.lower() in seen:
            continue
        seen.add(trimmed.lower())
        cleaned.append(trimmed)
    return cleaned


def _validate_body_size(body: dict | str | None) -> dict | str | None:
    if body is None:
        return None
    settings = get_settings()
    raw = body if isinstance(body, str) else json.dumps(body)
    size_kb = len(raw.encode("utf-8")) / 1024
    if size_kb > settings.max_request_body_size_kb:
        raise ValueError(f"Request body exceeds the {settings.max_request_body_size_kb}KB limit.")
    return body


class MonitorBase(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_NAME_LENGTH)
    url: str = Field(min_length=1, max_length=MAX_URL_LENGTH)
    method: HttpMethod = HttpMethod.GET
    headers: dict[str, str] = Field(default_factory=dict)
    body: dict | str | None = None
    interval_seconds: int = Field(default=300, ge=MIN_INTERVAL_SECONDS, le=MAX_INTERVAL_SECONDS)
    timeout_seconds: int = Field(default=10, ge=MIN_TIMEOUT_SECONDS, le=MAX_TIMEOUT_SECONDS)
    expected_status_codes: list[int] = Field(default_factory=lambda: [200])
    notification_channel_ids: list[str] = Field(default_factory=list)
    is_public: bool = False
    tags: list[str] = Field(default_factory=list)

    @field_validator("url")
    @classmethod
    def strip_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("URL is required.")
        return value

    @field_validator("expected_status_codes")
    @classmethod
    def validate_status_codes(cls, value: list[int]) -> list[int]:
        if not value:
            raise ValueError("At least one expected status code is required.")
        for code in value:
            if not (MIN_STATUS_CODE <= code <= MAX_STATUS_CODE):
                raise ValueError(f"Status codes must be between {MIN_STATUS_CODE} and {MAX_STATUS_CODE}.")
        return value

    @field_validator("headers")
    @classmethod
    def validate_headers(cls, value: dict[str, str]) -> dict[str, str]:
        return _validate_headers(value)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        return _validate_tags(value)

    @model_validator(mode="after")
    def validate_body(self) -> "MonitorBase":
        _validate_body_size(self.body)
        return self


class MonitorCreate(MonitorBase):
    pass


class MonitorTestRequest(BaseModel):
    """Ad-hoc request config for the "Test Request" button in the create/edit
    form (spec section 67) -- validated and probed, never persisted."""

    url: str = Field(min_length=1, max_length=MAX_URL_LENGTH)
    method: HttpMethod = HttpMethod.GET
    headers: dict[str, str] = Field(default_factory=dict)
    body: dict | str | None = None
    timeout_seconds: int = Field(default=10, ge=MIN_TIMEOUT_SECONDS, le=MAX_TIMEOUT_SECONDS)
    expected_status_codes: list[int] = Field(default_factory=lambda: [200])

    @field_validator("url")
    @classmethod
    def strip_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("URL is required.")
        return value

    @field_validator("expected_status_codes")
    @classmethod
    def validate_status_codes(cls, value: list[int]) -> list[int]:
        if not value:
            raise ValueError("At least one expected status code is required.")
        for code in value:
            if not (MIN_STATUS_CODE <= code <= MAX_STATUS_CODE):
                raise ValueError(f"Status codes must be between {MIN_STATUS_CODE} and {MAX_STATUS_CODE}.")
        return value

    @field_validator("headers")
    @classmethod
    def validate_headers(cls, value: dict[str, str]) -> dict[str, str]:
        return _validate_headers(value)

    @model_validator(mode="after")
    def validate_body(self) -> "MonitorTestRequest":
        _validate_body_size(self.body)
        return self


class MonitorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    url: str | None = Field(default=None, min_length=1, max_length=MAX_URL_LENGTH)
    method: HttpMethod | None = None
    headers: dict[str, str] | None = None
    body: dict | str | None = None
    interval_seconds: int | None = Field(default=None, ge=MIN_INTERVAL_SECONDS, le=MAX_INTERVAL_SECONDS)
    timeout_seconds: int | None = Field(default=None, ge=MIN_TIMEOUT_SECONDS, le=MAX_TIMEOUT_SECONDS)
    expected_status_codes: list[int] | None = None
    notification_channel_ids: list[str] | None = None
    is_public: bool | None = None
    tags: list[str] | None = None

    @field_validator("expected_status_codes")
    @classmethod
    def validate_status_codes(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return value
        if not value:
            raise ValueError("At least one expected status code is required.")
        for code in value:
            if not (MIN_STATUS_CODE <= code <= MAX_STATUS_CODE):
                raise ValueError(f"Status codes must be between {MIN_STATUS_CODE} and {MAX_STATUS_CODE}.")
        return value

    @field_validator("headers")
    @classmethod
    def validate_headers(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return value
        return _validate_headers(value)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        return _validate_tags(value)

    @model_validator(mode="after")
    def validate_body(self) -> "MonitorUpdate":
        if self.body is not None:
            _validate_body_size(self.body)
        return self


class UptimeSummary(BaseModel):
    period_24h: float | None = None
    period_7d: float | None = None
    period_30d: float | None = None


class MonitorOut(BaseModel):
    id: str
    name: str
    url: str
    method: HttpMethod
    headers: dict[str, str]
    body: dict | str | None
    interval_seconds: int
    timeout_seconds: int
    expected_status_codes: list[int]
    notification_channel_ids: list[str]
    is_public: bool
    tags: list[str]

    is_active: bool
    status: MonitorStatus
    http_status: int | None = None
    response_time_ms: int | None = None

    failure_count: int
    success_count: int

    last_checked_at: datetime | None
    last_success_at: datetime | None
    last_failure_at: datetime | None

    uptime: UptimeSummary | None = None

    created_at: datetime
    updated_at: datetime
