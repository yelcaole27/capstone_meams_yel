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

# THIS IS THE IMPORTANT LINE - create the router instance
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
    """Login endpoint"""
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
    
    update_last_login(credentials.username)
    
    await create_log_entry(
        credentials.username,
        "Logged in.",
        f"Role: {user['role']}",
        client_ip
    )
    
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}
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