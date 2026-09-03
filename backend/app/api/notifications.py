from fastapi import APIRouter, Depends, status

from app.dependencies import get_notification_service
from app.errors import NotificationFailedError
from app.schemas.notification import (
    NotificationChannelCreate,
    NotificationChannelOut,
    NotificationChannelUpdate,
    NotificationTestResult,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationChannelOut])
async def list_notifications(
    notifications: NotificationService = Depends(get_notification_service),
) -> list[NotificationChannelOut]:
    return await notifications.list_all()


@router.post("", response_model=NotificationChannelOut, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationChannelCreate,
    notifications: NotificationService = Depends(get_notification_service),
) -> NotificationChannelOut:
    return await notifications.create(payload)


@router.patch("/{channel_id}", response_model=NotificationChannelOut)
async def update_notification(
    channel_id: str,
    payload: NotificationChannelUpdate,
    notifications: NotificationService = Depends(get_notification_service),
) -> NotificationChannelOut:
    return await notifications.update(channel_id, payload)


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    channel_id: str, notifications: NotificationService = Depends(get_notification_service)
) -> None:
    await notifications.delete(channel_id)


@router.post("/{channel_id}/test", response_model=NotificationTestResult)
async def test_notification(
    channel_id: str, notifications: NotificationService = Depends(get_notification_service)
) -> NotificationTestResult:
    try:
        await notifications.test(channel_id)
    except NotificationFailedError as exc:
        return NotificationTestResult(success=False, message=exc.message)
    return NotificationTestResult(success=True, message="Test notification sent successfully.")
