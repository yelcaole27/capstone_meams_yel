"""
Email service - handles email sending operations using Brevo API
"""
import httpx
from config import BREVO_API_KEY, EMAIL_FROM, FRONTEND_URL

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email using Brevo API"""
    try:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json"
        }
        
        data = {
            "sender": {
                "email": EMAIL_FROM,
                "name": "MEAMS"
            },
            "to": [
                {"email": to_email}
            ],
            "subject": subject,
            "htmlContent": body
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=data, headers=headers)
            
            if response.status_code == 201:
                print(f"✓ Email sent successfully to {to_email}")
                return True
            else:
                print(f"✗ Brevo API error: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except httpx.TimeoutException:
        print(f"✗ Timeout sending email to {to_email}")
        return False
    except Exception as e:
        print(f"✗ Failed to send email to {to_email}: {str(e)}")
        return False


async def send_bug_report_notification(user_email: str, bug_description: str, user_name: str = None) -> bool:
    """Send bug report notification email"""
    subject = f"Bug Report from {user_name or user_email}"
    
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #d32f2f;">🐛 New Bug Report</h2>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Reporter:</strong> {user_name or 'Anonymous'}</p>
                <p><strong>Email:</strong> {user_email}</p>
                <p><strong>Description:</strong></p>
                <p style="white-space: pre-wrap;">{bug_description}</p>
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is an automated message from MEAMS Bug Report System
            </p>
        </body>
    </html>
    """
    
    support_email = EMAIL_FROM
    return await send_email(support_email, subject, body)


async def send_password_reset_email(to_email: str, reset_token: str, user_name: str = None) -> bool:
    """Send password reset email with reset link"""
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    subject = "Reset Your MEAMS Password"
    
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">MEAMS</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9f9f9;">
                <h2 style="color: #333;">Password Reset Request</h2>
                
                <p>Hi {user_name or 'there'},</p>
                
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" 
                       style="background-color: #667eea; color: white; padding: 15px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;
                              font-weight: bold;">
                        Reset Password
                    </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="{reset_link}" style="color: #667eea; word-break: break-all;">{reset_link}</a>
                </p>
                
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    <strong>Note:</strong> This link will expire in 1 hour for security reasons.
                </p>
                
                <p style="color: #666; font-size: 14px;">
                    If you didn't request a password reset, you can safely ignore this email.
                </p>
            </div>
            
            <div style="background-color: #333; color: #999; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">© 2024 MEAMS. All rights reserved.</p>
                <p style="margin: 5px 0 0 0;">This is an automated message, please do not reply.</p>
            </div>
        </body>
    </html>
    """
    
    return await send_email(to_email, subject, body)
