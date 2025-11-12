"""
Authentication router - handles login, logout, password reset
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import secrets

from services.auth_service import (
    authenticate_user,
    create_access_token,
    verify_token,
    hash_password,
    verify_password,
    update_last_login
)
from services.log_service import create_log_entry
from services.email_service import send_password_reset_email  # FIXED: Import correct function
from database import get_accounts_collection
from dependencies import get_current_user
from config import HARDCODED_USERS, FRONTEND_URL

# Create router WITHOUT prefix since routes include full paths
router = APIRouter(tags=["authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/login")
async def login(credentials: LoginRequest, request: Request):
    """Login endpoint with account status check"""
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    user = authenticate_user(credentials.username, credentials.password)
    
    if not user:
        await create_log_entry(
            credentials.username,
            "Failed login attempt.",
            "Invalid credentials",
            client_ip
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    # Check if account is active
    if user.get("status") == False:
        await create_log_entry(
            credentials.username,
            "Failed login attempt.",
            "Account is deactivated",
            client_ip
        )
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Please contact an administrator."
        )
    
    update_last_login(credentials.username)
    
    await create_log_entry(
        credentials.username,
        "Logged in.",
        f"Role: {user['role']}",
        client_ip
    )
    
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "userId": str(user["_id"])
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "first_login": user.get("first_login", False)
    }

@router.post("/logout")
async def logout(request: Request, token: str = Depends(get_current_user)):
    """Logout endpoint"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    await create_log_entry(username, "Logged out.", "", client_ip)
    return {"message": "Successfully logged out"}

@router.post("/api/auth/refresh")
async def refresh_token(request: Request, token: str = Depends(get_current_user)):
    """
    Refresh JWT token endpoint
    Validates current token and issues a new one with extended expiration
    """
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        # Verify the current token
        payload = verify_token(token)
        username = payload["username"]
        role = payload["role"]
        
        # Get user from database to verify account is still active
        accounts_collection = get_accounts_collection()
        
        # Check if it's a hardcoded user or database user
        if username in HARDCODED_USERS:
            user = {
                "username": username,
                "role": HARDCODED_USERS[username]["role"],
                "status": True,
                "_id": "hardcoded"
            }
        else:
            user = accounts_collection.find_one({"username": username})
        
        # Verify user still exists and is active
        if not user:
            await create_log_entry(
                username,
                "Token refresh failed.",
                "User not found",
                client_ip
            )
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )
        
        # Check if account is still active
        if user.get("status") == False:
            await create_log_entry(
                username,
                "Token refresh failed.",
                "Account is deactivated",
                client_ip
            )
            raise HTTPException(
                status_code=403,
                detail="Account has been deactivated"
            )
        
        # Create new access token with fresh expiration
        new_access_token = create_access_token(
            data={
                "sub": username,
                "role": role,
                "userId": str(user["_id"])
            }
        )
        
        await create_log_entry(
            username,
            "Token refreshed.",
            f"New token issued for role: {role}",
            client_ip
        )
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer"
        }
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise e
    except Exception as e:
        await create_log_entry(
            "unknown",
            "Token refresh error.",
            str(e),
            client_ip
        )
        raise HTTPException(
            status_code=401,
            detail="Could not refresh token"
        )

@router.post("/api/change-password")
async def change_password_api(
    password_data: PasswordChangeRequest,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Change password endpoint"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    accounts_collection = get_accounts_collection()
    user = accounts_collection.find_one({"username": username})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(password_data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_password_hash = hash_password(password_data.new_password)
    
    accounts_collection.update_one(
        {"username": username},
        {
            "$set": {
                "password_hash": new_password_hash,
                "first_login": False,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    await create_log_entry(
        username,
        "Changed password.",
        "Password updated successfully",
        client_ip
    )
    
    return {"success": True, "message": "Password changed successfully"}

@router.post("/api/auth/forgot-password")
async def forgot_password(request_data: ForgotPasswordRequest, request: Request):
    """Send password reset email"""
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    accounts_collection = get_accounts_collection()
    
    # Find user by email
    user = accounts_collection.find_one({"email": request_data.email})
    
    if not user:
        # Security: Don't reveal if email doesn't exist
        print(f"⚠️ Password reset requested for non-existent email: {request_data.email}")
        return {
            "success": True,
            "message": "If an account with that email exists, we've sent a password reset link."
        }
    
    # Generate secure reset token
    reset_token = secrets.token_urlsafe(32)
    reset_expires = datetime.utcnow() + timedelta(hours=1)
    
    # Save token to database
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
    
    # Create reset link with frontend URL
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    print(f"🔐 Password reset requested for: {user.get('username', 'Unknown')}")
    print(f"📧 Sending reset email to: {request_data.email}")
    print(f"🔗 Reset link: {reset_link}")
    
    # FIXED: Use dedicated password reset email function
    email_sent = await send_password_reset_email(request_data.email, reset_link)
    
    if email_sent:
        print(f"✅ Password reset email sent successfully to {request_data.email}")
    else:
        print(f"❌ Failed to send password reset email to {request_data.email}")
    
    # Log the action
    await create_log_entry(
        user.get('username', 'Unknown'),
        "Password reset requested.",
        f"Reset link {'sent to' if email_sent else 'FAILED to send to'}: {request_data.email}",
        client_ip
    )
    
    # Always return success to prevent email enumeration
    return {
        "success": True,
        "message": "If an account with that email exists, we've sent a password reset link."
    }

@router.get("/api/auth/validate-reset-token/{token}")
async def validate_reset_token(token: str):
    """Validate password reset token"""
    accounts_collection = get_accounts_collection()
    
    user = accounts_collection.find_one({
        "password_reset_token": token,
        "password_reset_expires": {"$gt": datetime.utcnow()}
    })
    
    if user:
        print(f"✅ Valid reset token for user: {user.get('username', 'Unknown')}")
    else:
        print(f"❌ Invalid or expired reset token: {token[:20]}...")
    
    return {
        "success": True,
        "valid": user is not None,
        "message": "Token is valid" if user else "Invalid or expired token"
    }

@router.post("/api/auth/reset-password")
async def reset_password(request_data: ResetPasswordRequest, request: Request):
    """Reset password using token"""
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    accounts_collection = get_accounts_collection()
    
    # Find user with valid token
    user = accounts_collection.find_one({
        "password_reset_token": request_data.token,
        "password_reset_expires": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        print(f"❌ Reset attempt with invalid/expired token: {request_data.token[:20]}...")
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Validate password length
    if len(request_data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    
    # Hash new password
    new_password_hash = hash_password(request_data.new_password)
    
    # Update password and remove reset token
    accounts_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": new_password_hash,
                "updated_at": datetime.utcnow(),
                "first_login": False
            },
            "$unset": {
                "password_reset_token": "",
                "password_reset_expires": ""
            }
        }
    )
    
    print(f"✅ Password successfully reset for user: {user.get('username', 'Unknown')}")
    
    await create_log_entry(
        user.get('username', 'Unknown'),
        "Password reset completed.",
        "Password successfully reset using email link",
        client_ip
    )
    
    return {
        "success": True,
        "message": "Password reset successfully. You can now log in with your new password."
    }
