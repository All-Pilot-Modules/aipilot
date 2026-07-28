"""
Manual test script for the email service (app/core/email.py).
Sends a real email using whatever EMAIL_* credentials are set in .env.

Usage:
    python scripts/test_email.py you@example.com
    python scripts/test_email.py you@example.com --type welcome
    python scripts/test_email.py you@example.com --type reset
    python scripts/test_email.py you@example.com --type all
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_FROM
from app.core.email import (
    generate_verification_code,
    generate_verification_token,
    send_verification_email,
    send_welcome_email,
    send_reset_password_email,
)


def main():
    parser = argparse.ArgumentParser(description="Send a test email via the configured SMTP settings")
    parser.add_argument("to_email", help="Recipient email address")
    parser.add_argument(
        "--type",
        choices=["verify", "welcome", "reset", "all"],
        default="verify",
        help="Which email template to send (default: verify)",
    )
    parser.add_argument("--username", default="Test User", help="Username to render in the template")
    args = parser.parse_args()

    print(f"SMTP host: {EMAIL_HOST}:{EMAIL_PORT}")
    print(f"From:      {EMAIL_FROM}")
    print(f"Auth user: {EMAIL_USERNAME or '(not set)'}")
    print(f"Sending to: {args.to_email}")
    print("-" * 40)

    if not EMAIL_USERNAME:
        print("EMAIL_USERNAME / EMAIL_PASSWORD not set in .env — send_* calls will no-op and just print codes.")

    results = {}

    if args.type in ("verify", "all"):
        code = generate_verification_code()
        token = generate_verification_token()
        print(f"[verify] code={code}")
        results["verify"] = send_verification_email(args.to_email, args.username, code, token)

    if args.type in ("welcome", "all"):
        results["welcome"] = send_welcome_email(args.to_email, args.username)

    if args.type in ("reset", "all"):
        code = generate_verification_code()
        token = generate_verification_token()
        print(f"[reset] code={code}")
        results["reset"] = send_reset_password_email(args.to_email, args.username, code, token)

    print("-" * 40)
    for name, ok in results.items():
        print(f"{name}: {'sent' if ok else 'FAILED'}")

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
