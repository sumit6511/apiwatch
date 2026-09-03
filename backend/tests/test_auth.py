import pytest

from app.auth import require_access_key
from app.config import get_settings
from app.errors import AppError


async def test_no_key_configured_allows_any_request(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "")
    await require_access_key(authorization=None)  # must not raise


async def test_missing_header_rejected_when_key_configured(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "secret123")
    with pytest.raises(AppError):
        await require_access_key(authorization=None)


async def test_wrong_key_rejected(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "secret123")
    with pytest.raises(AppError):
        await require_access_key(authorization="Bearer wrong-key")


async def test_malformed_header_rejected(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "secret123")
    with pytest.raises(AppError):
        await require_access_key(authorization="secret123")  # missing "Bearer " prefix


async def test_correct_key_accepted(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "secret123")
    await require_access_key(authorization="Bearer secret123")  # must not raise
