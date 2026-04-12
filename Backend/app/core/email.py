"""
Email service for sending verification emails.
Supports both verification codes and magic links.
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import (
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USERNAME,
    EMAIL_PASSWORD,
    EMAIL_FROM,
    EMAIL_FROM_NAME,
    FRONTEND_URL
)
import random
import string
import secrets
from datetime import datetime, timedelta


def generate_verification_code() -> str:
    """Generate a 6-digit verification code."""
    return ''.join(random.choices(string.digits, k=6))


def generate_verification_token() -> str:
    """Generate a secure random token for magic links."""
    return secrets.token_urlsafe(32)


def get_verification_code_expiry() -> datetime:
    """Get expiry time for verification code (15 minutes from now)."""
    return datetime.utcnow() + timedelta(minutes=15)


def get_verification_token_expiry() -> datetime:
    """Get expiry time for verification token (24 hours from now)."""
    return datetime.utcnow() + timedelta(hours=24)


def get_reset_code_expiry() -> datetime:
    """Get expiry time for password reset code (15 minutes from now)."""
    return datetime.utcnow() + timedelta(minutes=15)


def get_reset_token_expiry() -> datetime:
    """Get expiry time for password reset token (15 minutes from now)."""
    return datetime.utcnow() + timedelta(minutes=15)


def create_verification_email_html(username: str, code: str, token: str) -> str:
    """Create HTML email template with both code and magic link."""
    magic_link = f"{FRONTEND_URL}/verify-email?token={token}"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .container {{
                background-color: #f9f9f9;
                border-radius: 10px;
                padding: 30px;
                margin: 20px 0;
            }}
            .header {{
                text-align: center;
                color: #4F46E5;
                margin-bottom: 30px;
            }}
            .code-box {{
                background-color: #4F46E5;
                color: white;
                font-size: 32px;
                font-weight: bold;
                text-align: center;
                padding: 20px;
                border-radius: 8px;
                letter-spacing: 8px;
                margin: 20px 0;
            }}
            .button {{
                display: inline-block;
                background-color: #4F46E5;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
            }}
            .divider {{
                text-align: center;
                margin: 30px 0;
                color: #666;
            }}
            .footer {{
                text-align: center;
                color: #666;
                font-size: 12px;
                margin-top: 30px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Verify Your Email</h1>
            </div>

            <p>Hi {username or "there"},</p>

            <p>Thank you for signing up! To complete your registration, please verify your email address.</p>

            <h3>Option 1: Enter this code</h3>
            <div class="code-box">{code}</div>
            <p style="text-align: center; color: #666;">This code expires in 15 minutes</p>

            <div class="divider">
                <p>- OR -</p>
            </div>

            <h3>Option 2: Click the button below</h3>
            <p style="text-align: center;">
                <a href="{magic_link}" style="display: inline-block; background-color: #4F46E5; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">Verify Email</a>
            </p>
            <p style="text-align: center; color: #666; font-size: 12px;">
                This link expires in 24 hours
            </p>

            <div class="footer">
                <p>If you didn't sign up for this account, you can safely ignore this email.</p>
                <p>Need help? Contact our support team.</p>
            </div>
        </div>
    </body>
    </html>
    """


def create_verification_email_text(username: str, code: str, token: str) -> str:
    """Create plain text email template (fallback)."""
    magic_link = f"{FRONTEND_URL}/verify-email?token={token}"

    return f"""
    Hi {username or "there"},

    Thank you for signing up! To complete your registration, please verify your email address.

    OPTION 1: Enter this verification code:
    {code}
    (This code expires in 15 minutes)

    OPTION 2: Click this link to verify:
    {magic_link}
    (This link expires in 24 hours)

    If you didn't sign up for this account, you can safely ignore this email.

    Need help? Contact our support team.

    ---
    AI Pilot Team
    """


def send_verification_email(to_email: str, username: str, code: str, token: str) -> bool:
    """
    Send verification email with both code and magic link.

    Args:
        to_email: Recipient email address
        username: User's username
        code: 6-digit verification code
        token: Magic link token

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Check if email credentials are configured
        if not EMAIL_USERNAME or not EMAIL_PASSWORD:
            print("Warning: Email credentials not configured. Email not sent.")
            print(f"Verification code for {to_email}: {code}")
            print(f"Verification token: {token}")
            return False

        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Verify Your Email - AI Pilot'
        msg['From'] = f'{EMAIL_FROM_NAME} <{EMAIL_FROM}>'
        msg['To'] = to_email

        # Create plain text and HTML versions
        text_content = create_verification_email_text(username, code, token)
        html_content = create_verification_email_html(username, code, token)

        # Attach both versions
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)

        # Send email - use SSL for port 465, TLS for port 587
        if EMAIL_PORT == 465:
            with smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT, context=ssl.create_default_context()) as server:
                server.ehlo()
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.send_message(msg)

        print(f"✅ Verification email sent to {to_email}")
        return True

    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {str(e)}")
        print(f"Verification code (for testing): {code}")
        print(f"Verification token (for testing): {token}")
        return False


def send_welcome_email(to_email: str, username: str) -> bool:
    """Send welcome email after successful verification."""
    try:
        if not EMAIL_USERNAME or not EMAIL_PASSWORD:
            print("Warning: Email credentials not configured. Welcome email not sent.")
            return False

        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Welcome to AI Pilot!'
        msg['From'] = f'{EMAIL_FROM_NAME} <{EMAIL_FROM}>'
        msg['To'] = to_email

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background-color: #f9f9f9;
                    border-radius: 10px;
                    padding: 30px;
                }}
                .header {{
                    text-align: center;
                    color: #4F46E5;
                }}
                .button {{
                    display: inline-block;
                    background-color: #4F46E5;
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to AI Pilot!</h1>
                </div>
                <p>Hi {username},</p>
                <p>Your email has been verified successfully! You can now access all features of AI Pilot.</p>
                <p style="text-align: center;">
                    <a href="{FRONTEND_URL}/dashboard" style="display: inline-block; background-color: #4F46E5; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">Go to Dashboard</a>
                </p>
                <p>Happy learning!</p>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Hi {username},

        Welcome to AI Pilot!

        Your email has been verified successfully! You can now access all features.

        Visit your dashboard: {FRONTEND_URL}/dashboard

        Happy learning!
        """

        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)

        # Send email - use SSL for port 465, TLS for port 587
        if EMAIL_PORT == 465:
            with smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT) as server:
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
                server.starttls()
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.send_message(msg)

        print(f"✅ Welcome email sent to {to_email}")
        return True

    except Exception as e:
        print(f"❌ Failed to send welcome email: {str(e)}")
        return False


def create_reset_password_email_html(username: str, code: str, token: str) -> str:
    """Create HTML email template for password reset with both code and magic link."""
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .container {{
                background-color: #f9f9f9;
                border-radius: 10px;
                padding: 30px;
                margin: 20px 0;
            }}
            .header {{
                text-align: center;
                color: #4F46E5;
                margin-bottom: 30px;
            }}
            .code-box {{
                background-color: #4F46E5;
                color: white;
                font-size: 32px;
                font-weight: bold;
                text-align: center;
                padding: 20px;
                border-radius: 8px;
                letter-spacing: 8px;
                margin: 20px 0;
            }}
            .button {{
                display: inline-block;
                background-color: #4F46E5;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
            }}
            .divider {{
                text-align: center;
                margin: 30px 0;
                color: #666;
            }}
            .footer {{
                text-align: center;
                color: #666;
                font-size: 12px;
                margin-top: 30px;
            }}
            .warning {{
                background-color: #FEF3C7;
                border-left: 4px solid #F59E0B;
                padding: 12px;
                margin: 20px 0;
                border-radius: 4px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Reset Your Password</h1>
            </div>

            <p>Hi {username or "there"},</p>

            <p>We received a request to reset your password for your AI Pilot account. If you didn't make this request, you can safely ignore this email.</p>

            <h3>Option 1: Enter this code</h3>
            <div class="code-box">{code}</div>
            <p style="text-align: center; color: #666;">This code expires in 15 minutes</p>

            <div class="divider">
                <p>- OR -</p>
            </div>

            <h3>Option 2: Click the button below</h3>
            <p style="text-align: center;">
                <a href="{reset_link}" style="display: inline-block; background-color: #4F46E5; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">Reset Password</a>
            </p>
            <p style="text-align: center; color: #666; font-size: 12px;">
                This link expires in 15 minutes
            </p>

            <div class="warning">
                <p style="margin: 0; color: #92400E;"><strong>Security tip:</strong> If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
            </div>

            <div class="footer">
                <p>This is an automated message from AI Pilot. Please do not reply to this email.</p>
                <p>Need help? Contact our support team.</p>
            </div>
        </div>
    </body>
    </html>
    """


def create_reset_password_email_text(username: str, code: str, token: str) -> str:
    """Create plain text email template for password reset (fallback)."""
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    return f"""
    Hi {username or "there"},

    We received a request to reset your password for your AI Pilot account.

    If you didn't make this request, you can safely ignore this email.

    OPTION 1: Enter this reset code:
    {code}
    (This code expires in 15 minutes)

    OPTION 2: Click this link to reset your password:
    {reset_link}
    (This link expires in 15 minutes)

    SECURITY TIP: If you didn't request a password reset, please ignore this email
    or contact support if you have concerns about your account security.

    This is an automated message from AI Pilot. Please do not reply to this email.
    Need help? Contact our support team.

    ---
    AI Pilot Team
    """


def send_reset_password_email(to_email: str, username: str, code: str, token: str) -> bool:
    """
    Send password reset email with both code and magic link.

    Args:
        to_email: Recipient email address
        username: User's username
        code: 6-digit reset code
        token: Magic link token

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Check if email credentials are configured
        if not EMAIL_USERNAME or not EMAIL_PASSWORD:
            print("Warning: Email credentials not configured. Email not sent.")
            print(f"Password reset code for {to_email}: {code}")
            print(f"Password reset token: {token}")
            return False

        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Reset Your Password - AI Pilot'
        msg['From'] = f'{EMAIL_FROM_NAME} <{EMAIL_FROM}>'
        msg['To'] = to_email

        # Create plain text and HTML versions
        text_content = create_reset_password_email_text(username, code, token)
        html_content = create_reset_password_email_html(username, code, token)

        # Attach both versions
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)

        # Send email - use SSL for port 465, TLS for port 587
        if EMAIL_PORT == 465:
            with smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT, context=ssl.create_default_context()) as server:
                server.ehlo()
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.send_message(msg)

        print(f"✅ Password reset email sent to {to_email}")
        return True

    except Exception as e:
        print(f"❌ Failed to send password reset email to {to_email}: {str(e)}")
        print(f"Reset code (for testing): {code}")
        print(f"Reset token (for testing): {token}")
        return False
