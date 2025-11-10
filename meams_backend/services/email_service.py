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
                "name": "MEAMS"  # Your app name
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
