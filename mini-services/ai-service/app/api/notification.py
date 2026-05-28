from __future__ import annotations

"""
Notification API endpoints.
Sends notifications through configured channels.
"""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.notifications.dispatcher import get_dispatcher

logger = logging.getLogger(__name__)

router = APIRouter()


class SendNotificationRequest(BaseModel):
    """Request body for sending a notification."""
    channel: str  # wechat | feishu | telegram | email | webhook
    title: str
    content: str
    to: Optional[str] = None  # For email: recipient address


class BroadcastNotificationRequest(BaseModel):
    """Request body for broadcasting to all channels."""
    title: str
    content: str


@router.post("/notifications/send")
async def send_notification(request: SendNotificationRequest) -> dict:
    """Send a notification to a specific channel."""
    dispatcher = get_dispatcher()
    result = await dispatcher.send(
        channel=request.channel,
        title=request.title,
        content=request.content,
        to=request.to,
    )
    return result


@router.post("/notifications/broadcast")
async def broadcast_notification(request: BroadcastNotificationRequest) -> dict:
    """Send a notification to all configured channels."""
    dispatcher = get_dispatcher()
    result = await dispatcher.send_all(
        title=request.title,
        content=request.content,
    )
    return result


@router.get("/notifications/channels")
async def list_channels() -> dict:
    """List all available notification channels and their status."""
    dispatcher = get_dispatcher()
    channels = dispatcher.list_channels()
    return {"success": True, "data": {"channels": channels}, "error": None}
