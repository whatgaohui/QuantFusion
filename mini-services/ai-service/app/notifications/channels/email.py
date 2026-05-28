from __future__ import annotations

"""
Email (SMTP) notification channel.
Sends notifications via email using SMTP.
"""

import logging
from typing import Any

from app.notifications.channels.base import BaseNotificationChannel

logger = logging.getLogger(__name__)


class EmailChannel(BaseNotificationChannel):
    """Email SMTP notification channel."""

    def __init__(
        self,
        smtp_host: str = "",
        smtp_port: int = 587,
        smtp_user: str = "",
        smtp_password: str = "",
        from_addr: str = "",
    ) -> None:
        super().__init__(name="email")
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_addr = from_addr

    async def send(
        self,
        title: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send notification via email."""
        to_addr = kwargs.get("to", self.smtp_user)
        if not to_addr:
            return {"success": False, "error": "No recipient email address"}

        # Note: In a production implementation, this would use aiosmtplib
        # for async email sending. This is a skeleton.
        try:
            import aiosmtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart()
            msg["From"] = self.from_addr or self.smtp_user
            msg["To"] = to_addr
            msg["Subject"] = title
            msg.attach(MIMEText(content, "html"))

            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                use_tls=True,
            )

            return {"success": True, "sent_to": to_addr}
        except ImportError:
            # aiosmtplib not installed - fallback to sync
            logger.warning("aiosmtplib not installed, email sending skipped")
            return {"success": False, "error": "aiosmtplib not installed"}
        except Exception as e:
            logger.error(f"Email notification failed: {e}")
            return {"success": False, "error": str(e)}

    def is_configured(self) -> bool:
        """Check if SMTP settings are configured."""
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)
