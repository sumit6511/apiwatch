import json

import httpx
import pytest
import respx

from app.errors import NotificationFailedError
from app.notifications.base import NotificationEvent, NotificationEventType
from app.notifications.discord import DiscordWebhookProvider
from app.schemas.notification import NotificationChannelCreate
from app.services.notification_service import NotificationService

WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc"


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
    await provider.send(WEBHOOK_URL, event)

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
    await provider.send(WEBHOOK_URL, event)

    body = json.loads(route.calls.last.request.content)
    assert "back UP" in body["embeds"][0]["description"]


@respx.mock
async def test_discord_provider_raises_on_error_response():
    respx.post(WEBHOOK_URL).mock(return_value=httpx.Response(400))
    provider = DiscordWebhookProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    with pytest.raises(NotificationFailedError):
        await provider.send(WEBHOOK_URL, event)


@respx.mock
async def test_discord_provider_raises_on_network_error():
    respx.post(WEBHOOK_URL).mock(side_effect=httpx.ConnectError("refused"))
    provider = DiscordWebhookProvider()
    event = NotificationEvent(event_type=NotificationEventType.TEST, monitor_name="X", monitor_url="")
    with pytest.raises(NotificationFailedError):
        await provider.send(WEBHOOK_URL, event)


async def test_webhook_url_never_exposed_in_api_responses(notification_repo):
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(name="Prod Discord", webhook_url=WEBHOOK_URL, enabled=True)
    )
    assert WEBHOOK_URL not in created.webhook_url_masked

    listed = await service.list_all()
    assert len(listed) == 1
    assert WEBHOOK_URL not in listed[0].webhook_url_masked


@respx.mock
async def test_notification_service_test_sends_via_discord(notification_repo):
    respx.post(WEBHOOK_URL).mock(return_value=httpx.Response(204))
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(name="Prod Discord", webhook_url=WEBHOOK_URL, enabled=True)
    )
    await service.test(created.id)  # should not raise


async def test_disabled_channel_is_excluded_from_enabled_lookup(notification_repo):
    service = NotificationService(notification_repo)
    created = await service.create(
        NotificationChannelCreate(name="Disabled", webhook_url=WEBHOOK_URL, enabled=False)
    )
    # send_to_channels() fans out only to *enabled* channels returned by this
    # repository lookup -- assert directly on it rather than on
    # send_to_channels' internally-swallowed exceptions.
    enabled = await notification_repo.list_enabled_by_ids([created.id])
    assert enabled == []
