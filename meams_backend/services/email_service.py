"""
Email service - handles email sending operations
"""
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import os

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email using SendGrid API"""
    try:
        message = Mail(
            from_email=os.getenv('EMAIL_FROM', 'noreply@yourdomain.com'),
            to_emails=to_email,
            subject=subject,
            html_content=body
        )
        
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        response = sg.send(message)
        
        print(f"✓ Email sent successfully to {to_email} (Status: {response.status_code})")
        return response.status_code == 202
    except Exception as e:
        print(f"✗ Failed to send email to {to_email}: {str(e)}")
        return False