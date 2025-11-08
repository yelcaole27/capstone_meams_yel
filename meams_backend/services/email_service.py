"""
Email service - handles email sending operations
"""
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_FROM

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email with HTML body"""
    try:
        logger.info(f"Attempting to send email to: {to_email}")
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
            server.set_debuglevel(1)  # Enable debug output
            server.starttls(context=context)
            
            logger.info("TLS started. Logging in...")
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            
            logger.info("Logged in. Sending email...")
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        
        logger.info(f"✓ Email sent successfully to {to_email}")
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
        return False
        
    except Exception as e:
        logger.error(f"✗ Unexpected error sending email to {to_email}: {type(e).__name__}: {str(e)}")
        logger.error(f"Error details: {repr(e)}")
        return False