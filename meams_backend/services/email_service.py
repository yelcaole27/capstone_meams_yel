"""
Email service - handles email sending operations using Brevo API
"""
import httpx
from config import BREVO_API_KEY, EMAIL_FROM

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
    """
    Send bug report notification email
    
    Args:
        user_email: Email of the user reporting the bug
        bug_description: Description of the bug
        user_name: Optional name of the user
        
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    subject = f"Bug Report from {user_name or user_email}"
    
    # HTML email body
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
    
    # Send to your support email (you can configure this in config.py)
    support_email = EMAIL_FROM  # Or create a separate SUPPORT_EMAIL in config
    
    return await send_email(support_email, subject, body)
