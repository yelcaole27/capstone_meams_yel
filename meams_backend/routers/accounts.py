"""
Accounts router - handles user account management (admin only)
UPDATED WITH SECURE require_admin DEPENDENCY
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from bson import ObjectId
from datetime import datetime

from models.user import AccountCreate, AccountUpdate
from services.auth_service import verify_token, hash_password, generate_secure_password
from services.log_service import create_log_entry
from services.email_service import send_email
from database import get_accounts_collection
from dependencies import require_admin, get_current_user  # ← CHANGED: Import get_current_user for check-status

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

def account_helper(account) -> dict:
    """Helper function to format account data"""
    return {
        "_id": str(account["_id"]),
        "name": account.get("name", ""),
        "username": account.get("username", ""),
        "email": account.get("email", ""),
        "role": account.get("role", "staff"),
        "department": account.get("department", "Operations"),
        "position": account.get("position", "Staff Member"),
        "phone_number": account.get("phone_number", ""),
        "status": account.get("status", True),
        "account_creation": account.get("account_creation", account.get("created_at", datetime.utcnow()).strftime("%m/%d/%Y")),
        "last_login": account.get("last_login", "Never"),
        "first_login": account.get("first_login", True),
        "created_at": account.get("created_at", datetime.utcnow()),
        "updated_at": account.get("updated_at", datetime.utcnow()),
        "profile_picture": account.get("profile_picture"),
        "profile_picture_content_type": account.get("profile_picture_content_type"),
        "profile_picture_filename": account.get("profile_picture_filename")
    }

@router.get("")
async def get_all_accounts(token: str = Depends(require_admin)):
    """Get all accounts - admin only"""
    payload = verify_token(token)
    
    collection = get_accounts_collection()
    accounts = [account_helper(account) for account in collection.find()]
    return {"success": True, "message": f"Found {len(accounts)} accounts", "data": accounts}

@router.post("")
async def create_account(
    account: AccountCreate,
    request: Request,
    token: str = Depends(require_admin)
):
    """Create a new account - admin only"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    collection = get_accounts_collection()
    
    # Check if username or email exists
    existing_user = collection.find_one({
        "$or": [
            {"username": account.username},
            {"email": account.email}
        ]
    })
    
    if existing_user:
        if existing_user["username"] == account.username:
            raise HTTPException(status_code=400, detail="Username already exists")
        else:
            raise HTTPException(status_code=400, detail="Email already exists")
    
    # Generate password
    temp_password = generate_secure_password()
    password_hash = hash_password(temp_password)
    
    # Create account
    account_dict = {
        "name": account.name,
        "username": account.username,
        "email": account.email,
        "role": account.role,
        "department": account.department,
        "position": account.position,
        "phone_number": account.phone_number,
        "password_hash": password_hash,
        "status": True,
        "first_login": True,
        "account_creation": datetime.utcnow().strftime("%m/%d/%Y"),
        "last_login": "Never",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = collection.insert_one(account_dict)
    created_account = collection.find_one({"_id": result.inserted_id})
    
    # Send password email
    email_subject = "MEAMS Account Created - Login Credentials"
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2>Welcome to MEAMS Asset Management System</h2>
        <p>Hello {account.name},</p>
        <p>Your account has been created successfully. Here are your login credentials:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <p><strong>Username:</strong> {account.username}</p>
            <p><strong>Temporary Password:</strong> {temp_password}</p>
        </div>
        <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
        <p>You can access the system at: <a href="http://localhost:3000">MEAMS System</a></p>
        <p>Best regards,<br>MEAMS System</p>
    </body>
    </html>
    """
    
    email_sent = await send_email(account.email, email_subject, email_body)
    
    await create_log_entry(
        username,
        "Created account.",
        f"Created account for: {account.name} ({account.username}) - Role: {account.role}",
        client_ip
    )
    
    message = "Account created successfully"
    if email_sent:
        message += " and login credentials sent to email"
    else:
        message += " but failed to send email notification"
    
    return {
        "success": True,
        "message": message,
        "data": account_helper(created_account)
    }

@router.put("/{account_id}")
async def update_account(
    account_id: str,
    account_update: AccountUpdate,
    request: Request,
    token: str = Depends(require_admin)
):
    """Update an account - admin only"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=400, detail="Invalid account ID format")
    
    collection = get_accounts_collection()
    account_before = collection.find_one({"_id": ObjectId(account_id)})
    
    if not account_before:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Build update data
    update_data = {}
    update_dict = account_update.dict(exclude_unset=True)
    
    for field, value in update_dict.items():
        if value is not None or isinstance(value, bool):
            update_data[field] = value
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Check for conflicts
    if "username" in update_data or "email" in update_data:
        conflict_query = {"_id": {"$ne": ObjectId(account_id)}}
        or_conditions = []
        
        if "username" in update_data:
            or_conditions.append({"username": update_data["username"]})
        if "email" in update_data:
            or_conditions.append({"email": update_data["email"]})
        
        if or_conditions:
            conflict_query["$or"] = or_conditions
            existing_account = collection.find_one(conflict_query)
            
            if existing_account:
                if "username" in update_data and existing_account.get("username") == update_data["username"]:
                    raise HTTPException(status_code=400, detail="Username already exists")
                if "email" in update_data and existing_account.get("email") == update_data["email"]:
                    raise HTTPException(status_code=400, detail="Email already exists")
    
    update_data["updated_at"] = datetime.utcnow()
    
    collection.update_one({"_id": ObjectId(account_id)}, {"$set": update_data})
    updated_account = collection.find_one({"_id": ObjectId(account_id)})
    
    status_change = ""
    if "status" in update_data:
        status_change = f" - Status changed to: {'Active' if update_data['status'] else 'Inactive'}"
    
    await create_log_entry(
        username,
        "Updated account.",
        f"Updated account: {account_before.get('name', 'Unknown')} ({account_before.get('username')}){status_change}",
        client_ip
    )
    
    return {
        "success": True,
        "message": "Account updated successfully",
        "data": account_helper(updated_account)
    }

@router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    request: Request,
    token: str = Depends(require_admin)
):
    """Delete an account - admin only"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=400, detail="Invalid account ID format")
    
    collection = get_accounts_collection()
    account_to_delete = collection.find_one({"_id": ObjectId(account_id)})
    
    if not account_to_delete:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Prevent self-deletion
    if account_to_delete.get("username") == username:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    collection.delete_one({"_id": ObjectId(account_id)})
    
    await create_log_entry(
        username,
        "Deleted account.",
        f"Deleted account: {account_to_delete.get('name', 'Unknown')} ({account_to_delete.get('username')})",
        client_ip
    )
    
    return {"success": True, "message": "Account deleted successfully"}

@router.post("/{account_id}/reset-password")
async def reset_account_password(
    account_id: str,
    request: Request,
    token: str = Depends(require_admin)
):
    """Reset an account's password - admin only"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=400, detail="Invalid account ID format")
    
    collection = get_accounts_collection()
    account = collection.find_one({"_id": ObjectId(account_id)})
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Generate new password
    new_password = generate_secure_password()
    password_hash = hash_password(new_password)
    
    collection.update_one(
        {"_id": ObjectId(account_id)},
        {
            "$set": {
                "password_hash": password_hash,
                "first_login": True,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Send email
    email_subject = "MEAMS Password Reset - New Login Credentials"
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2>MEAMS Password Reset</h2>
        <p>Hello {account.get('name', 'User')},</p>
        <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <p><strong>Username:</strong> {account.get('username')}</p>
            <p><strong>New Password:</strong> {new_password}</p>
        </div>
        <p><strong>Important:</strong> Please change your password after logging in for security purposes.</p>
        <p>You can access the system at: <a href="http://localhost:3000">MEAMS System</a></p>
        <p>Best regards,<br>MEAMS System</p>
    </body>
    </html>
    """
    
    email_sent = await send_email(account.get("email", ""), email_subject, email_body)
    
    await create_log_entry(
        username,
        "Reset account password.",
        f"Reset password for: {account.get('name', 'Unknown')} ({account.get('username')})",
        client_ip
    )
    
    message = "Password reset successfully"
    if email_sent:
        message += " and new credentials sent to email"
    else:
        message += " but failed to send email notification"
    
    return {"success": True, "message": message}

@router.get("/check-status")
async def check_account_status(token: str = Depends(get_current_user)):  # ← CHANGED: Use get_current_user instead of require_admin
    """Check if current user's account is still active - all authenticated users can access"""
    try:
        payload = verify_token(token)
        username = payload["username"]
        
        # Check hardcoded users first
        from config import HARDCODED_USERS
        if username in HARDCODED_USERS:
            return {
                "success": True,
                "active": True,
                "username": username,
                "role": HARDCODED_USERS[username]["role"]
            }
        
        # Check database users
        collection = get_accounts_collection()
        user = collection.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "active": user.get("status", True),
            "username": username,
            "role": user.get("role", "staff")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token")