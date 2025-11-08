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
    update_last_login,
    generate_secure_password  # Import the password generator
)
from services.log_service import create_log_entry
from services.email_service import send_email
from database import get_accounts_collection
from dependencies import get_current_user
from config import FRONTEND_URL

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
    """Generate new password and send via email"""
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    accounts_collection = get_accounts_collection()
    
    user = accounts_collection.find_one({"email": request_data.email})
    
    if not user:
        # Don't reveal if email doesn't exist for security
        return {
            "success": True,
            "message": "If an account with that email exists, we've sent a new password to your email."
        }
    
    # Generate a new secure password
    new_password = generate_secure_password(12)
    new_password_hash = hash_password(new_password)
    
    # Update the user's password in database
    accounts_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": new_password_hash,
                "updated_at": datetime.utcnow(),
                "first_login": True  # Mark as first login to prompt password change
            }
        }
    )
    
    # Prepare email with new password
    email_subject = "MEAMS - Your New Password"
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #555; line-height: 1.6;">Hello {user.get('name', 'User')},</p>
            <p style="color: #555; line-height: 1.6;">Your password has been reset. Here is your new temporary password:</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #666;">Your New Password:</p>
                <p style="font-size: 24px; font-weight: bold; color: #007bff; margin: 10px 0; font-family: 'Courier New', monospace; letter-spacing: 2px;">{new_password}</p>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px;"><strong>Important:</strong> For security reasons, please change this password after logging in.</p>
            </div>
            
            <p style="color: #555; line-height: 1.6;">You can log in using:</p>
            <ul style="color: #555; line-height: 1.6;">
                <li><strong>Username:</strong> {user.get('username', 'N/A')}</li>
                <li><strong>Email:</strong> {request_data.email}</li>
            </ul>
            
            <p style="color: #555; line-height: 1.6; margin-top: 20px;">
                <a href="{FRONTEND_URL}/login" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Login Page</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; line-height: 1.6;">
                If you didn't request this password reset, please contact your administrator immediately.
            </p>
            <p style="color: #999; font-size: 12px; line-height: 1.6;">
                This is an automated message from the MEAMS System.
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        email_sent = await send_email(request_data.email, email_subject, email_body)
        
        if email_sent:
            await create_log_entry(
                user.get('username', 'Unknown'),
                "Password reset completed.",
                f"New password sent to: {request_data.email}",
                client_ip
            )
        else:
            await create_log_entry(
                user.get('username', 'Unknown'),
                "Password reset failed.",
                f"Failed to send email to: {request_data.email}",
                client_ip
            )
    except Exception as e:
        # Log the error but don't reveal it to the user
        await create_log_entry(
            user.get('username', 'Unknown'),
            "Password reset email error.",
            f"Error: {str(e)}",
            client_ip
        )
    
    return {
        "success": True,
        "message": "If an account with that email exists, we've sent a new password to your email."
    }
