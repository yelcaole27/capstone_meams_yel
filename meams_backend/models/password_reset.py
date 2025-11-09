"""
Password Reset Token Model (MongoDB version)
Since you're using MongoDB, we'll handle this differently than SQLAlchemy

This file is just for reference - MongoDB doesn't need model classes like SQLAlchemy
Your password reset tokens will be stored directly in the accounts collection
"""

from datetime import datetime, timedelta
from typing import Optional

def create_password_reset_token(token: str, expires_in_hours: int = 1) -> dict:
    """
    Create a password reset token document structure
    
    Args:
        token: The reset token string
        expires_in_hours: Hours until token expires (default 1)
    
    Returns:
        dict: Token data to be stored in accounts collection
    """
    return {
        "password_reset_token": token,
        "password_reset_expires": datetime.utcnow() + timedelta(hours=expires_in_hours),
        "password_reset_used": False,
        "password_reset_created_at": datetime.utcnow()
    }

def is_token_valid(account: dict) -> bool:
    """
    Check if password reset token is valid
    
    Args:
        account: Account document from MongoDB
    
    Returns:
        bool: True if token is valid and not expired
    """
    if not account.get("password_reset_token"):
        return False
    
    if account.get("password_reset_used"):
        return False
    
    expires = account.get("password_reset_expires")
    if not expires:
        return False
    
    if datetime.utcnow() > expires:
        return False
    
    return True

def mark_token_used(collection, account_id) -> bool:
    """
    Mark a password reset token as used
    
    Args:
        collection: MongoDB accounts collection
        account_id: Account _id
    
    Returns:
        bool: True if updated successfully
    """
    try:
        result = collection.update_one(
            {"_id": account_id},
            {
                "$set": {
                    "password_reset_used": True,
                    "password_reset_token_used_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error marking token as used: {e}")
        return False

def clear_reset_token(collection, account_id) -> bool:
    """
    Clear password reset token data from account
    
    Args:
        collection: MongoDB accounts collection
        account_id: Account _id
    
    Returns:
        bool: True if cleared successfully
    """
    try:
        result = collection.update_one(
            {"_id": account_id},
            {
                "$unset": {
                    "password_reset_token": "",
                    "password_reset_expires": "",
                    "password_reset_used": "",
                    "password_reset_created_at": "",
                    "password_reset_token_used_at": ""
                }
            }
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error clearing reset token: {e}")
        return False