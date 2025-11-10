"""
Email service - Using SendGrid API
SendGrid free tier: 100 emails/day to ANY email address
No domain verification needed!
"""
import os
import httpx
from typing import Optional
from config import FRONTEND_URL

# Get SendGrid API key from environment
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "meamsds42@gmail.com")

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Send email using SendGrid API
    
    SendGrid Free Tier Benefits:
    - 100 emails/day FREE
    - Send to ANY email address (no verification needed)
    - Works reliably on all hosting platforms
    - Professional delivery
    
    Get API key from: https://app.sendgrid.com/settings/api_keys
    """
    if not SENDGRID_API_KEY:
        print("❌ ERROR: SENDGRID_API_KEY not configured in .env file")
        print("📝 Get your FREE API key from: https://app.sendgrid.com/settings/api_keys")
        print("   Sign up: https://signup.sendgrid.com/")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [
                        {
                            "to": [{"email": to_email}],
                            "subject": subject
                        }
                    ],
                    "from": {"email": EMAIL_FROM, "name": "MEAMS System"},
                    "content": [
                        {
                            "type": "text/html",
                            "value": body
                        }
                    ]
                },
                timeout=30.0
            )
            
            if response.status_code == 202:  # SendGrid returns 202 for success
                print(f"✅ Email sent successfully to {to_email}")
                return True
            else:
                print(f"❌ SendGrid API error: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {str(e)}")
        return False


async def send_password_reset_email(to_email: str, reset_token: str, user_name: str) -> bool:
    """Send password reset email with styled HTML"""
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    subject = "MEAMS - Password Reset Request"
    
    body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">MEAMS</h1>
                                <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Medical Equipment & Supplies Management</p>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Password Reset Request</h2>
                                
                                <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                                    Hello <strong>{user_name}</strong>,
                                </p>
                                
                                <p style="margin: 0 0 25px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                                    We received a request to reset your password. Click the button below to create a new password:
                                </p>
                                
                                <!-- Button -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding: 20px 0;">
                                            <a href="{reset_link}" 
                                               style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                                Reset Password
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="margin: 25px 0 15px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                                    Or copy and paste this link into your browser:
                                </p>
                                
                                <p style="margin: 0 0 25px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px; word-break: break-all; font-size: 13px; color: #495057; border-left: 3px solid #667eea;">
                                    {reset_link}
                                </p>
                                
                                <div style="margin: 30px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                                    <p style="margin: 0; color: #856404; font-size: 14px;">
                                        ⏰ <strong>Important:</strong> This link expires in <strong>1 hour</strong>
                                    </p>
                                </div>
                                
                                <p style="margin: 25px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                                    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                                <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
                                    This is an automated email from MEAMS System
                                </p>
                                <p style="margin: 0; color: #6c757d; font-size: 13px;">
                                    © 2024 MEAMS. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(to_email, subject, body)


async def send_bug_report_notification(admin_email: str, bug_report: dict) -> bool:
    """Send bug report notification to admin"""
    subject = f"🐛 New Bug Report from {bug_report['username']}"
    
    body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
            <h2 style="color: #dc3545; margin-top: 0;">🐛 New Bug Report</h2>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>From:</strong> {bug_report['username']}</p>
                <p style="margin: 5px 0;"><strong>Role:</strong> {bug_report['role']}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> {bug_report['timestamp']}</p>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
                <h3 style="margin-top: 0; color: #856404;">Issue Description:</h3>
                <p style="white-space: pre-wrap; color: #856404;">{bug_report['message']}</p>
            </div>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
                MEAMS Bug Report System
            </p>
        </div>
    </body>
    </html>
    """
    
    return await send_email(admin_email, subject, body)


async def test_email_configuration() -> dict:
    """Test email configuration"""
    if not SENDGRID_API_KEY:
        return {
            "success": False,
            "error": "SENDGRID_API_KEY not configured",
            "action": "Add SENDGRID_API_KEY to your .env file",
            "get_key_url": "https://app.sendgrid.com/settings/api_keys",
            "signup_url": "https://signup.sendgrid.com/"
        }
    
    if not EMAIL_FROM:
        return {
            "success": False,
            "error": "EMAIL_FROM not configured",
            "action": "Add EMAIL_FROM to your .env file (use your Gmail: meamsds42@gmail.com)"
        }
    
    return {
        "success": True,
        "message": "SendGrid email configuration looks good",
        "api_key_set": "Yes (✓)",
        "from_address": EMAIL_FROM,
        "provider": "SendGrid",
        "free_tier": "100 emails/day",
        "can_send_to": "ANY email address"
    }
