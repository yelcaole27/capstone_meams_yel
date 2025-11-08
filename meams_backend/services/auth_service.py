"""
Authentication service - handles user authentication and password management
"""
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
import secrets
import string

from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, HARDCODED_USERS
from database import get_accounts_collection

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def generate_secure_password(length: int = 12) -> str:
    """Generate a secure random password"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(characters) for _ in range(length))

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> dict:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"username": username, "role": role}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def authenticate_user(username: str, password: str):
    """Authenticate user with username and password"""
    accounts_collection = get_accounts_collection()
    
    # Check hardcoded users first
    if username in HARDCODED_USERS:
        if password == HARDCODED_USERS[username]["password"]:
            return {
                "username": username,
                "role": HARDCODED_USERS[username]["role"],
                "first_login": False,
                "status": True,
                "_id": "hardcoded"
            }
        return None
    
    # Check database users
    user = accounts_collection.find_one({"username": username})
    if user and verify_password(password, user.get("password_hash", "")):
        return user  # Return full user object
    
    return None

def get_user_by_username(username: str):
    """Get user data by username"""
    accounts_collection = get_accounts_collection()
    
    # Check hardcoded users
    if username in HARDCODED_USERS:
        return {
            "username": username,
            "email": f"{username}@meams.com",
            "full_name": username.title(),
            "role": HARDCODED_USERS[username]["role"],
            "department": "IT" if username == "admin" else "Operations",
            "phone_number": "",
            "password": HARDCODED_USERS[username]["password"],
            "date_joined": "2024-01-01",
            "profile_picture": None
        }
    
    # Check database users
    user = accounts_collection.find_one({"username": username})
    if user:
        profile_picture = None
        if user.get("profile_picture"):
            profile_picture = f"data:{user.get('profile_picture_content_type', 'image/jpeg')};base64,{user['profile_picture']}"
        
        return {
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "full_name": user.get("name", ""),
            "role": user.get("role", "staff"),
            "department": user.get("department", "Operations"),
            "phone_number": user.get("phone_number", ""),
            "password": user.get("password_hash", ""),
            "date_joined": user.get("account_creation", datetime.utcnow().strftime("%m/%d/%Y")),
            "profile_picture": profile_picture
        }
    
    return None

def update_user_profile(username: str, update_fields: dict):
    """Update user profile"""
    accounts_collection = get_accounts_collection()
    
    if username in HARDCODED_USERS:
        return True
    
    result = accounts_collection.update_one(
        {"username": username},
        {"$set": {**update_fields, "updated_at": datetime.utcnow()}}
    )
    return result.matched_count > 0

def update_user_password(username: str, hashed_password: str):
    """Update user password"""
    accounts_collection = get_accounts_collection()
    
    if username in HARDCODED_USERS:
        return True
    
    result = accounts_collection.update_one(
        {"username": username},
        {"$set": {"password_hash": hashed_password, "updated_at": datetime.utcnow()}}
    )
    return result.matched_count > 0

def update_last_login(username: str):
    """Update user's last login timestamp"""
    accounts_collection = get_accounts_collection()
    
    if username not in HARDCODED_USERS:
        accounts_collection.update_one(
            {"username": username},
            {"$set": {"last_login": datetime.utcnow().strftime("%m/%d/%Y")}}
        )