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

# 🔥 EMAIL TEST ENDPOINT - ADD THIS!
@app.get("/test-email-config")
async def test_email_config():
    """Test email configuration and send test email"""
    from services.email_service import test_email_configuration, send_email
    
    print("\n" + "="*70)
    print("EMAIL CONFIGURATION TEST STARTED")
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
            "action": config_test.get("action", "Check environment variables")
        }
    
    # Configuration is good, try sending test email
    print("\n" + "="*70)
    print("ATTEMPTING TO SEND TEST EMAIL")
    print("="*70)
    
    test_sent = await send_email(
        "meamsds42@gmail.com",
        "MEAMS - Email Test SUCCESS!",
        """
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1 style="color: #28a745;">✅ Email Configuration Working!</h1>
            <p>Your MEAMS email service is configured correctly.</p>
            <p>Password reset emails will now work properly.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
                This is a test email from your MEAMS backend.
            </p>
        </body>
        </html>
        """
    )
    
    return {
        "success": test_sent,
        "config": config_test,
        "test_email_sent": test_sent,
        "message": "✅ Check inbox! Email sent successfully!" if test_sent else "❌ Failed to send - check logs below",
        "next_step": "Try forgot password now!" if test_sent else "Check Render logs for detailed error"
    }

# 🔥 QUICK FORGOT PASSWORD TEST
@app.post("/test-forgot-password")
async def test_forgot_password(email: str):
    """Quick test of forgot password flow"""
    from database import get_accounts_collection
    from services.email_service import send_email
    from config import FRONTEND_URL
    import secrets
    from datetime import datetime, timedelta
    
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
    reset_expires = datetime.utcnow() + timedelta(hours=1)
    
    print(f"✓ Token generated: {reset_token[:20]}...")
    
    # Update database
    accounts_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_reset_token": reset_token,
                "password_reset_expires": reset_expires,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    print(f"✓ Database updated")
    
    # Create reset link
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    print(f"✓ Reset link: {reset_link}")
    
    # Send email
    email_subject = "MEAMS - Password Reset Request"
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>Hello {user.get('name', 'User')},</p>
        <p>Click the button below to reset your password:</p>
        <p style="margin: 30px 0;">
            <a href="{reset_link}" 
               style="background-color: #007bff; 
                      color: white; 
                      padding: 12px 30px; 
                      text-decoration: none; 
                      border-radius: 5px;
                      display: inline-block;">
                Reset Password
            </a>
        </p>
        <p>Or copy and paste this link:</p>
        <p style="background-color: #f5f5f5; padding: 10px; word-break: break-all;">
            {reset_link}
        </p>
        <p style="color: #d32f2f; margin-top: 20px;">
            ⏰ This link expires in 1 hour.
        </p>
        <p style="color: #666;">
            If you didn't request this, please ignore this email.
        </p>
    </body>
    </html>
    """
    
    print("📧 Sending email...")
    
    email_sent = await send_email(email, email_subject, email_body)
    
    print(f"{'='*70}\n")
    
    return {
        "success": email_sent,
        "user_found": True,
        "username": user.get('username'),
        "name": user.get('name'),
        "email": email,
        "reset_token": reset_token,
        "reset_link": reset_link,
        "email_sent": email_sent,
        "message": "✅ Password reset email sent! Check inbox." if email_sent else "❌ Failed to send email - check logs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)