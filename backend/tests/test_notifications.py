import json
from unittest.mock import AsyncMock

import aiosmtplib
import httpx
import pytest
import respx
from bson import ObjectId

from app.config import get_settings
from app.errors import NotificationFailedError, NotificationNotFoundError
from app.notifications.base import NotificationEvent, NotificationEventType
from app.notifications.discord import DiscordWebhookProvider
from app.notifications.email import EmailProvider
from app.notifications.telegram import TelegramProvider
from app.schemas.notification import NotificationChannelCreate, NotificationChannelUpdate
from app.services.notification_service import NotificationService

WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc"
TELEGRAM_TOKEN = "123456:ABC-DEF"
TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
OWNER_ID = str(ObjectId())
OTHER_OWNER_ID = str(ObjectId())


# ── Discord provider ─────────────────────────────────────────────────────


@respx.mock
async def test_discord_provider_sends_outage_payload():
    route = respx.post(WEBHOOK_URL).mock(return_value=httpx.Response(204))
    provider = DiscordWebhookProvider()
    event = NotificationEvent(
        event_type=NotificationEventType.OUTAGE,
        monitor_name="GitHub API",
        monitor_url="https://api.github.com",
        reason="HTTP 503",
    )
    await provider.send({"webhook_url": WEBHOOK_URL}, event)

    assert route.called
    body = json.loads(route.calls.last.request.content)
    assert "DOWN" in body["embeds"][0]["description"]
    assert "GitHub API" in body["embeds"][0]["description"]


@respx.mock
async def test_discord_provider_sends_recovery_payload():
    route = respx.post(WEBHOOK_URL).mock(return_value=httpx.Response(204))
    provider = DiscordWebhookProvider()
    event = NotificationEvent(
        event_type=NotificationEventType.RECOVERY,
        monitor_name="GitHub API",
        monitor_url="https://api.github.com",
        downtime_seconds=272,
    )
    await provider.send({"webhook_url": WEBHOOK_URL}, event)

    body = json.loads(route.calls.last.request.content)
    assert "back UP" in body["embeds"][0]["description"]


@respx.mock
async def test_discord_provider_raises_on_error_response():
    respx.post(WEBHOOK_URL).mock(return_value=httpx.Response(400))
    provider = DiscordWebhookProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    with pytest.raises(NotificationFailedError):
        await provider.send({"webhook_url": WEBHOOK_URL}, event)


@respx.mock
async def test_discord_provider_raises_on_network_error():
    respx.post(WEBHOOK_URL).mock(side_effect=httpx.ConnectError("refused"))
    provider = DiscordWebhookProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    with pytest.raises(NotificationFailedError):
        await provider.send({"webhook_url": WEBHOOK_URL}, event)


# ── Telegram provider ────────────────────────────────────────────────────


@respx.mock
async def test_telegram_provider_sends_outage_message():
    route = respx.post(TELEGRAM_API).mock(return_value=httpx.Response(200, json={"ok": True}))
    provider = TelegramProvider()
    event = NotificationEvent(
        event_type=NotificationEventType.OUTAGE,
        monitor_name="GitHub API",
        monitor_url="https://api.github.com",
        reason="HTTP 503",
    )
    await provider.send({"bot_token": TELEGRAM_TOKEN, "chat_id": "999"}, event)

    assert route.called
    body = json.loads(route.calls.last.request.content)
    assert body["chat_id"] == "999"
    assert "DOWN" in body["text"]
    assert "GitHub API" in body["text"]


@respx.mock
async def test_telegram_provider_raises_with_telegrams_error_description():
    respx.post(TELEGRAM_API).mock(
        return_value=httpx.Response(400, json={"ok": False, "description": "chat not found"})
    )
    provider = TelegramProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    with pytest.raises(NotificationFailedError, match="chat not found"):
        await provider.send({"bot_token": TELEGRAM_TOKEN, "chat_id": "999"}, event)


@respx.mock
async def test_telegram_provider_raises_on_network_error():
    respx.post(TELEGRAM_API).mock(side_effect=httpx.ConnectError("refused"))
    provider = TelegramProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    with pytest.raises(NotificationFailedError):
        await provider.send({"bot_token": TELEGRAM_TOKEN, "chat_id": "999"}, event)


# ── Email provider ───────────────────────────────────────────────────────


async def test_email_provider_fails_clearly_when_smtp_not_configured(monkeypatch):
    monkeypatch.setattr(get_settings(), "smtp_host", "")
    provider = EmailProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    with pytest.raises(NotificationFailedError, match="aren't configured"):
        await provider.send({"to_email": "me@example.com"}, event)


async def test_email_provider_sends_via_smtp(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_from_email", "alerts@example.com")

    send_mock = AsyncMock(return_value=({}, "OK"))
    monkeypatch.setattr("app.notifications.email.aiosmtplib.send", send_mock)

    provider = EmailProvider()
    event = NotificationEvent(
        event_type=NotificationEventType.OUTAGE,
        monitor_name="GitHub API",
        monitor_url="https://api.github.com",
        reason="HTTP 503",
    )
    await provider.send({"to_email": "me@example.com"}, event)

    send_mock.assert_awaited_once()
    sent_message = send_mock.call_args.args[0]
    assert sent_message["To"] == "me@example.com"
    assert "DOWN" in sent_message["Subject"]


async def test_email_provider_uses_starttls_on_port_587(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_port", 587)
    monkeypatch.setattr(settings, "smtp_from_email", "alerts@example.com")

    send_mock = AsyncMock(return_value=({}, "OK"))
    monkeypatch.setattr("app.notifications.email.aiosmtplib.send", send_mock)

    provider = EmailProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    await provider.send({"to_email": "me@example.com"}, event)

    assert send_mock.call_args.kwargs["start_tls"] is True
    assert send_mock.call_args.kwargs["use_tls"] is False


async def test_email_provider_uses_implicit_tls_on_port_465(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_port", 465)
    monkeypatch.setattr(settings, "smtp_from_email", "alerts@example.com")

    send_mock = AsyncMock(return_value=({}, "OK"))
    monkeypatch.setattr("app.notifications.email.aiosmtplib.send", send_mock)

    provider = EmailProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    await provider.send({"to_email": "me@example.com"}, event)

    assert send_mock.call_args.kwargs["use_tls"] is True
    assert send_mock.call_args.kwargs["start_tls"] is False


async def test_email_provider_raises_on_smtp_failure(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_from_email", "alerts@example.com")
    monkeypatch.setattr(
        "app.notifications.email.aiosmtplib.send",
        AsyncMock(side_effect=aiosmtplib.SMTPAuthenticationError(535, "bad credentials")),
    )

    provider = EmailProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    with pytest.raises(NotificationFailedError):
        await provider.send({"to_email": "me@example.com"}, event)


# ── NotificationService: masking, ownership, cross-type behavior ────────


async def test_webhook_url_never_exposed_in_api_responses(notification_repo):
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(name="Prod Discord", webhook_url=WEBHOOK_URL, enabled=True), OWNER_ID
    )
    assert WEBHOOK_URL not in created.target_masked

    listed = await service.list_all(OWNER_ID)
    assert len(listed) == 1
    assert WEBHOOK_URL not in listed[0].target_masked


async def test_telegram_bot_token_never_exposed_in_api_responses(notification_repo):
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(
            type="telegram", name="Telegram Alerts", bot_token=TELEGRAM_TOKEN, chat_id="999999"
        ),
        OWNER_ID,
    )
    assert TELEGRAM_TOKEN not in created.target_masked
    assert "9999" in created.target_masked  # last 4 digits shown, rest masked


async def test_email_address_partially_masked(notification_repo):
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(type="email", name="Email Alerts", to_email="jane@example.com"), OWNER_ID
    )
    assert created.target_masked != "jane@example.com"
    assert created.target_masked.endswith("@example.com")


async def test_create_requires_the_right_fields_per_type():
    with pytest.raises(ValueError):
        NotificationChannelCreate(type="telegram", name="Missing chat id", bot_token=TELEGRAM_TOKEN)
    with pytest.raises(ValueError):
        NotificationChannelCreate(type="email", name="Missing recipient")


@respx.mock
async def test_notification_service_test_sends_via_discord(notification_repo):
    respx.post(WEBHOOK_URL).mock(return_value=httpx.Response(204))
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(name="Prod Discord", webhook_url=WEBHOOK_URL, enabled=True), OWNER_ID
    )
    await service.test(created.id, OWNER_ID)  # should not raise


async def test_update_can_change_type_specific_field_without_touching_others(notification_repo):
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(
            type="telegram", name="Telegram Alerts", bot_token=TELEGRAM_TOKEN, chat_id="111111"
        ),
        OWNER_ID,
    )

    updated = await service.update(created.id, OWNER_ID, NotificationChannelUpdate(chat_id="222222"))
    assert "2222" in updated.target_masked
    assert updated.name == "Telegram Alerts"  # untouched


async def test_disabled_channel_is_excluded_from_enabled_lookup(notification_repo):
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(name="Disabled", webhook_url=WEBHOOK_URL, enabled=False), OWNER_ID
    )
    # send_to_channels() fans out only to *enabled* channels returned by this
    # repository lookup -- assert directly on it rather than on
    # send_to_channels' internally-swallowed exceptions.
    enabled = await notification_repo.list_enabled_by_ids([created.id])
    assert enabled == []


async def test_channel_not_visible_to_a_different_owner(notification_repo):
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(name="Mine", webhook_url=WEBHOOK_URL, enabled=True), OWNER_ID
    )

    with pytest.raises(NotificationNotFoundError):
        await service.update(created.id, OTHER_OWNER_ID, NotificationChannelUpdate(name="hijacked"))


async def test_list_all_only_returns_the_callers_own_channels(notification_repo):
    service = NotificationService(notification_repo)
    await service.create(
        NotificationChannelCreate(name="Mine", webhook_url=WEBHOOK_URL, enabled=True), OWNER_ID
    )
    await service.create(
        NotificationChannelCreate(name="Theirs", webhook_url=WEBHOOK_URL, enabled=True), OTHER_OWNER_ID
    )

    mine = await service.list_all(OWNER_ID)
    assert [c.name for c in mine] == ["Mine"]
