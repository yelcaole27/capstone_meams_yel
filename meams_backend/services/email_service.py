"""
Email service - handles email sending operations
Now with SendGrid as backup option
"""
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from config import EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_FROM

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check if SendGrid is available
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
USE_SENDGRID = SENDGRID_API_KEY is not None

if USE_SENDGRID:
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content
        logger.info("SendGrid is configured and will be used for email sending")
    except ImportError:
        logger.warning("SendGrid library not installed. Install with: pip install sendgrid")
        USE_SENDGRID = False

async def send_email_sendgrid(to_email: str, subject: str, body: str) -> bool:
    """Send email using SendGrid API"""
    try:
        logger.info(f"Attempting to send email via SendGrid to: {to_email}")
        
        message = Mail(
            from_email=EMAIL_FROM,
            to_emails=to_email,
            subject=subject,
            html_content=body
        )
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        
        if response.status_code in [200, 202]:
            logger.info(f"✓ Email sent successfully via SendGrid to {to_email}")
            return True
        else:
            logger.error(f"✗ SendGrid returned status code: {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"✗ SendGrid error: {type(e).__name__}: {str(e)}")
        return False

async def send_email_smtp(to_email: str, subject: str, body: str) -> bool:
    """Send email using SMTP (Gmail)"""
    try:
        logger.info(f"Attempting to send email via SMTP to: {to_email}")
        logger.info(f"Using SMTP server: {EMAIL_HOST}:{EMAIL_PORT}")
        logger.info(f"From address: {EMAIL_FROM}")
        logger.info(f"Username: {EMAIL_USERNAME}")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Attach HTML body
        html_part = MIMEText(body, 'html', 'utf-8')
        msg.attach(html_part)
        
        # Create SSL context
        context = ssl.create_default_context()
        
        logger.info("Connecting to SMTP server...")
        
        # Connect and send
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=30) as server:
            logger.info("Connected. Starting TLS...")
            server.starttls(context=context)
            
            logger.info("TLS started. Logging in...")
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            
            logger.info("Logged in. Sending email...")
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        
        logger.info(f"✓ Email sent successfully via SMTP to {to_email}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"✗ SMTP Authentication failed: {str(e)}")
        logger.error("Check EMAIL_USERNAME and EMAIL_PASSWORD are correct")
        return False
        
    except smtplib.SMTPException as e:
        logger.error(f"✗ SMTP error: {str(e)}")
        return False
        
    except ssl.SSLError as e:
        logger.error(f"✗ SSL error: {str(e)}")
        return False
        
    except ConnectionRefusedError as e:
        logger.error(f"✗ Connection refused: {str(e)}")
        logger.error(f"Cannot connect to {EMAIL_HOST}:{EMAIL_PORT}")
        return False
        
    except TimeoutError as e:
        logger.error(f"✗ Connection timeout: {str(e)}")
        return False
        
    except OSError as e:
        logger.error(f"✗ Network error: {str(e)}")
        logger.error("This might be a firewall or network restriction issue")
        logger.error("Consider using SendGrid instead - add SENDGRID_API_KEY to environment")
        return False
        
    except Exception as e:
        logger.error(f"✗ Unexpected error sending email to {to_email}: {type(e).__name__}: {str(e)}")
        logger.error(f"Error details: {repr(e)}")
        return False

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Send email with automatic fallback
    Tries SendGrid first (if configured), falls back to SMTP
    """
    # Try SendGrid first if available
    if USE_SENDGRID:
        logger.info("Using SendGrid as primary email service")
        result = await send_email_sendgrid(to_email, subject, body)
        if result:
            return True
        logger.warning("SendGrid failed, falling back to SMTP...")
    
    # Fall back to SMTP
    logger.info("Using SMTP as email service")
    return await send_email_smtp(to_email, subject, body)