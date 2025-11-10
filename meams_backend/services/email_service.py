"""
Email service - handles email sending operations using Resend API
Resend is more reliable than Gmail SMTP for production deployments
"""
import os
import httpx
from typing import Optional
from config import EMAIL_FROM, FRONTEND_URL

# Get Resend API key from environment
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Send email using Resend API (more reliable than SMTP)
    Sign up at https://resend.com/api-keys to get your API key
    """
    if not RESEND_API_KEY:
        print("❌ ERROR: RESEND_API_KEY not configured in .env file")
        print("📝 Get your API key from: https://resend.com/api-keys")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": EMAIL_FROM,
                    "to": [to_email],
                    "subject": subject,
                    "html": body,
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                print(f"✅ Email sent successfully to {to_email}")
                return True
            else:
                print(f"❌ Resend API error: {response.status_code}")
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
    if not RESEND_API_KEY:
        return {
            "success": False,
            "error": "RESEND_API_KEY not configured",
            "action": "Add RESEND_API_KEY to your .env file. Get it from https://resend.com/api-keys",
            "get_key_url": "https://resend.com/api-keys"
        }
    
    if not EMAIL_FROM:
        return {
            "success": False,
            "error": "EMAIL_FROM not configured",
            "action": "Add EMAIL_FROM to your .env file (e.g., 'MEAMS <onboarding@resend.dev>')"
        }
    
    return {
        "success": True,
        "message": "Email configuration looks good",
        "api_key_set": "Yes (✓)",
        "from_address": EMAIL_FROM,
        "note": "Using Resend API (reliable for production deployments)"
    }


async def send_to_verified_email_only(to_email: str, reset_token: str, user_name: str, original_email: str) -> bool:
    """
    Workaround for Resend free tier limitation
    Sends to meamsds42@gmail.com but includes original email in message
    """
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    subject = f"MEAMS - Password Reset for {original_email}"
    
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
                                <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Password Reset Request</p>
                            </td>
                        </tr>
                        
                        <!-- Notice about test mode -->
                        <tr>
                            <td style="background-color: #fff3cd; padding: 15px 20px; border-bottom: 2px solid #ffc107;">
                                <p style="margin: 0; color: #856404; font-size: 13px; text-align: center;">
                                    ℹ️ <strong>Admin Notice:</strong> Reset request for user <strong>{original_email}</strong>
                                </p>
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
                                    A password reset was requested for the account: <strong>{original_email}</strong>
                                </p>
                                
                                <p style="margin: 0 0 25px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                                    Click the button below to reset the password:
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
                                    Share this reset link with <strong>{original_email}</strong> to complete the password reset.
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
