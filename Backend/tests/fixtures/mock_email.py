"""
Mock email/SMTP for testing email functionality.
"""
from typing import List, Dict, Optional
from unittest.mock import MagicMock, patch
from dataclasses import dataclass, field


@dataclass
class CapturedEmail:
    """Represents a captured email for testing."""
    to: str
    subject: str
    body: str
    html: Optional[str] = None
    from_addr: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None


class MockSMTPServer:
    """Mock SMTP server that captures sent emails."""

    def __init__(self):
        self.sent_emails: List[CapturedEmail] = []
        self.connected = False
        self.login_user: Optional[str] = None
        self.should_fail_connect = False
        self.should_fail_send = False

    def connect(self, host: str, port: int):
        """Mock SMTP connect."""
        if self.should_fail_connect:
            raise ConnectionRefusedError("Mock connection refused")
        self.connected = True
        return (220, "Mock SMTP ready")

    def starttls(self):
        """Mock STARTTLS."""
        return (220, "TLS started")

    def login(self, user: str, password: str):
        """Mock SMTP login."""
        self.login_user = user
        return (235, "Authentication successful")

    def sendmail(self, from_addr: str, to_addrs: List[str], msg: str):
        """Mock send email."""
        if self.should_fail_send:
            raise Exception("Mock send failed")

        # Parse the message to extract subject and body
        subject = ""
        body = ""
        if "Subject:" in msg:
            lines = msg.split("\n")
            for i, line in enumerate(lines):
                if line.startswith("Subject:"):
                    subject = line.replace("Subject:", "").strip()
                elif line == "" and i > 0:
                    body = "\n".join(lines[i+1:])
                    break

        for to_addr in to_addrs:
            self.sent_emails.append(CapturedEmail(
                to=to_addr,
                subject=subject,
                body=body,
                from_addr=from_addr
            ))

        return {}

    def quit(self):
        """Mock SMTP quit."""
        self.connected = False
        return (221, "Bye")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.quit()

    def clear(self):
        """Clear captured emails."""
        self.sent_emails.clear()

    def get_emails_to(self, recipient: str) -> List[CapturedEmail]:
        """Get all emails sent to a specific recipient."""
        return [e for e in self.sent_emails if e.to == recipient]

    def get_emails_with_subject(self, subject_contains: str) -> List[CapturedEmail]:
        """Get all emails with subject containing text."""
        return [e for e in self.sent_emails if subject_contains in e.subject]


# Global mock SMTP instance for test access
_mock_smtp = MockSMTPServer()


def get_mock_smtp() -> MockSMTPServer:
    """Get the global mock SMTP server instance."""
    return _mock_smtp


def reset_mock_smtp():
    """Reset the mock SMTP server state."""
    global _mock_smtp
    _mock_smtp = MockSMTPServer()


def patch_smtp():
    """Context manager to patch SMTP globally."""
    def create_mock_smtp(*args, **kwargs):
        return _mock_smtp

    return patch("smtplib.SMTP", create_mock_smtp)


def assert_email_sent(
    to: str,
    subject_contains: Optional[str] = None,
    body_contains: Optional[str] = None,
) -> CapturedEmail:
    """
    Assert that an email was sent matching the criteria.

    Args:
        to: Expected recipient email
        subject_contains: Optional substring to find in subject
        body_contains: Optional substring to find in body

    Returns:
        The matching CapturedEmail

    Raises:
        AssertionError if no matching email found
    """
    emails = _mock_smtp.get_emails_to(to)
    assert emails, f"No emails sent to {to}"

    for email in emails:
        if subject_contains and subject_contains not in email.subject:
            continue
        if body_contains and body_contains not in email.body:
            continue
        return email

    raise AssertionError(
        f"No email to {to} matching criteria. "
        f"Subject contains: {subject_contains}, Body contains: {body_contains}"
    )


def assert_no_email_sent():
    """Assert that no emails were sent."""
    assert len(_mock_smtp.sent_emails) == 0, (
        f"Expected no emails, but {len(_mock_smtp.sent_emails)} were sent"
    )


def assert_email_count(expected: int):
    """Assert the number of emails sent."""
    actual = len(_mock_smtp.sent_emails)
    assert actual == expected, f"Expected {expected} emails, got {actual}"
