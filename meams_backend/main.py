from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from config import API_TITLE, API_VERSION, ALLOWED_ORIGINS
from database import connect_db
from routers import help_support
import time

app = FastAPI(title=API_TITLE, version=API_VERSION)

# CORS Middleware - uses ALLOWED_ORIGINS from config.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Monitor request performance"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    # Log performance
    if process_time > 2.0:
        print(f"[SLOW] {request.method} {request.url.path} took {process_time:.2f}s")
    elif process_time > 1.0:
        print(f"[WARNING] {request.method} {request.url.path} took {process_time:.2f}s")
    else:
        print(f"[OK] {request.method} {request.url.path} - {process_time:.3f}s")
    
    return response

@app.on_event("startup")
async def startup_event():
    connect_db()
    print("=" * 50)
    print("MEAMS API Started Successfully")
    print("=" * 50)

# Import all routers
from routers import (
    auth, supplies, equipment, profile, 
    logs, accounts, export, forecast, 
    bulk_import, misc, dashboard
)

# Include all routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(supplies.router)
app.include_router(equipment.router)
app.include_router(profile.router)
app.include_router(logs.router)
app.include_router(accounts.router)
app.include_router(export.router)
app.include_router(forecast.router)
app.include_router(bulk_import.router)
app.include_router(misc.router)
app.include_router(help_support.router, tags=["help-support"])

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "MEAMS API is running!",
        "status": "active",
        "version": API_VERSION
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    from database import client
    from datetime import datetime
    try:
        client.admin.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }

# 🔥 EMAIL TEST ENDPOINT - UPDATED FOR RESEND
@app.get("/test-email-config")
async def test_email_config():
    """Test Resend email configuration"""
    from services.email_service import test_email_configuration, send_email
    
    print("\n" + "="*70)
    print("RESEND EMAIL CONFIGURATION TEST")
    print("="*70)
    
    # Test configuration first
    config_test = await test_email_configuration()
    
    print(f"\nConfiguration Test Result: {config_test}")
    
    if not config_test["success"]:
        return {
            "success": False,
            "config": config_test,
            "test_email_sent": False,
            "message": "Configuration error - fix this first",
            "action": config_test.get("action", "Check RESEND_API_KEY in .env")
        }
    
    # Configuration is good, try sending test email to your actual email
    print("\n" + "="*70)
    print("SENDING TEST EMAIL TO YOUR INBOX")
    print("="*70)
    
    test_sent = await send_email(
        "meamsds42@gmail.com",  # Your email
        "MEAMS - Resend Email Test SUCCESS! ✅",
        """
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="color: #28a745; margin-top: 0;">✅ Resend Configuration Working!</h1>
                <p style="font-size: 16px;">Your MEAMS email service is now using <strong>Resend</strong> and working correctly.</p>
                <p style="font-size: 16px;">Password reset emails will now be delivered instantly!</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <h3 style="color: #007bff;">What changed:</h3>
                <ul style="font-size: 14px; color: #666;">
                    <li>✅ Switched from Gmail SMTP to Resend API</li>
                    <li>✅ Faster email delivery</li>
                    <li>✅ Better reliability</li>
                    <li>✅ No more network timeout issues</li>
                </ul>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="color: #666; font-size: 12px; margin-bottom: 0;">
                    This is a test email from your MEAMS backend using Resend API
                </p>
            </div>
        </body>
        </html>
        """
    )
    
    if test_sent:
        return {
            "success": True,
            "config": config_test,
            "test_email_sent": True,
            "message": "✅ SUCCESS! Check your inbox at meamsds42@gmail.com",
            "next_step": "Try the forgot password feature now!"
        }
    else:
        return {
            "success": False,
            "config": config_test,
            "test_email_sent": False,
            "message": "❌ Failed to send test email",
            "action": "Check Render logs for detailed error"
        }

# 🔥 FORGOT PASSWORD TEST - UPDATED FOR RESEND
@app.post("/test-forgot-password")
async def test_forgot_password(email: str):
    """Quick test of forgot password flow with Resend"""
    from database import get_accounts_collection
    from services.email_service import send_password_reset_email
    from config import FRONTEND_URL
    import secrets
    from datetime import datetime, timedelta
    from models.password_reset import create_password_reset_token, is_token_valid
    
    print(f"\n{'='*70}")
    print(f"TESTING FORGOT PASSWORD FOR: {email}")
    print(f"{'='*70}")
    
    accounts_collection = get_accounts_collection()
    
    # Check if user exists
    user = accounts_collection.find_one({"email": email})
    
    if not user:
        print(f"❌ No user found with email: {email}")
        
        # Show available emails in database
        all_users = list(accounts_collection.find({}, {"email": 1, "username": 1, "name": 1}))
        available_emails = [u.get('email', 'N/A') for u in all_users if u.get('email')]
        
        print(f"\n📋 Available emails in database:")
        for u in all_users:
            print(f"   - {u.get('email', 'N/A')} ({u.get('name', 'N/A')})")
        
        return {
            "success": False,
            "error": "User not found",
            "available_emails": available_emails,
            "message": f"No user with email '{email}' found in database"
        }
    
    print(f"✓ User found: {user.get('name')} ({user.get('username')})")
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    
    print(f"✓ Token generated: {reset_token[:20]}...")
    
    # Create token data
    token_data = create_password_reset_token(reset_token, expires_in_hours=1)
    
    # Update database with token
    accounts_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                **token_data,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    print(f"✓ Database updated with reset token")
    
    # Create reset link
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    print(f"✓ Reset link: {reset_link}")
    
    # Send email using Resend
    print("📧 Sending email via Resend...")
    
    email_sent = await send_password_reset_email(
        to_email=email,
        reset_token=reset_token,
        user_name=user.get('name', 'User')
    )
    
    print(f"{'='*70}\n")
    
    if email_sent:
        return {
            "success": True,
            "user_found": True,
            "username": user.get('username'),
            "name": user.get('name'),
            "email": email,
            "reset_token": reset_token,
            "reset_link": reset_link,
            "email_sent": True,
            "message": "✅ Password reset email sent via Resend! Check inbox.",
            "check_inbox": "meamsds42@gmail.com" if email == "meamsds42@gmail.com" else email
        }
    else:
        return {
            "success": False,
            "user_found": True,
            "email_sent": False,
            "message": "❌ Failed to send email via Resend - check logs",
            "action": "Check Render logs for Resend API error details"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)