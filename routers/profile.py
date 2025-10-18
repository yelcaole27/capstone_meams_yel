"""
Profile router - handles user profile management
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime

from models.user import ProfileUpdate, PasswordChange
from services.auth_service import (
    get_user_by_username,
    update_user_profile,
    verify_token,
    verify_password,
    hash_password,
    update_user_password
)
from services.log_service import create_log_entry
from database import get_accounts_collection
from dependencies import get_current_user
import base64

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("")
async def get_profile(token: str = Depends(get_current_user)):
    """Get current user's profile"""
    payload = verify_token(token)
    username = payload["username"]
    
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "fullName": user.get("full_name", ""),
        "role": user.get("role", ""),
        "department": user.get("department", ""),
        "phoneNumber": user.get("phone_number", ""),
        "dateJoined": user.get("date_joined", datetime.now().strftime("%Y-%m-%d")),
        "profilePicture": user.get("profile_picture")
    }

@router.put("")
async def update_profile(
    profile_data: ProfileUpdate,
    token: str = Depends(get_current_user)
):
    """Update user profile"""
    payload = verify_token(token)
    username = payload["username"]
    
    update_fields = {}
    if profile_data.email is not None:
        update_fields["email"] = profile_data.email
    if profile_data.fullName is not None:
        update_fields["name"] = profile_data.fullName
    if profile_data.department is not None:
        update_fields["department"] = profile_data.department
    if profile_data.phoneNumber is not None:
        update_fields["phone_number"] = profile_data.phoneNumber
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    success = update_user_profile(username, update_fields)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = get_user_by_username(username)
    return {
        "username": updated_user.get("username", ""),
        "email": updated_user.get("email", ""),
        "fullName": updated_user.get("full_name", ""),
        "role": updated_user.get("role", ""),
        "department": updated_user.get("department", ""),
        "phoneNumber": updated_user.get("phone_number", ""),
        "dateJoined": updated_user.get("date_joined", datetime.now().strftime("%Y-%m-%d")),
        "profilePicture": updated_user.get("profile_picture")
    }

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    token: str = Depends(get_current_user)
):
    """Change user password"""
    payload = verify_token(token)
    username = payload["username"]
    
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check hardcoded users
    from config import HARDCODED_USERS
    if username in HARDCODED_USERS:
        if password_data.current_password != HARDCODED_USERS[username]["password"]:
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    else:
        if not verify_password(password_data.current_password, user["password"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    hashed_new_password = hash_password(password_data.new_password)
    success = update_user_password(username, hashed_new_password)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update password")
    
    return {"message": "Password changed successfully"}

@router.post("/picture")
async def upload_profile_picture(
    request: Request,
    token: str = Depends(get_current_user)
):
    """Upload profile picture"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    body = await request.json()
    profile_picture_base64 = body.get("profilePicture")
    
    if not profile_picture_base64:
        raise HTTPException(status_code=400, detail="No profile picture provided")
    
    if not profile_picture_base64.startswith('data:image/'):
        raise HTTPException(status_code=400, detail="Invalid image format")
    
    header, base64_data = profile_picture_base64.split(',', 1)
    content_type = header.split(':')[1].split(';')[0]
    
    image_bytes = base64.b64decode(base64_data)
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file too large (max 5MB)")
    
    from config import HARDCODED_USERS
    if username not in HARDCODED_USERS:
        accounts_collection = get_accounts_collection()
        result = accounts_collection.update_one(
            {"username": username},
            {"$set": {
                "profile_picture": base64_data,
                "profile_picture_content_type": content_type,
                "updated_at": datetime.utcnow()
            }}
        )
        success = result.matched_count > 0
    else:
        success = True
    
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    await create_log_entry(username, "Updated profile picture.", "Uploaded new profile picture", client_ip)
    
    return {
        "success": True,
        "message": "Profile picture updated successfully",
        "profilePicture": profile_picture_base64
    }

@router.get("/picture")
async def get_profile_picture(token: str = Depends(get_current_user)):
    """Get user's profile picture"""
    payload = verify_token(token)
    username = payload["username"]
    
    from config import HARDCODED_USERS
    if username in HARDCODED_USERS:
        return {"profilePicture": None}
    
    accounts_collection = get_accounts_collection()
    user = accounts_collection.find_one({"username": username})
    
    if user and user.get("profile_picture"):
        return {
            "profilePicture": f"data:{user.get('profile_picture_content_type', 'image/jpeg')};base64,{user['profile_picture']}"
        }
    
    return {"profilePicture": None}

@router.delete("/picture")
async def delete_profile_picture(
    request: Request,
    token: str = Depends(get_current_user)
):
    """Delete user's profile picture"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    from config import HARDCODED_USERS
    if username not in HARDCODED_USERS:
        accounts_collection = get_accounts_collection()
        success = accounts_collection.update_one(
            {"username": username},
            {
                "$unset": {
                    "profile_picture": "",
                    "profile_picture_filename": "",
                    "profile_picture_content_type": ""
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        ).matched_count > 0
    else:
        success = True
    
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    await create_log_entry(username, "Deleted profile picture.", "Removed profile picture", client_ip)
    
    return {"success": True, "message": "Profile picture deleted successfully"}