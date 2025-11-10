"""
Shared dependencies for FastAPI endpoints - SECURE VERSION
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from services.auth_service import verify_token
from database import get_accounts_collection
from config import HARDCODED_USERS

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Dependency to get current authenticated user
    Validates JWT token and returns user payload
    """
    try:
        # Verify and decode the JWT token
        payload = verify_token(token)
        username = payload.get("username")
        
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user still exists and is active
        # First check hardcoded users
        if username in HARDCODED_USERS:
            return token  # Hardcoded users are always valid
        
        # Check database users
        accounts_collection = get_accounts_collection()
        user = accounts_collection.find_one({"username": username})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if account is active
        if user.get("status") == False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been deactivated",
            )
        
        # Return the token (other endpoints will call verify_token again to get payload)
        return token
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Any other error means invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_admin(token: str = Depends(get_current_user)):
    """
    Dependency for admin-only endpoints
    Use this for endpoints that require admin privileges
    """
    try:
        payload = verify_token(token)
        user_role = payload.get("role")
        
        if user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required"
            )
        
        return token
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


async def get_current_user_payload(token: str = Depends(get_current_user)):
    """
    Dependency that returns the decoded payload instead of token
    Useful when you need user info without calling verify_token again
    """
    try:
        payload = verify_token(token)
        return payload
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )