"""
Email service - Resend API (replaces Gmail SMTP)
"""
import resend
import os
from config import RESEND_API_KEY, EMAIL_FROM

# Initialize Resend
resend.api_key = RESEND_API_KEY

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Send email via Resend API with detailed logging
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        body: HTML email body
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        print(f"\n{'='*70}")
        print(f"📧 EMAIL SENDING ATTEMPT (RESEND)")
        print(f"{'='*70}")
        print(f"To: {to_email}")
        print(f"From: {EMAIL_FROM}")
        print(f"Subject: {subject}")
        print(f"API Key configured: {'Yes' if RESEND_API_KEY else 'No'}")
        
        # Validation
        if not RESEND_API_KEY:
            print("❌ ERROR: RESEND_API_KEY is not set!")
            print("   Set RESEND_API_KEY in your .env file")
            return False
        
        if not RESEND_API_KEY.startswith('re_'):
            print("⚠️  WARNING: API key doesn't look correct (should start with 're_')")
        
        print("✓ Configuration validated")
        
        # Prepare email parameters
        print("⏳ Preparing email...")
        params = {
            "from": EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "html": body,
        }
        
        # Send email via Resend
        print("⏳ Sending email via Resend API...")
        email = resend.Emails.send(params)
        
        print("✓ EMAIL SENT SUCCESSFULLY!")
        print(f"✓ Email ID: {email['id']}")
        print(f"{'='*70}")
        print(f"✅ SUCCESS: Email sent to {to_email}")
        print(f"{'='*70}\n")
        
        return True
        
    except Exception as e:
        print(f"\n{'='*70}")
        print(f"❌ EMAIL SENDING FAILED")
        print(f"{'='*70}")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print(f"\n🔧 HOW TO FIX:")
        print(f"1. Check your Resend API key is correct")
        print(f"2. Verify API key at: https://resend.com/api-keys")
        print(f"3. Make sure API key starts with 're_'")
        print(f"4. Check if you have remaining quota (3,000 free emails/month)")
        print(f"5. View logs at: https://resend.com/logs")
        print(f"{'='*70}\n")
        
        return False


async def test_email_configuration() -> dict:
    """
    Test email configuration with Resend
    
    Returns:
        dict: Test results with success status and message
    """
    try:
        print(f"\n{'='*70}")
        print("🧪 TESTING RESEND CONFIGURATION")
        print(f"{'='*70}")
        
        # Check if API key is set
        if not RESEND_API_KEY:
            return {
                "success": False,
                "message": "RESEND_API_KEY not set",
                "action": "Add RESEND_API_KEY to your .env file"
            }
        
        # Check API key format
        if not RESEND_API_KEY.startswith('re_'):
            return {
                "success": False,
                "message": f"Invalid API key format (should start with 're_')",
                "action": "Get valid API key from https://resend.com/api-keys"
            }
        
        print(f"✓ API Key: {RESEND_API_KEY[:10]}...")
        print(f"✓ From Email: {EMAIL_FROM}")
        
        # Try to send a test email (to verify credentials)
        test_params = {
            "from": EMAIL_FROM,
            "to": ["delivered@resend.dev"],  # Resend test address
            "subject": "MEAMS Configuration Test",
            "html": "<p>Test email from MEAMS</p>"
        }
        
        print("⏳ Attempting to send test email...")
        email = resend.Emails.send(test_params)
        
        print(f"✓ Test email sent successfully!")
        print(f"✓ Email ID: {email['id']}")
        print(f"{'='*70}\n")
        
        return {
            "success": True,
            "message": "✅ Resend is configured correctly!",
            "email_from": EMAIL_FROM,
            "test_email_id": email['id']
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Configuration test failed: {error_msg}")
        print(f"{'='*70}\n")
        
        # Provide specific error messages
        if "Invalid API key" in error_msg or "401" in error_msg:
            return {
                "success": False,
                "message": "Invalid API key",
                "action": "Generate new API key at https://resend.com/api-keys"
            }
        elif "Rate limit" in error_msg or "429" in error_msg:
            return {
                "success": False,
                "message": "Rate limit exceeded",
                "action": "Wait a moment or check your quota at https://resend.com"
            }
        else:
            return {
                "success": False,
                "message": f"Configuration test failed: {error_msg}",
                "action": "Check Resend dashboard at https://resend.com"
            }


async def send_password_reset_email(to_email: str, reset_token: str, user_name: str = "User") -> bool:
    """
    Send password reset email with formatted template
    
    Args:
        to_email: Recipient email address
        reset_token: Password reset token
        user_name: User's name for personalization
    
    Returns:
        bool: True if email sent successfully
    """
    from config import FRONTEND_URL
    
    # Create reset link
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    # Email subject
    subject = "MEAMS - Password Reset Request"
    
    # Email body with HTML template
    body = f"""
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
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
            }}
            .header h1 {{
                color: #2c3e50;
                margin: 0;
            }}
            .content {{
                background-color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 20px 0;
            }}
            .button {{
                display: inline-block;
                padding: 12px 30px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
            }}
            .token-box {{
                background-color: #ecf0f1;
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
                word-break: break-all;
                font-family: monospace;
                font-size: 14px;
            }}
            .footer {{
                text-align: center;
                margin-top: 30px;
                color: #7f8c8d;
                font-size: 12px;
            }}
            .warning {{
                color: #d32f2f;
                font-weight: bold;
                margin-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 MEAMS Password Reset</h1>
            </div>
            
            <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hello {user_name},</p>
                <p>We received a request to reset your password for your MEAMS account. Click the button below to reset your password:</p>
                
                <center>
                    <a href="{reset_link}" class="button">Reset Password</a>
                </center>
                
                <p>Or copy and paste this link into your browser:</p>
                <div class="token-box">{reset_link}</div>
                
                <p class="warning">⚠️ This link will expire in 1 hour.</p>
                
                <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            
            <div class="footer">
                <p>© 2024 MEAMS System. All rights reserved.</p>
                <p>This is an automated message, please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email(to_email, subject, body)