"""
Email service - Gmail SMTP with detailed debugging
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_FROM

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email via Gmail SMTP with detailed logging"""
    try:
        # Clean password - remove any spaces
        password = EMAIL_PASSWORD.replace(" ", "").strip() if EMAIL_PASSWORD else ""
        username = EMAIL_USERNAME.strip() if EMAIL_USERNAME else ""
        
        print(f"\n{'='*70}")
        print(f"📧 EMAIL SENDING ATTEMPT")
        print(f"{'='*70}")
        print(f"To: {to_email}")
        print(f"From: {EMAIL_FROM}")
        print(f"Username: {username}")
        print(f"Password length: {len(password)} characters")
        
        # Validation
        if not username:
            print("❌ ERROR: EMAIL_USERNAME is empty!")
            print("   Set EMAIL_USERNAME in Render environment variables")
            return False
        
        if not password:
            print("❌ ERROR: EMAIL_PASSWORD is empty!")
            print("   Set EMAIL_PASSWORD in Render environment variables")
            return False
        
        if len(password) != 16:
            print(f"⚠️  WARNING: Password length is {len(password)}, should be 16")
            print(f"   First 4 chars: '{password[:4] if password else 'NONE'}'")
            print(f"   Last 4 chars: '{password[-4:] if password else 'NONE'}'")
            print(f"   Generate new App Password at: https://myaccount.google.com/apppasswords")
        
        # Check for spaces (shouldn't happen after .replace() but double-check)
        if ' ' in password:
            print("❌ ERROR: Password still contains spaces after cleaning!")
            print(f"   Password: '{password}'")
            return False
        
        print("✓ Configuration validated")
        
        # Create email message
        print("⏳ Creating email message...")
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        print("✓ Message created")
        
        # Create SSL context
        print("⏳ Creating SSL context...")
        context = ssl.create_default_context()
        print("✓ SSL context ready")
        
        # Connect to Gmail SMTP
        print(f"⏳ Connecting to {EMAIL_HOST}:{EMAIL_PORT}...")
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=30) as server:
            print("✓ Connected to Gmail SMTP server")
            
            # Enable TLS
            print("⏳ Starting TLS encryption...")
            server.starttls(context=context)
            print("✓ TLS encryption enabled")
            
            # Login
            print("⏳ Authenticating with Gmail...")
            server.login(username, password)
            print("✓ Authentication SUCCESSFUL!")
            
            # Send email
            print("⏳ Sending email...")
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
            print("✓ EMAIL SENT SUCCESSFULLY!")
        
        print(f"{'='*70}")
        print(f"✅ SUCCESS: Email sent to {to_email}")
        print(f"{'='*70}\n")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n{'='*70}")
        print(f"❌ AUTHENTICATION FAILED")
        print(f"{'='*70}")
        print(f"Error code: {e.smtp_code if hasattr(e, 'smtp_code') else 'N/A'}")
        print(f"Error message: {e.smtp_error.decode() if hasattr(e, 'smtp_error') else str(e)}")
        print(f"\n🔧 HOW TO FIX:")
        print(f"1. Generate NEW App Password:")
        print(f"   → https://myaccount.google.com/apppasswords")
        print(f"2. Make sure 2-Step Verification is ON:")
        print(f"   → https://myaccount.google.com/security")
        print(f"3. Copy password WITHOUT spaces (16 characters)")
        print(f"4. Update EMAIL_PASSWORD in Render")
        print(f"5. Redeploy your backend")
        print(f"{'='*70}\n")
        return False
        
    except smtplib.SMTPRecipientsRefused as e:
        print(f"\n❌ RECIPIENT REFUSED: {str(e)}")
        print(f"   Email address '{to_email}' was rejected")
        print(f"   Check if email address is valid\n")
        return False
        
    except smtplib.SMTPException as e:
        print(f"\n❌ SMTP ERROR: {str(e)}")
        print(f"   General SMTP error occurred\n")
        return False
        
    except Exception as e:
        print(f"\n{'='*70}")
        print(f"❌ UNEXPECTED ERROR")
        print(f"{'='*70}")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print(f"{'='*70}\n")
        return False


async def test_email_configuration() -> dict:
    """Test email configuration"""
    try:
        password = EMAIL_PASSWORD.replace(" ", "").strip() if EMAIL_PASSWORD else ""
        username = EMAIL_USERNAME.strip() if EMAIL_USERNAME else ""
        
        if not username:
            return {
                "success": False,
                "message": "EMAIL_USERNAME not set",
                "action": "Set EMAIL_USERNAME in Render environment"
            }
        
        if not password:
            return {
                "success": False,
                "message": "EMAIL_PASSWORD not set",
                "action": "Set EMAIL_PASSWORD in Render environment"
            }
        
        if len(password) != 16:
            return {
                "success": False,
                "message": f"Invalid password length: {len(password)} (should be 16)",
                "action": "Generate new App Password and remove spaces"
            }
        
        # Try to connect
        context = ssl.create_default_context()
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=10) as server:
            server.starttls(context=context)
            server.login(username, password)
        
        return {
            "success": True,
            "message": "Email configuration is working!",
            "email": username,
            "password_length": len(password)
        }
        
    except smtplib.SMTPAuthenticationError:
        return {
            "success": False,
            "message": "Authentication failed",
            "action": "Generate NEW App Password at https://myaccount.google.com/apppasswords"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Test failed: {str(e)}"
        }