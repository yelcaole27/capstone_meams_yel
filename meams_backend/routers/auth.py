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
from services.email_service import send_email
from database import get_accounts_collection
from dependencies import get_current_user

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
        from config import HARDCODED_USERS
        
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

@router.post("/change-password")
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
    
    user = accounts_collection.find_one({"email": request_data.email})
    
    if not user:
        # Don't reveal if email doesn't exist
        return {
            "success": True,
            "message": "If an account with that email exists, we've sent a password reset link."
        }
    
    reset_token = secrets.token_urlsafe(32)
    reset_expires = datetime.utcnow() + timedelta(hours=1)
    
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
    
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    
    email_subject = "MEAMS - Password Reset Request"
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2>Password Reset Request</h2>
        <p>Hello {user.get('name', 'User')},</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="{reset_link}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
    </body>
    </html>
    """
    
    email_sent = await send_email(request_data.email, email_subject, email_body)
    
    await create_log_entry(
        user.get('username', 'Unknown'),
        "Password reset requested.",
        f"Reset link sent to: {request_data.email}" if email_sent else "Failed to send reset email",
        client_ip
    )
    
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
    
    user = accounts_collection.find_one({
        "password_reset_token": request_data.token,
        "password_reset_expires": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    if len(request_data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    
    new_password_hash = hash_password(request_data.new_password)
    
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
