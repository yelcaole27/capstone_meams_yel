from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pymongo import MongoClient
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from typing import Optional, List
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext
import secrets
import string
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import pandas as pd
import io
from typing import Optional, Dict, Any
import pandas as pd
import base64
from fastapi import UploadFile
from fastapi.responses import Response
import mimetypes
from typing import Optional
from pydantic import BaseModel
import bcrypt
from fastapi import FastAPI, HTTPException, Depends, Body
import pandas as pd

from processing import bootstrap_years, generate_sarima_forecast

# Load environment variables
load_dotenv()

app = FastAPI(title="MEAMS Asset Management API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication setup
SECRET_KEY = "your_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Email configuration
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", "your-email@gmail.com")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "your-app-password")
EMAIL_FROM = os.getenv("EMAIL_FROM", "MEAMS System <your-email@gmail.com>")

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://etil:MEAMSDS42@cluster0.xl6k426.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DATABASE_NAME = os.getenv("DATABASE_NAME", "MEAMS")

try:
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    client.admin.command('ping')
    print(f"? Connected to MongoDB: {DATABASE_NAME}")
except Exception as e:
    print(f"? Failed to connect to MongoDB: {e}")

# Collections
supplies_collection = db.supplies
equipment_collection = db.equipment
accounts_collection = db.accounts
logs_collection = db.logs

# Add these lines with your other collection definitions
historical_supplies_forecast_collection = db["historical_supplies_forecast"]  
historical_equipment_forecast_collection = db["historical_equipment_forecast"]
# ===============================================
# ===============================================
# LOGGING UTILITIES
# ===============================================

async def create_log_entry(username: str, action: str, details: str = "", ip_address: str = "unknown"):
    """Create a log entry in the database"""
    try:
        log_entry = {
            "timestamp": datetime.utcnow(),
            "username": username,
            "action": action,
            "details": details,
            "ip_address": ip_address,
            "formatted_timestamp": datetime.utcnow().strftime("%m/%d/%Y - %H:%M:%S")
        }
        logs_collection.insert_one(log_entry)
        print(f"?? Log created: {username} - {action}")
    except Exception as e:
        print(f"? Failed to create log entry: {str(e)}")

def log_helper(log) -> dict:
    """Helper function to format log data"""
    return {
        "_id": str(log["_id"]),
        "timestamp": log.get("formatted_timestamp", log.get("timestamp", "")),
        "username": log.get("username", ""),
        "action": log.get("action", ""),
        "details": log.get("details", ""),
        "ip_address": log.get("ip_address", "unknown"),
        "created_at": log.get("timestamp", datetime.utcnow())
    }

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

# ===============================================
# MODELS
# ===============================================

class LogsFilter(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    username: Optional[str] = None
    search: Optional[str] = None

class AccountCreate(BaseModel):
    name: str
    username: str
    email: EmailStr
    role: Optional[str] = "staff"
    department: Optional[str] = "Operations"
    position: Optional[str] = "Staff Member"
    phone_number: Optional[str] = ""

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class BugReport(BaseModel):
    message: str
    username: str = "unknown_user"
    role: str = "unknown_role"
    
# Profile models
class ProfileResponse(BaseModel):
    username: str
    email: str
    fullName: str
    role: str
    department: str
    phoneNumber: str = None
    dateJoined: str
    profilePicture: Optional[str] = None

class ProfileUpdate(BaseModel):
    email: str = None
    fullName: str = None
    department: str = None
    phoneNumber: str = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class User(BaseModel):
    username: str
    password: str

class SupplyCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: str
    quantity: int
    supplier: Optional[str] = ""
    location: Optional[str] = ""
    status: Optional[str] = "available"
    itemCode: Optional[str] = ""
    date: Optional[str] = ""
    itemPicture: Optional[str] = None  # Base64 encoded image string
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None

class SupplyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    supplier: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    itemCode: Optional[str] = None
    date: Optional[str] = None
    image_data: Optional[str] = None
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None

class EquipmentCreate(BaseModel):
    name: str
    description: str
    category: str
    quantity: int
    unit: Optional[str] = "UNIT"
    location: Optional[str] = ""
    status: Optional[str] = "Operational"
    serialNo: Optional[str] = ""
    itemCode: Optional[str] = ""
    unit_price: Optional[float] = 0.0
    supplier: Optional[str] = ""
    date: Optional[str] = ""
    image_data: Optional[str] = None  # base64 string
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None

class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    serialNo: Optional[str] = None
    itemCode: Optional[str] = None
    unit_price: Optional[float] = None
    supplier: Optional[str] = None
    date: Optional[str] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[bool] = None
    
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# ===============================================
# HELPER FUNCTIONS
# ===============================================

def generate_secure_password(length: int = 12) -> str:
    """Generate a secure random password"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(characters) for _ in range(length))

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email with generated password"""
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        context = ssl.create_default_context()
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls(context=context)
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        
        print(f"? Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"? Failed to send email to {to_email}: {str(e)}")
        return False

def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
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

# Helper function for getting current user (for profile endpoints)
def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current user from token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"sub": username, "role": payload.get("role")}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Helper functions for profile management
def get_user_by_username(username: str):
    """Get user data from database by username"""
    try:
        # Check hardcoded users first
        hardcoded_users = {
            "admin": {"password": "password123", "role": "admin"},
            "staff": {"password": "staff123", "role": "staff"},
        }
        
        if username in hardcoded_users:
            return {
                "username": username,
                "email": f"{username}@meams.com",
                "full_name": username.title(),
                "role": hardcoded_users[username]["role"],
                "department": "IT" if username == "admin" else "Operations",
                "phone_number": "",
                "password": hardcoded_users[username]["password"],
                "date_joined": "2024-01-01",
                "profile_picture": None  # ? Added profile picture field
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
                "profile_picture": profile_picture  # ? Added profile picture field
            }
        return None
        
    except Exception as e:
        print(f"Database error: {e}")
        return None

def update_user_profile(username: str, update_fields: dict):
    """Update user profile in database"""
    try:
        # Check if it's a hardcoded user
        hardcoded_users = ["admin", "staff"]
        if username in hardcoded_users:
            # For hardcoded users, we can't update the database, so return True
            # In a real application, you might want to handle this differently
            return True
        
        # Update database user
        result = accounts_collection.update_one(
            {"username": username},
            {"$set": {**update_fields, "updated_at": datetime.utcnow()}}
        )
        return result.matched_count > 0
        
    except Exception as e:
        print(f"Database error: {e}")
        return False

def update_user_password(username: str, hashed_password: str):
    """Update user password in database"""
    try:
        # Check if it's a hardcoded user
        hardcoded_users = ["admin", "staff"]
        if username in hardcoded_users:
            # For hardcoded users, we can't update the password in database
            # In a real application, you might want to handle this differently
            return True
        
        # Update database user password
        result = accounts_collection.update_one(
            {"username": username},
            {"$set": {"password_hash": hashed_password, "updated_at": datetime.utcnow()}}
        )
        return result.matched_count > 0
        
    except Exception as e:
        print(f"Database error: {e}")
        return False

def supply_helper(supply) -> dict:
    return {
        "_id": str(supply["_id"]),
        "name": supply["name"],
        "description": supply.get("description", ""),
        "category": supply["category"],
        "quantity": supply["quantity"],
                "supplier": supply.get("supplier", ""),
        "location": supply.get("location", ""),
        "status": supply.get("status", "available"),
        "itemCode": supply.get("itemCode", ""),
        "date": supply.get("date", ""),
        "has_image": supply.get("image_data") is not None and supply.get("image_data") != "",
        "image_data": supply.get("image_data"),  # Important: include image_data here
        "image_filename": supply.get("image_filename"),
        "image_content_type": supply.get("image_content_type"),
        "created_at": supply.get("created_at", datetime.utcnow()),
        "updated_at": supply.get("updated_at", datetime.utcnow())
    }

def equipment_helper(equipment) -> dict:
    return {
        "_id": str(equipment["_id"]),
        "name": equipment.get("name", equipment.get("description", "")),
        "description": equipment.get("description", equipment.get("name", "")),
        "category": equipment.get("category", "General"),
        "quantity": equipment.get("quantity", 1),
        "unit": equipment.get("unit", "UNIT"),
        "location": equipment.get("location", ""),
        "status": equipment.get("status", "Operational"),
        "serialNo": equipment.get("serialNo", equipment.get("serial_number", "")),
        "itemCode": equipment.get("itemCode", equipment.get("item_code", "")),
        "unit_price": equipment.get("unit_price", 0.0),
        "supplier": equipment.get("supplier", ""),
        "date": equipment.get("date", ""),
        "image_data": equipment.get("image_data"),
        "image_filename": equipment.get("image_filename"),
        "image_content_type": equipment.get("image_content_type"),
        "created_at": equipment.get("created_at", datetime.utcnow()),
        "updated_at": equipment.get("updated_at", datetime.utcnow())
    }

def validate_and_transform_supply(item_data: dict, index: int) -> tuple:
    """Validate and transform supply item data"""
    errors = []
    
    # Get item name from multiple possible field names
    item_name = (
        item_data.get('item_name') or 
        item_data.get('name') or 
        item_data.get('product_name') or 
        ''
    )
    
    if isinstance(item_name, float) and pd.isna(item_name):
        item_name = ''
    else:
        item_name = str(item_name).strip()
    
    if not item_name:
        errors.append(f"Row {index + 1}: Item name is required")
        return None, errors
    
    # Transform and validate quantity
    try:
        quantity = item_data.get('quantity', 0)
        if pd.isna(quantity):
            quantity = 0
        quantity = int(float(quantity))
        if quantity < 0:
            quantity = 0
    except (ValueError, TypeError):
        quantity = 0
    
    # Generate item code if not provided
    category = str(item_data.get('category', 'General')).strip()
    if pd.isna(item_data.get('category')):
        category = 'General'
    
    item_code = item_data.get('itemCode') or item_data.get('item_code', '')
    if pd.isna(item_code) or not str(item_code).strip():
        category_prefix = category[:3].upper()
        random_num = str(abs(hash(f"{item_name}{datetime.utcnow()}")))[:5]
        item_code = f"{category_prefix}-{random_num}"
    
    def clean_string(value):
        return '' if pd.isna(value) else str(value).strip()
    
    transformed_item = {
        "name": item_name,
        "description": clean_string(item_data.get('description', '')),
        "category": category,
        "quantity": quantity,
        "supplier": clean_string(item_data.get('supplier', '')),
        "location": clean_string(item_data.get('location', '')),
        "status": clean_string(item_data.get('status', 'available')).lower(),
        "itemCode": str(item_code),
        "date": clean_string(item_data.get('date_added') or item_data.get('date', '')),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    return transformed_item, errors

def validate_and_transform_equipment(item_data: dict, index: int) -> tuple:
    """Validate and transform equipment item data"""
    errors = []
    
    # Get item name from multiple possible field names
    item_name = (
        item_data.get('item_name') or 
        item_data.get('name') or 
        item_data.get('description') or 
        ''
    )
    
    if isinstance(item_name, float) and pd.isna(item_name):
        item_name = ''
    else:
        item_name = str(item_name).strip()
    
    if not item_name:
        errors.append(f"Row {index + 1}: Equipment name is required")
        return None, errors
    
    # Transform and validate data
    try:
        quantity = item_data.get('quantity', 1)
        quantity = 1 if pd.isna(quantity) else max(1, int(float(quantity)))
    except (ValueError, TypeError):
        quantity = 1
    
    try:
        unit_price = item_data.get('unit_price', 0.0)
        unit_price = 0.0 if pd.isna(unit_price) else max(0.0, float(unit_price))
    except (ValueError, TypeError):
        unit_price = 0.0
    
    # Generate item code if not provided
    category = str(item_data.get('category', 'General')).strip()
    if pd.isna(item_data.get('category')):
        category = 'General'
    
    item_code = item_data.get('itemCode') or item_data.get('item_code', '')
    if pd.isna(item_code) or not str(item_code).strip():
        category_prefix = category[:3].upper()
        random_num = str(abs(hash(f"{item_name}{datetime.utcnow()}")))[:5]
        item_code = f"{category_prefix}-E-{random_num}"
    
    def clean_string(value):
        return '' if pd.isna(value) else str(value).strip()
    
    transformed_item = {
        "name": item_name,
        "description": clean_string(item_data.get('description', item_name)),
        "category": category,
        "quantity": quantity,
        "unit": clean_string(item_data.get('unit', 'UNIT')),
        "location": clean_string(item_data.get('location', '')),
        "status": clean_string(item_data.get('status', 'Operational')),
        "serialNo": clean_string(item_data.get('serialNo') or item_data.get('serial_number', '')),
        "itemCode": str(item_code),
        "unit_price": unit_price,
        "supplier": clean_string(item_data.get('supplier', '')),
        "date": clean_string(item_data.get('date_added') or item_data.get('date', '')),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    return transformed_item, errors

# ===============================================
# ROUTES
# ===============================================

@app.get("/")
async def root():
    return {"message": "MEAMS Asset Management API is running!", "status": "active"}

# ===============================================
# PROFILE ENDPOINTS
# ===============================================

@app.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile information"""
    try:
        # Get user from database based on current_user
        user = get_user_by_username(current_user["sub"])
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Format the response - handle profile picture safely
        profile_picture = user.get("profile_picture")
        
        profile_data = {
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "fullName": user.get("full_name", ""),
            "role": user.get("role", ""),
            "department": user.get("department", ""),
            "phoneNumber": user.get("phone_number", ""),
            "dateJoined": user.get("date_joined", datetime.now().strftime("%Y-%m-%d")),
            "profilePicture": profile_picture  # This can be None
        }
        
        return profile_data  # Return dict instead of ProfileResponse model
        
    except Exception as e:
        print(f"Profile error: {str(e)}")  # Debug print
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {str(e)}")

@app.put("/profile")
async def update_profile(profile_data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user's profile information"""
    try:
        username = current_user["sub"]
        
        # Build update query - only update provided fields
        update_fields = {}
        if profile_data.email is not None:
            update_fields["email"] = profile_data.email
        if profile_data.fullName is not None:
            update_fields["name"] = profile_data.fullName  # Map to 'name' field in database
        if profile_data.department is not None:
            update_fields["department"] = profile_data.department
        if profile_data.phoneNumber is not None:
            update_fields["phone_number"] = profile_data.phoneNumber
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update user in database
        success = update_user_profile(username, update_fields)
        
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get updated user data
        updated_user = get_user_by_username(username)
        
        profile_response = {
            "username": updated_user.get("username", ""),
            "email": updated_user.get("email", ""),
            "fullName": updated_user.get("full_name", ""),
            "role": updated_user.get("role", ""),
            "department": updated_user.get("department", ""),
            "phoneNumber": updated_user.get("phone_number", ""),
            "dateJoined": updated_user.get("date_joined", datetime.now().strftime("%Y-%m-%d")),
            "profilePicture": updated_user.get("profile_picture")  # Handle safely
        }
        
        return profile_response  # Return dict instead of model
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Profile update error: {str(e)}")  # Debug print
        raise HTTPException(status_code=500, detail=f"Error updating profile: {str(e)}")

@app.post("/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change user's password"""
    try:
        username = current_user["sub"]
        
        # Get current user data
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if it's a hardcoded user
        hardcoded_users = {
            "admin": {"password": "password123", "role": "admin"},
            "staff": {"password": "staff123", "role": "staff"},
        }
        
        # Verify current password
        if username in hardcoded_users:
            # For hardcoded users, check against the hardcoded password
            if password_data.current_password != hardcoded_users[username]["password"]:
                raise HTTPException(status_code=400, detail="Current password is incorrect")
        else:
            # For database users, check against hashed password
            if not verify_password(password_data.current_password, user["password"]):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Hash new password
        hashed_new_password = hash_password(password_data.new_password)
        
        # Update password in database
        success = update_user_password(username, hashed_new_password)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update password")
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error changing password: {str(e)}")

# ? NEW: Profile Picture Upload Endpoints
@app.post("/profile/picture")
async def upload_profile_picture(
    request: Request = None,
    token: str = Depends(oauth2_scheme)
):
    """Upload profile picture - accepts JSON with base64 image"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"

    try:
        # Get JSON data from request body
        body = await request.json()
        profile_picture_base64 = body.get("profilePicture")
        
        if not profile_picture_base64:
            raise HTTPException(status_code=400, detail="No profile picture provided")
        
        print(f"?? Uploading profile picture for user: {username}")
        
        # Validate base64 image format
        if not profile_picture_base64.startswith('data:image/'):
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        # Extract content type and base64 data
        header, base64_data = profile_picture_base64.split(',', 1)
        content_type = header.split(':')[1].split(';')[0]
        
        # Validate file size (decode base64 to check size)
        import base64
        image_bytes = base64.b64decode(base64_data)
        if len(image_bytes) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="Image file too large (max 5MB)")
        
        print(f"? Image validated, size: {len(image_bytes)} bytes")
        
        # Update user profile with picture
        if username in ["admin", "staff"]:
            print(f"?? Hardcoded user detected: {username}")
            # For hardcoded users, we'll just return success for now
            success = True
        else:
            print(f"?? Updating database user: {username}")
            # Update database user
            result = accounts_collection.update_one(
                {"username": username},
                {
                    "$set": {
                        "profile_picture": base64_data,  # Store just the base64 data
                        "profile_picture_content_type": content_type,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            success = result.matched_count > 0
            print(f"?? Database update result: {success}")
        
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        await create_log_entry(
            username,
            "Updated profile picture.",
            f"Uploaded new profile picture",
            client_ip
        )
        
        response_data = {
            "success": True,
            "message": "Profile picture updated successfully",
            "profilePicture": profile_picture_base64  # Return the full data URL
        }
        
        print(f"? Profile picture upload successful for {username}")
        return response_data
        
    except HTTPException as he:
        print(f"? HTTP Exception: {he.detail}")
        raise he
    except Exception as e:
        print(f"? Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload profile picture: {str(e)}")


@app.get("/profile/picture")
async def get_profile_picture(token: str = Depends(oauth2_scheme)):
    """Get user's profile picture"""
    payload = verify_token(token)
    username = payload["username"]
    
    try:
        # Check hardcoded users first
        if username in ["admin", "staff"]:
            # Return default or stored picture for hardcoded users
            # You might want to implement a separate storage for these
            return {"profilePicture": None}
        
        # Check database users
        user = accounts_collection.find_one({"username": username})
        if user and user.get("profile_picture"):
                        return {
                "profilePicture": f"data:{user.get('profile_picture_content_type', 'image/jpeg')};base64,{user['profile_picture']}"
            }
        
        return {"profilePicture": None}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get profile picture: {str(e)}")

@app.delete("/profile/picture")
async def delete_profile_picture(request: Request = None, token: str = Depends(oauth2_scheme)):
    """Delete user's profile picture"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        if username in ["admin", "staff"]:
            # Handle hardcoded users
            success = True
        else:
            # Update database user
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
        
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        await create_log_entry(
            username,
            "Deleted profile picture.",
            "Removed profile picture",
            client_ip
        )
        
        return {"success": True, "message": "Profile picture deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete profile picture: {str(e)}")

# ===============================================
# EXISTING ROUTES (LOGIN, LOGOUT, ETC.)
# ===============================================

@app.post("/login")
async def login(user: User, request: Request):
    """Login endpoint for authentication"""
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    # Check hardcoded users
    valid_users = {
        "admin": {"password": "password123", "role": "admin"},
        "staff": {"password": "staff123", "role": "staff"},
    }
    
    if user.username in valid_users and user.password == valid_users[user.username]["password"]:
        role = valid_users[user.username]["role"]
        await create_log_entry(user.username, "Logged in.", f"Role: {role}", client_ip)
        access_token = create_access_token(data={"sub": user.username, "role": role})
        return {"access_token": access_token, "token_type": "bearer", "first_login": False}
    
    # Check database users
    try:
        db_user = accounts_collection.find_one({"username": user.username})
        if db_user and verify_password(user.password, db_user["password_hash"]):
            role = db_user.get("role", "staff")
            first_login = db_user.get("first_login", True)
            
            # Update last login
            accounts_collection.update_one(
                {"_id": db_user["_id"]},
                {"$set": {"last_login": datetime.utcnow().strftime("%m/%d/%Y")}}
            )
            
            await create_log_entry(user.username, "Logged in.", f"Role: {role}", client_ip)
            access_token = create_access_token(data={"sub": user.username, "role": role})
            return {"access_token": access_token, "token_type": "bearer", "first_login": first_login}
    except Exception as e:
        print(f"Error checking database users: {str(e)}")
    
    # Log failed attempt
    await create_log_entry(user.username, "Failed login attempt.", "Invalid credentials", client_ip)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

@app.post("/api/change-password")
async def change_password_api(password_change: PasswordChangeRequest, request: Request, token: str = Depends(oauth2_scheme)):
    """Change password (API endpoint)"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        user = accounts_collection.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if not verify_password(password_change.current_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        new_password_hash = hash_password(password_change.new_password)
        
        accounts_collection.update_one(
            {"username": username},
            {"$set": {"password_hash": new_password_hash, "first_login": False, "updated_at": datetime.utcnow()}}
        )
        
        await create_log_entry(username, "Changed password.", "Password updated successfully", client_ip)
        return {"success": True, "message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to change password: {str(e)}")
    
@app.post("/logout")
async def logout(request: Request, token: str = Depends(oauth2_scheme)):
    """Logout endpoint"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    await create_log_entry(username, "Logged out.", "", client_ip)
    return {"message": "Successfully logged out"}

@app.post("/api/bulk-import")
async def bulk_import(file: UploadFile = File(...), import_type: str = Form("supplies"), request: Request = None, token: str = Depends(oauth2_scheme)):
    """Bulk import endpoint"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        allowed_extensions = ['.csv', '.xls', '.xlsx']
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}")
        
        contents = await file.read()
        
        try:
            if file_extension == '.csv':
                df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
            else:
                df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
        
        if df.empty:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        raw_data = df.to_dict('records')
        
        valid_items = []
        all_errors = []
        
        for index, item_data in enumerate(raw_data):
            # Skip empty rows
            if all(pd.isna(value) or str(value).strip() == '' for value in item_data.values()):
                continue
            
            if import_type == "supplies":
                transformed_item, errors = validate_and_transform_supply(item_data, index)
            elif import_type == "equipment":
                transformed_item, errors = validate_and_transform_equipment(item_data, index)
            else:
                raise HTTPException(status_code=400, detail="Invalid import_type. Must be 'supplies' or 'equipment'")
            
            if transformed_item:
                valid_items.append(transformed_item)
            all_errors.extend(errors)
        
        if not valid_items:
            raise HTTPException(status_code=400, detail="No valid items found to import")
        
        # Insert items
        saved_items = []
        collection = supplies_collection if import_type == "supplies" else equipment_collection
        helper_function = supply_helper if import_type == "supplies" else equipment_helper
        
        for item in valid_items:
            try:
                existing_item = collection.find_one({"itemCode": item["itemCode"]})
                if existing_item:
                    if import_type == "supplies":
                        collection.update_one(
                            {"_id": existing_item["_id"]},
                            {"$inc": {"quantity": item["quantity"]}, "$set": {"updated_at": datetime.utcnow()}}
                        )
                    else:
                        collection.update_one(
                            {"_id": existing_item["_id"]},
                            {"$set": {**item, "updated_at": datetime.utcnow()}}
                        )
                    updated_item = collection.find_one({"_id": existing_item["_id"]})
                    saved_items.append(helper_function(updated_item))
                else:
                    result = collection.insert_one(item)
                    created_item = collection.find_one({"_id": result.inserted_id})
                    saved_items.append(helper_function(created_item))
            except Exception as e:
                print(f"Error saving item: {e}")
        
        await create_log_entry(
            username,
            f"Bulk imported {import_type}.",
            f"Imported {len(saved_items)} {import_type} from file: {file.filename}",
            client_ip
        )
        
        return {
            "success": True,
            "message": f"Successfully imported {len(saved_items)} {import_type} items",
            "imported_count": len(saved_items),
            "error_count": len(all_errors),
            "errors": all_errors,
            "imported_items": saved_items
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

# Supply routes
@app.get("/api/supplies")
async def get_all_supplies(token: str = Depends(oauth2_scheme)):
    verify_token(token)
    supplies = [supply_helper(supply) for supply in supplies_collection.find()]
    return {"success": True, "message": f"Found {len(supplies)} supplies", "data": supplies}

@app.post("/api/supplies")
async def add_supply(supply: SupplyCreate, request: Request, token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    supply_dict = supply.dict(exclude_none=False)
    
    # Debug print (optional)
    print(f"Received itemPicture length: {len(str(supply_dict.get('itemPicture', '')))}")
    
    supply_dict["created_at"] = supply_dict["updated_at"] = datetime.utcnow()
    
    # Store base64 image string if provided
    if supply_dict.get("itemPicture"):
       print(f"DEBUG: Received image_filename = {supply_dict.get('image_filename')}")
       supply_dict["image_data"] = supply_dict["itemPicture"]
    # Use actual filename if present, else fallback
       filename = supply_dict.get("image_filename")
       if filename is None or filename.strip() == "":
        filename = "unknown_filename"
       supply_dict["image_filename"] = filename
       supply_dict["image_content_type"] = supply_dict.get("image_content_type") or "image/jpeg"
    else:
       supply_dict["image_data"] = None
       supply_dict["image_filename"] = None
       supply_dict["image_content_type"] = None

    
    # Remove itemPicture before saving
    supply_dict.pop("itemPicture", None)
    
    # Generate itemCode if missing
    if not supply_dict.get("itemCode"):
        category_prefix = supply_dict.get("category", "SUP")[:3].upper()
        random_num = str(abs(hash(str(datetime.utcnow()))))[:5]
        supply_dict["itemCode"] = f"{category_prefix}-{random_num}"
    
    result = supplies_collection.insert_one(supply_dict)
    created_supply = supplies_collection.find_one({"_id": result.inserted_id})
    
    await create_log_entry(
        username,
        "Added a supply." + (" (with image)" if supply_dict.get("image_data") else ""),
        f"Added supply: {supply_dict.get('name', 'Unknown')} ({supply_dict.get('itemCode')})",
        client_ip
    )
    
    return {"success": True, "message": "Supply added successfully", "data": supply_helper(created_supply)}

@app.get("/api/supplies/{supply_id}")
async def get_supply(supply_id: str, token: str = Depends(oauth2_scheme)):
    verify_token(token)
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    return {"success": True, "message": "Supply found", "data": supply_helper(supply)}

@app.put("/api/supplies/{supply_id}")
async def update_supply(supply_id: str, supply_update: SupplyUpdate, request: Request, token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    supply_before = supplies_collection.find_one({"_id": ObjectId(supply_id)})
    if not supply_before:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    update_data = {k: v for k, v in supply_update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = supplies_collection.update_one({"_id": ObjectId(supply_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    updated_supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
    
    await create_log_entry(
        username,
        "Updated a supply.",
        f"Updated supply: {supply_before.get('name', 'Unknown')} ({supply_before.get('itemCode')})",
        client_ip
    )
    
    return {"success": True, "message": "Supply updated successfully", "data": supply_helper(updated_supply)}

@app.delete("/api/supplies/{supply_id}")
async def delete_supply(supply_id: str, request: Request, token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    supply_to_delete = supplies_collection.find_one({"_id": ObjectId(supply_id)})
    if not supply_to_delete:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    result = supplies_collection.delete_one({"_id": ObjectId(supply_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    await create_log_entry(
        username,
        "Deleted a supply.",
        f"Deleted supply: {supply_to_delete.get('name', 'Unknown')} ({supply_to_delete.get('itemCode')})",
        client_ip
    )
    
    return {"success": True, "message": "Supply deleted successfully"}

@app.post("/api/supplies/with-image")
async def add_supply_with_image(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(...),
    quantity: int = Form(...),
    supplier: str = Form(""),
    location: str = Form(""),
    status: str = Form("available"),
    itemCode: str = Form(""),
    date: str = Form(""),
    unit: str = Form("UNIT"),
    unit_price: float = Form(0.0),
    serialNo: str = Form(""),
    image: Optional[UploadFile] = File(None),
    request: Request = None,
    token: str = Depends(oauth2_scheme)
):
    """Add supply with image file upload"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"

    try:
        # Validate required fields
        if not name.strip():
            raise HTTPException(status_code=400, detail="Supply name is required")
        if not description.strip():
            raise HTTPException(status_code=400, detail="Supply description is required")
        if not category.strip():
            raise HTTPException(status_code=400, detail="Supply category is required")
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Supply quantity must be greater than 0")
        
        # Create supply document
        supply_dict = {
            "name": name.strip(),
            "description": description.strip(),
            "category": category.strip(),
            "quantity": quantity,
            "supplier": supplier.strip(),
            "location": location.strip(),
            "status": status,
            "itemCode": itemCode.strip(),
            "date": date,
            "unit": unit,
            "unit_price": unit_price,
            "serialNo": serialNo.strip(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # Generate item code if not provided
        if not supply_dict.get("itemCode"):
            category_prefix = supply_dict.get("category", "SUP")[:3].upper()
            random_num = str(abs(hash(str(datetime.utcnow()))))[:5]
            supply_dict["itemCode"] = f"{category_prefix}-{random_num}"
        
        # Handle image upload
        if image and image.filename:
            # Validate image file
            if not image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="File must be an image")
            
            # Check file size (limit to 5MB)
            contents = await image.read()
            if len(contents) > 5 * 1024 * 1024:  # 5MB
                raise HTTPException(status_code=400, detail="Image file too large (max 5MB)")
            
            # Store image as base64
            image_base64 = base64.b64encode(contents).decode('utf-8')
            supply_dict["image_data"] = image_base64
            supply_dict["image_filename"] = image.filename
            supply_dict["image_content_type"] = image.content_type
        
        # Insert supply
        result = supplies_collection.insert_one(supply_dict)
        created_supply = supplies_collection.find_one({"_id": result.inserted_id})
        
        await create_log_entry(
            username,
            "Added a supply with image." if image else "Added a supply.",
            f"Added supply: {supply_dict.get('name')} ({supply_dict.get('itemCode')})",
            client_ip
        )
        
        return {"success": True, "message": "Supply added successfully", "data": supply_helper(created_supply)}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add supply: {str(e)}")
    
@app.post("/api/supplies/{supply_id}/image")
async def upload_supply_image(
    supply_id: str,
    image: UploadFile = File(...),
    request: Request = None,
    token: str = Depends(oauth2_scheme)
):
    """Upload image for existing supply"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"

    try:
        if not ObjectId.is_valid(supply_id):
            raise HTTPException(status_code=400, detail="Invalid supply ID format")
        
        # Check if supply exists
        supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        if not supply:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        # Validate image file
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Check file size (limit to 5MB)
        contents = await image.read()
        if len(contents) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="Image file too large (max 5MB)")
        
        # Store image as base64
        image_base64 = base64.b64encode(contents).decode('utf-8')

         # Update supply with image
        supplies_collection.update_one(
            {"_id": ObjectId(supply_id)},
            {
                "$set": {
                    "image_data": image_base64,
                    "image_filename": image.filename,
                    "image_content_type": image.content_type,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        updated_supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        
        await create_log_entry(
            username,
            "Uploaded supply image.",
            f"Uploaded image for supply: {supply.get('name')} ({supply.get('itemCode')})",
            client_ip
        )

        return {"success": True, "message": "Image uploaded successfully", "data": supply_helper(updated_supply)}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@app.get("/api/supplies/{supply_id}/image")
async def get_supply_image(supply_id: str, token: str = Depends(oauth2_scheme)):
    """Get supply image"""
    verify_token(token)
    
    try:
        if not ObjectId.is_valid(supply_id):
            raise HTTPException(status_code=400, detail="Invalid supply ID format")
        
        supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        if not supply:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        if not supply.get("image_data"):
            raise HTTPException(status_code=404, detail="No image found for this supply")
        
        # Decode base64 image
        image_data = base64.b64decode(supply["image_data"])
        content_type = supply.get("image_content_type", "image/jpeg")
        
        return Response(content=image_data, media_type=content_type)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve image: {str(e)}")
    
@app.delete("/api/supplies/{supply_id}/image")
async def delete_supply_image(
    supply_id: str,
    request: Request = None,
    token: str = Depends(oauth2_scheme)
):
    """Delete supply image"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        if not ObjectId.is_valid(supply_id):
            raise HTTPException(status_code=400, detail="Invalid supply ID format")
        
        supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        if not supply:
            raise HTTPException(status_code=404, detail="Supply not found")
        # Remove image fields
        supplies_collection.update_one(
            {"_id": ObjectId(supply_id)},
            {
                "$unset": {
                    "image_data": "",
                    "image_filename": "",
                    "image_content_type": ""
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        updated_supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        
        await create_log_entry(
            username,
            "Deleted supply image.",
            f"Deleted image for supply: {supply.get('name')} ({supply.get('itemCode')})",
            client_ip
        )
        
        return {"success": True, "message": "Image deleted successfully", "data": supply_helper(updated_supply)}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete image: {str(e)}")

# Equipment routes
@app.get("/api/equipment")
async def get_all_equipment(token: str = Depends(oauth2_scheme)):
    verify_token(token)
    equipment_list = [equipment_helper(equipment) for equipment in equipment_collection.find()]
    return {"success": True, "message": f"Found {len(equipment_list)} equipment items", "data": equipment_list}

@app.post("/api/equipment")
async def add_equipment(
    equipment: EquipmentCreate = Body(...),
    request: Request = None,
    token: str = Depends(oauth2_scheme)
):
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    try:
        # Validate required fields
        if not equipment.name.strip():
            raise HTTPException(status_code=400, detail="Equipment name is required")
        if not equipment.description.strip():
            raise HTTPException(status_code=400, detail="Equipment description is required")
        if not equipment.category.strip():
            raise HTTPException(status_code=400, detail="Equipment category is required")
        if equipment.quantity <= 0:
            raise HTTPException(status_code=400, detail="Equipment quantity must be greater than 0")
        
        equip_dict = equipment.dict()

        if not equip_dict.get("image_data"):
         equip_dict["image_data"] = None
        if not equip_dict.get("image_filename"):
         equip_dict["image_filename"] = None
        if not equip_dict.get("image_content_type"):
         equip_dict["image_content_type"] = None
       # Generate itemCode if not provided
        if not equip_dict.get("itemCode"):
         category_prefix = equip_dict.get("category", "EQP")[:3].upper()
         random_num = str(abs(hash(f"{equip_dict['name']}{datetime.utcnow()}")))[:5]
         equip_dict["itemCode"] = f"{category_prefix}-E-{random_num}"
         equip_dict["created_at"] = equip_dict["updated_at"] = datetime.utcnow()
         print(f"Adding equipment with image data length: {len(equip_dict['image_data']) if equip_dict['image_data'] else 0}")
         
        result = equipment_collection.insert_one(equip_dict)
        created_equipment = equipment_collection.find_one({"_id": result.inserted_id})

        await create_log_entry(
            username,
            "Added equipment.",
            f"Added equipment: {equip_dict.get('name')} ({equip_dict.get('itemCode')})",
            client_ip
        )
        
        return {"success": True, "message": "Equipment added successfully", "data": equipment_helper(created_equipment)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add equipment: {str(e)}")

@app.post("/api/equipment/{equipment_id}/image")
async def upload_equipment_image(
    equipment_id: str,
    image: UploadFile = File(...),
    request: Request = None,
    token: str = Depends(oauth2_scheme)
):
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    equipment = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    contents = await image.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="Image file too large (max 5MB)")
    
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    equipment_collection.update_one(
        {"_id": ObjectId(equipment_id)},
        {
            "$set": {
                "image_data": image_base64,
                "image_filename": image.filename,
                "image_content_type": image.content_type,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    updated_equipment = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
    
    await create_log_entry(
        username,
        "Uploaded equipment image.",
        f"Uploaded image for equipment: {equipment.get('name')} ({equipment.get('itemCode')})",
        client_ip
    )
    
    return {"success": True, "message": "Image uploaded successfully", "data": equipment_helper(updated_equipment)}

@app.get("/api/equipment/{equipment_id}")
async def get_equipment(equipment_id: str, token: str = Depends(oauth2_scheme)):
    verify_token(token)
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    equipment = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    return {"success": True, "message": "Equipment found", "data": equipment_helper(equipment)}

@app.put("/api/equipment/{equipment_id}")
async def update_equipment(equipment_id: str, equipment_update: EquipmentUpdate, request: Request, token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    equipment_before = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment_before:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    update_data = {k: v for k, v in equipment_update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = equipment_collection.update_one({"_id": ObjectId(equipment_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    updated_equipment = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
    
    await create_log_entry(
        username,
        "Updated equipment.",
        f"Updated equipment: {equipment_before.get('name', 'Unknown')} ({equipment_before.get('itemCode')})",
        client_ip
    )
    
    return {"success": True, "message": "Equipment updated successfully", "data": equipment_helper(updated_equipment)}

@app.delete("/api/equipment/{equipment_id}")
async def delete_equipment(equipment_id: str, request: Request, token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    equipment_to_delete = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment_to_delete:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    result = equipment_collection.delete_one({"_id": ObjectId(equipment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    await create_log_entry(
        username,
        "Deleted equipment.",
        f"Deleted equipment: {equipment_to_delete.get('name', 'Unknown')} ({equipment_to_delete.get('itemCode')})",
        client_ip
    )
    
    return {"success": True, "message": "Equipment deleted successfully"}

# --- Supplies Forecast Endpoint ---
@app.get("/api/forecast-supplies", response_model=dict)
async def get_forecast_supplies(token: str = Depends(oauth2_scheme), n_periods: int = 12):
    verify_token(token)
    raw_data = list(historical_supplies_forecast_collection.find({}, {"_id": 0}))
    if not raw_data:
        return {"success": True, "message": "No historical supplies data for forecasting.", "data": []}

    df = pd.DataFrame(raw_data)
    if 'date' not in df.columns or 'quantity' not in df.columns:
        raise HTTPException(status_code=400, detail="Missing 'date' or 'quantity' in supplies data")

    # Bootstrap synthetic years 2021–2024
    boot_df = bootstrap_years(df, date_col='date', value_col='quantity', start_year=2021, end_year=2024)

    # Run SARIMA forecast for 2025
    forecast_df = generate_sarima_forecast(boot_df, date_col='date', value_col='quantity', n_periods=n_periods, seasonal_period=12)

    forecast_df['date'] = forecast_df['date'].dt.strftime('%Y-%m-%d')
    return {"success": True, "data": forecast_df.to_dict(orient='records')}


# --- Equipment Forecast Endpoint ---
@app.get("/api/forecast-equipment", response_model=dict)
async def get_forecast_equipment(token: str = Depends(oauth2_scheme), n_periods: int = 12):
    verify_token(token)
    raw_data = list(historical_equipment_forecast_collection.find({}, {"_id": 0}))
    if not raw_data:
        return {"success": True, "message": "No historical equipment data for forecasting.", "data": []}

    df = pd.DataFrame(raw_data)
    if 'date' not in df.columns or 'quantity' not in df.columns:
        raise HTTPException(status_code=400, detail="Missing 'date' or 'quantity' in equipment data")

    # Bootstrap synthetic years 2021–2024
    boot_df = bootstrap_years(df, date_col='date', value_col='quantity', start_year=2021, end_year=2024)

    # Run SARIMA forecast for 2025
    forecast_df = generate_sarima_forecast(boot_df, date_col='date', value_col='quantity', n_periods=n_periods, seasonal_period=12)

    forecast_df['date'] = forecast_df['date'].dt.strftime('%Y-%m-%d')
    return {"success": True, "data": forecast_df.to_dict(orient='records')}

# Logs routes
@app.get("/api/logs")
async def get_logs(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None,
    token: str = Depends(oauth2_scheme)
):
    """Get logs with optional filtering - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required to view logs.")
    
    try:
        query = {}
        
        # Date filtering
        if date_from or date_to:
            date_query = {}
            if date_from:
                try:
                    from_date = datetime.strptime(date_from, "%Y-%m-%d")
                    date_query["$gte"] = from_date
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")
            
            if date_to:
                try:
                    to_date = datetime.strptime(date_to, "%Y-%m-%d")
                    to_date = to_date + timedelta(days=1) - timedelta(seconds=1)
                    date_query["$lte"] = to_date
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")
            
            query["timestamp"] = date_query
        
        # Username filtering
        if username and username != "ALL USERS":
            query["username"] = {"$regex": username, "$options": "i"}
        
        # Search filtering
        if search:
            query["$or"] = [
                {"action": {"$regex": search, "$options": "i"}},
                {"details": {"$regex": search, "$options": "i"}},
                {"username": {"$regex": search, "$options": "i"}}
            ]
        
        # Fetch logs
        logs_cursor = logs_collection.find(query).sort("timestamp", -1).limit(1000)
        
        logs = []
        usernames_set = set()
        
        for log in logs_cursor:
            formatted_log = log_helper(log)
            formatted_log["remarks"] = f"{formatted_log['action']} {formatted_log['details']}".strip()
            logs.append(formatted_log)
            usernames_set.add(log.get("username", ""))
        
        usernames = ["ALL USERS"] + sorted(list(usernames_set - {""}))
        
        return {
            "success": True,
            "message": f"Found {len(logs)} log entries",
            "data": logs,
            "usernames": usernames
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch logs: {str(e)}")

@app.post("/api/logs/export")
async def export_logs(filters: LogsFilter, token: str = Depends(oauth2_scheme)):
    """Export logs as CSV - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required to export logs.")
    
    try:
        query = {}
        
        # Date filtering
        if filters.date_from or filters.date_to:
            date_query = {}
            if filters.date_from:
                from_date = datetime.strptime(filters.date_from, "%Y-%m-%d")
                date_query["$gte"] = from_date
            if filters.date_to:
                to_date = datetime.strptime(filters.date_to, "%Y-%m-%d")
                to_date = to_date + timedelta(days=1) - timedelta(seconds=1)
                date_query["$lte"] = to_date
            query["timestamp"] = date_query
        
        # Username filtering
        if filters.username and filters.username != "ALL USERS":
            query["username"] = {"$regex": filters.username, "$options": "i"}
        
        # Search filtering
        if filters.search:
            query["$or"] = [
                {"action": {"$regex": filters.search, "$options": "i"}},
                {"details": {"$regex": filters.search, "$options": "i"}},
                {"username": {"$regex": filters.search, "$options": "i"}}
            ]
        
        # Fetch and convert to CSV
        logs_cursor = logs_collection.find(query).sort("timestamp", -1)
        csv_rows = ["Timestamp,Username,Action,Details,IP Address"]
        
        for log in logs_cursor:
            timestamp = log.get("formatted_timestamp", log.get("timestamp", ""))
            username = log.get("username", "")
            action = log.get("action", "")
            details = log.get("details", "")
            ip_address = log.get("ip_address", "unknown")
            
            def escape_csv_field(field):
                field = str(field).replace('"', '""')
                if ',' in field or '"' in field or '\n' in field:
                    field = f'"{field}"'
                return field
            
            csv_row = f"{escape_csv_field(timestamp)},{escape_csv_field(username)},{escape_csv_field(action)},{escape_csv_field(details)},{escape_csv_field(ip_address)}"
            csv_rows.append(csv_row)
        
        csv_data = "\n".join(csv_rows)
        current_date = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"meams_logs_{current_date}.csv"
        
        await create_log_entry(
            payload["username"],
            "Exported logs.",
            f"Exported {len(csv_rows) - 1} log entries to CSV",
            "system"
        )
        
        return {
            "success": True,
            "message": f"Exported {len(csv_rows) - 1} log entries",
            "csv_data": csv_data,
            "filename": filename
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export logs: {str(e)}")
    
    
@app.get("/api/accounts")
async def get_all_accounts(token: str = Depends(oauth2_scheme)):
    """Get all accounts - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    try:
        accounts = [account_helper(account) for account in accounts_collection.find()]
        return {"success": True, "message": f"Found {len(accounts)} accounts", "data": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch accounts: {str(e)}")

@app.post("/api/accounts")
async def create_account(account: AccountCreate, request: Request, token: str = Depends(oauth2_scheme)):
    """Create a new account - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    try:
        # Check if username or email already exists
        existing_user = accounts_collection.find_one({
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
        
        # Generate secure password
        temp_password = generate_secure_password()
        password_hash = hash_password(temp_password)
        
        # Create account document
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
        
        # Insert account
        result = accounts_collection.insert_one(account_dict)
        created_account = accounts_collection.find_one({"_id": result.inserted_id})
        
        # Send password email
        email_subject = "MEAMS Account Created - Login Credentials"
        email_body = f"""
        <html>
        <body>
            <h2>Welcome to MEAMS Asset Management System</h2>
            <p>Hello {account.name},</p>
            <p>Your account has been created successfully. Here are your login credentials:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <p><strong>Username:</strong> {account.username}</p>
                <p><strong>Temporary Password:</strong> {temp_password}</p>
            </div>
            <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
            <p>You can access the system at: <a href="http://localhost:3000">MEAMS System</a></p>
            <p>If you have any questions, please contact your system administrator.</p>
            <br>
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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")

@app.put("/api/accounts/{account_id}")
async def update_account(
    account_id: str,
    account_update: AccountUpdate,
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    """Update an account - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        account_before = accounts_collection.find_one({"_id": ObjectId(account_id)})
        if not account_before:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Build update data
        update_data = {}
        for field, value in account_update.dict().items():
            if value is not None:
                update_data[field] = value
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        # Check for username/email conflicts if being updated
        if "username" in update_data or "email" in update_data:
            conflict_query = {"_id": {"$ne": ObjectId(account_id)}}
            or_conditions = []
            
            if "username" in update_data:
                or_conditions.append({"username": update_data["username"]})
            if "email" in update_data:
                or_conditions.append({"email": update_data["email"]})
            
            if or_conditions:
                conflict_query["$or"] = or_conditions
                existing_account = accounts_collection.find_one(conflict_query)
                
                if existing_account:
                    if "username" in update_data and existing_account.get("username") == update_data["username"]:
                        raise HTTPException(status_code=400, detail="Username already exists")
                    if "email" in update_data and existing_account.get("email") == update_data["email"]:
                        raise HTTPException(status_code=400, detail="Email already exists")
        
        update_data["updated_at"] = datetime.utcnow()
        
        # Update account
        result = accounts_collection.update_one(
            {"_id": ObjectId(account_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")
        
        updated_account = accounts_collection.find_one({"_id": ObjectId(account_id)})
        
        await create_log_entry(
            username,
            "Updated account.",
            f"Updated account: {account_before.get('name', 'Unknown')} ({account_before.get('username')})",
            client_ip
        )
        
        return {
            "success": True,
            "message": "Account updated successfully",
            "data": account_helper(updated_account)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update account: {str(e)}")

@app.delete("/api/accounts/{account_id}")
async def delete_account(account_id: str, request: Request, token: str = Depends(oauth2_scheme)):
    """Delete an account - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        account_to_delete = accounts_collection.find_one({"_id": ObjectId(account_id)})
        if not account_to_delete:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Prevent deletion of the current admin user
        if account_to_delete.get("username") == username:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
        result = accounts_collection.delete_one({"_id": ObjectId(account_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")
        
        await create_log_entry(
            username,
            "Deleted account.",
            f"Deleted account: {account_to_delete.get('name', 'Unknown')} ({account_to_delete.get('username')})",
            client_ip
        )
        
        return {"success": True, "message": "Account deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

@app.post("/api/accounts/{account_id}/reset-password")
async def reset_account_password(account_id: str, request: Request, token: str = Depends(oauth2_scheme)):
    """Reset an account's password - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        account = accounts_collection.find_one({"_id": ObjectId(account_id)})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Generate new password
        new_password = generate_secure_password()
        password_hash = hash_password(new_password)
        
        # Update account with new password
        accounts_collection.update_one(
            {"_id": ObjectId(account_id)},
            {
                "$set": {
                    "password_hash": password_hash,
                    "first_login": True,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Send password reset email
        email_subject = "MEAMS Password Reset - New Login Credentials"
        email_body = f"""
        <html>
        <body>
            <h2>MEAMS Password Reset</h2>
            <p>Hello {account.get('name', 'User')},</p>
            <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <p><strong>Username:</strong> {account.get('username')}</p>
                <p><strong>New Password:</strong> {new_password}</p>
            </div>
            <p><strong>Important:</strong> Please change your password after logging in for security purposes.</p>
            <p>You can access the system at: <a href="http://localhost:3000">MEAMS System</a></p>
            <br>
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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")

# Export routes
@app.get("/api/export/supplies")
async def export_supplies(token: str = Depends(oauth2_scheme)):
    """Export supplies data as CSV"""
    payload = verify_token(token)
    username = payload["username"]
    
    try:
        supplies = list(supplies_collection.find())
        
        if not supplies:
            return {
                "success": True,
                "message": "No supplies data found",
                "data": [],
                "csv_data": "name,description,category,quantity,supplier,location,status,itemCode,date\n",
                "filename": f"supplies_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        
        # Convert to CSV format
        csv_rows = ["name,description,category,quantity,supplier,location,status,itemCode,date"]
        
        for supply in supplies:
            row_data = [
                str(supply.get('name', '')),
                str(supply.get('description', '')),
                str(supply.get('category', '')),
                str(supply.get('quantity', 0)),
                str(supply.get('supplier', '')),
                str(supply.get('location', '')),
                str(supply.get('status', 'available')),
                str(supply.get('itemCode', '')),
                str(supply.get('date', ''))
            ]
            
            # Escape CSV fields
            escaped_row = []
            for field in row_data:
                if ',' in field or '"' in field or '\n' in field:
                    field = f'"{field.replace('"', '""')}"'
                escaped_row.append(field)
            
            csv_rows.append(','.join(escaped_row))
        
        csv_data = '\n'.join(csv_rows)
        filename = f"supplies_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # Log the export action
        await create_log_entry(
            username,
            "Exported supplies data.",
            f"Exported {len(supplies)} supplies to CSV",
            "system"
        )
        
        return {
            "success": True,
            "message": f"Successfully exported {len(supplies)} supplies",
            "data": [supply_helper(supply) for supply in supplies],
            "csv_data": csv_data,
            "filename": filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export supplies: {str(e)}")

@app.get("/api/export/equipment")
async def export_equipment(token: str = Depends(oauth2_scheme)):
    """Export equipment data as CSV"""
    payload = verify_token(token)
    username = payload["username"]
    
    try:
        equipment_list = list(equipment_collection.find())
        
        if not equipment_list:
            return {
                "success": True,
                "message": "No equipment data found",
                "data": [],
                "csv_data": "name,description,category,quantity,unit,location,status,serialNo,itemCode,unit_price,supplier,date\n",
                "filename": f"equipment_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        
        # Convert to CSV format
        csv_rows = ["name,description,category,quantity,unit,location,status,serialNo,itemCode,unit_price,supplier,date"]
        
        for equipment in equipment_list:
            row_data = [
                str(equipment.get('name', '')),
                str(equipment.get('description', '')),
                str(equipment.get('category', '')),
                str(equipment.get('quantity', 1)),
                str(equipment.get('unit', 'UNIT')),
                str(equipment.get('location', '')),
                str(equipment.get('status', 'Operational')),
                str(equipment.get('serialNo', '')),
                str(equipment.get('itemCode', '')),
                str(equipment.get('unit_price', 0.0)),
                str(equipment.get('supplier', '')),
                str(equipment.get('date', ''))
            ]
            
            # Escape CSV fields
            escaped_row = []
            for field in row_data:
                if ',' in field or '"' in field or '\n' in field:
                    field = f'"{field.replace('"', '""')}"'
                escaped_row.append(field)
            
            csv_rows.append(','.join(escaped_row))
        
        csv_data = '\n'.join(csv_rows)
        filename = f"equipment_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # Log the export action
        await create_log_entry(
            username,
            "Exported equipment data.",
            f"Exported {len(equipment_list)} equipment items to CSV",
            "system"
        )
        
        return {
            "success": True,
            "message": f"Successfully exported {len(equipment_list)} equipment items",
            "data": [equipment_helper(equipment) for equipment in equipment_list],
            "csv_data": csv_data,
            "filename": filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export equipment: {str(e)}")

@app.get("/api/export/accounts")
async def export_accounts(token: str = Depends(oauth2_scheme)):
    """Export user accounts data as CSV - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    try:
        accounts = list(accounts_collection.find())
        
        if not accounts:
            return {
                "success": True,
                "message": "No accounts data found",
                "data": [],
                "csv_data": "name,username,email,role,department,position,phone_number,status,account_creation,last_login\n",
                "filename": f"accounts_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        
        # Convert to CSV format (excluding sensitive data like password_hash)
        csv_rows = ["name,username,email,role,department,position,phone_number,status,account_creation,last_login"]
        
        for account in accounts:
            row_data = [
                str(account.get('name', '')),
                str(account.get('username', '')),
                str(account.get('email', '')),
                str(account.get('role', 'staff')),
                str(account.get('department', '')),
                str(account.get('position', '')),
                str(account.get('phone_number', '')),
                str(account.get('status', True)),
                str(account.get('account_creation', '')),
                str(account.get('last_login', 'Never'))
            ]
            
            # Escape CSV fields
            escaped_row = []
            for field in row_data:
                if ',' in field or '"' in field or '\n' in field:
                    field = f'"{field.replace('"', '""')}"'
                escaped_row.append(field)
            
            csv_rows.append(','.join(escaped_row))
        
        csv_data = '\n'.join(csv_rows)
        filename = f"accounts_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # Log the export action
        await create_log_entry(
            username,
            "Exported accounts data.",
            f"Exported {len(accounts)} user accounts to CSV",
            "system"
        )
        
        return {
            "success": True,
            "message": f"Successfully exported {len(accounts)} accounts",
            "data": [account_helper(account) for account in accounts],
            "csv_data": csv_data,
            "filename": filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export accounts: {str(e)}")

@app.get("/api/export/all")
async def export_all_data(token: str = Depends(oauth2_scheme)):
    """Export all system data as multiple CSV files in a ZIP format"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    try:
        import zipfile
        import io
        
        # Create a ZIP file in memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Export supplies
            supplies = list(supplies_collection.find())
            if supplies:
                supplies_csv = "name,description,category,quantity,supplier,location,status,itemCode,date\n"
                for supply in supplies:
                    row_data = [
                        str(supply.get('name', '')),
                        str(supply.get('description', '')),
                        str(supply.get('category', '')),
                        str(supply.get('quantity', 0)),
                        str(supply.get('supplier', '')),
                        str(supply.get('location', '')),
                        str(supply.get('status', 'available')),
                        str(supply.get('itemCode', '')),
                        str(supply.get('date', ''))
                    ]
                    escaped_row = [f'"{field.replace('"', '""')}"' if ',' in field or '"' in field else field for field in row_data]
                    supplies_csv += ','.join(escaped_row) + '\n'
                
                zip_file.writestr('supplies.csv', supplies_csv)
            
            # Export equipment
            equipment_list = list(equipment_collection.find())
            if equipment_list:
                equipment_csv = "name,description,category,quantity,unit,location,status,serialNo,itemCode,unit_price,supplier,date\n"
                for equipment in equipment_list:
                    row_data = [
                        str(equipment.get('name', '')),
                        str(equipment.get('description', '')),
                        str(equipment.get('category', '')),
                        str(equipment.get('quantity', 1)),
                        str(equipment.get('unit', 'UNIT')),
                        str(equipment.get('location', '')),
                        str(equipment.get('status', 'Operational')),
                        str(equipment.get('serialNo', '')),
                        str(equipment.get('itemCode', '')),
                        str(equipment.get('unit_price', 0.0)),
                        str(equipment.get('supplier', '')),
                        str(equipment.get('date', ''))
                    ]
                    escaped_row = [f'"{field.replace('"', '""')}"' if ',' in field or '"' in field else field for field in row_data]
                    equipment_csv += ','.join(escaped_row) + '\n'
                
                zip_file.writestr('equipment.csv', equipment_csv)
            
            # Export accounts (admin only)
            accounts = list(accounts_collection.find())
            if accounts:
                accounts_csv = "name,username,email,role,department,position,phone_number,status,account_creation,last_login\n"
                for account in accounts:
                    row_data = [
                        str(account.get('name', '')),
                        str(account.get('username', '')),
                        str(account.get('email', '')),
                        str(account.get('role', 'staff')),
                        str(account.get('department', '')),
                        str(account.get('position', '')),
                        str(account.get('phone_number', '')),
                        str(account.get('status', True)),
                        str(account.get('account_creation', '')),
                        str(account.get('last_login', 'Never'))
                    ]
                    escaped_row = [f'"{field.replace('"', '""')}"' if ',' in field or '"' in field else field for field in row_data]
                    accounts_csv += ','.join(escaped_row) + '\n'
                
                zip_file.writestr('accounts.csv', accounts_csv)
        
        # Convert ZIP to base64 for transmission
        import base64
        zip_buffer.seek(0)
        zip_data = base64.b64encode(zip_buffer.getvalue()).decode('utf-8')
        
        filename = f"meams_all_data_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"
        
        # Log the export action
        await create_log_entry(
            username,
            "Exported all system data.",
            f"Exported complete system data (supplies: {len(supplies)}, equipment: {len(equipment_list)}, accounts: {len(accounts)})",
            "system"
        )
        
        return {
            "success": True,
            "message": f"Successfully exported all data",
            "zip_data": zip_data,
            "filename": filename,
            "summary": {
                "supplies_count": len(supplies),
                "equipment_count": len(equipment_list),
                "accounts_count": len(accounts)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export all data: {str(e)}")

# Update the existing logs export route to fix the CSV formatting
@app.get("/api/export/logs")
async def export_logs_csv(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    username_filter: Optional[str] = None,
    search: Optional[str] = None,
    token: str = Depends(oauth2_scheme)
):
    """Export logs as CSV - requires admin role"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required to export logs.")
    
    try:
        query = {}
        
        # Date filtering
        if date_from or date_to:
            date_query = {}
            if date_from:
                from_date = datetime.strptime(date_from, "%Y-%m-%d")
                date_query["$gte"] = from_date
            if date_to:
                to_date = datetime.strptime(date_to, "%Y-%m-%d")
                to_date = to_date + timedelta(days=1) - timedelta(seconds=1)
                date_query["$lte"] = to_date
            query["timestamp"] = date_query
        
        # Username filtering
        if username_filter and username_filter != "ALL USERS":
            query["username"] = {"$regex": username_filter, "$options": "i"}
        
        # Search filtering
        if search:
            query["$or"] = [
                {"action": {"$regex": search, "$options": "i"}},
                {"details": {"$regex": search, "$options": "i"}},
                {"username": {"$regex": search, "$options": "i"}}
            ]
        
        # Fetch and convert to CSV
        logs_cursor = logs_collection.find(query).sort("timestamp", -1)
        csv_rows = ["timestamp,username,action,details,ip_address"]
        
        logs_count = 0
        for log in logs_cursor:
            logs_count += 1
            timestamp = log.get("formatted_timestamp", str(log.get("timestamp", "")))
            log_username = log.get("username", "")
            action = log.get("action", "")
            details = log.get("details", "")
            ip_address = log.get("ip_address", "unknown")
            
            row_data = [timestamp, log_username, action, details, ip_address]
            
            # Escape CSV fields
            escaped_row = []
            for field in row_data:
                field = str(field)
                if ',' in field or '"' in field or '\n' in field:
                    field = f'"{field.replace('"', '""')}"'
                escaped_row.append(field)
            
            csv_rows.append(','.join(escaped_row))
        
        csv_data = '\n'.join(csv_rows)
        filename = f"meams_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        
        await create_log_entry(
            username,
            "Exported logs.",
            f"Exported {logs_count} log entries to CSV",
            "system"
        )
        
        return {
            "success": True,
            "message": f"Exported {logs_count} log entries",
            "csv_data": csv_data,
            "filename": filename
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export logs: {str(e)}")

@app.post("/api/report-bug")
async def report_bug(report: BugReport, request: Request, token: str = Depends(oauth2_scheme)):
    """Submit a bug report or question"""
    try:
        payload = verify_token(token)
        username = payload.get("username", "unknown_user")
        client_ip = request.client.host if hasattr(request, 'client') else "unknown"
        
        # Validate the bug report message
        if not report.message or not report.message.strip():
            raise HTTPException(status_code=400, detail="Bug report message cannot be empty")

        # Prepare email content
        subject = f"Bug Report from {report.username} ({report.role})"
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
                    Bug Report / Question
                </h2>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>User:</strong> {report.username}</p>
                    <p><strong>Role:</strong> {report.role}</p>
                    <p><strong>Submitted:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
                    <p><strong>IP Address:</strong> {client_ip}</p>
                </div>
                
                <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <h3 style="color: #2c3e50; margin-top: 0;">Message:</h3>
                    <div style="white-space: pre-wrap; background-color: #f8f9fa; padding: 15px; border-radius: 3px; border-left: 4px solid #3498db;">
{report.message}
                    </div>
                </div>
                
                <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
                    <p>This is an automated message from your MEAMS Inventory Management System</p>
                </footer>
            </div>
        </body>
        </html>
        """

        # Send email to meamsds42@gmail.com
        success = await send_email("meamsds42@gmail.com", subject, body)

        if not success:
            # Log the failure but still create log entry
            print(f"Failed to send bug report email for user {report.username}")
            
            # Still try to create log entry
            try:
                await create_log_entry(username, "Submitted bug report (email failed)", report.message[:100] + "..." if len(report.message) > 100 else report.message, client_ip)
            except Exception as log_error:
                print(f"Failed to create log entry: {log_error}")
            
            raise HTTPException(
                status_code=500, 
                detail="Failed to send bug report email. Please try again or contact support directly."
            )

        # Create log entry for successful submission
        try:
            await create_log_entry(username, "Submitted bug report", report.message[:100] + "..." if len(report.message) > 100 else report.message, client_ip)
        except Exception as log_error:
            print(f"Failed to create log entry: {log_error}")
            # Don't fail the entire request if logging fails

        print(f"Bug report from {report.username} sent successfully to meamsds42@gmail.com")
        
        return {
            "success": True, 
            "message": "Bug report sent successfully",
            "email_sent": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in report_bug endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/test-email")
async def test_email_config():
    """Test endpoint to check if email configuration is working"""
    try:
        test_subject = "Test Email from MEAMS Inventory System"
        test_body = f"""
        <html>
        <body>
            <h2>Test Email</h2>
            <p>This is a test email to verify the email configuration is working properly.</p>
            <p>Sent at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        </body>
        </html>
        """
        
        success = await send_email("meamsds42@gmail.com", test_subject, test_body)
        
        return {
            "success": success,
            "message": "Test email sent successfully" if success else "Failed to send test email",
            "email_configured": bool(EMAIL_PASSWORD),
            "smtp_server": EMAIL_HOST
        }
    except Exception as e:
        print(f"Error in test_email_config: {e}")
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "email_configured": bool(EMAIL_PASSWORD),
            "smtp_server": EMAIL_HOST
        }

@app.get("/health")
async def health_check():
    try:
        client.admin.command('ping')
        return {"status": "healthy", "database": "connected", "timestamp": datetime.utcnow()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")
    
@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, http_request: Request):
    """Send password reset email"""
    client_ip = http_request.client.host if hasattr(http_request, 'client') else "unknown"
    
    try:
        # Check if email exists in database
        user = accounts_collection.find_one({"email": request.email})
        
        if not user:
            # Don't reveal if email doesn't exist for security
            return {
                "success": True, 
                "message": "If an account with that email exists, we've sent a password reset link."
            }
        
        # Generate secure reset token
        reset_token = secrets.token_urlsafe(32)
        reset_expires = datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour
        
        # Store reset token in database
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
        
        # Create reset link - using your frontend URL
        reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
        
        # Send email using your configured settings
        email_subject = "MEAMS - Password Reset Request"
        email_body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MEAMS Password Reset</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-family: 'Koulen', cursive; font-size: 36px; margin: 0; letter-spacing: 2px;">MEAMS</h1>
                    <p style="color: #cccccc; margin: 10px 0 0 0; font-size: 14px;">Asset Management System</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 24px;">Password Reset Request</h2>
                    <p style="margin: 0 0 20px 0; font-size: 16px;">Hello <strong>{user.get('name', 'User')}</strong>,</p>
                    <p style="margin: 0 0 25px 0; font-size: 16px;">We received a request to reset your password for your MEAMS account.</p>
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" 
                           style="display: inline-block; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; 
                                  padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; 
                                  font-size: 16px; box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3); transition: all 0.3s ease;">
                            Reset My Password
                        </a>
                    </div>
                    
                    <!-- Security Information -->
                    <div style="background-color: #f8f9fa; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 5px;">
                        <h3 style="color: #856404; margin: 0 0 15px 0; font-size: 18px;">Security Information</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #856404;">
                            <li>This link will expire in <strong>1 hour</strong></li>
                            <li>If you didn't request this reset, please ignore this email</li>
                            <li>Never share this link with anyone</li>
                            <li>For security, this link only works once</li>
                        </ul>
                    </div>
                    
                    <!-- Alternative Link -->
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link:</p>
                        <div style="background-color: #f1f1f1; padding: 15px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px;">
                            {reset_link}
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-size: 14px; color: #666;">
                        Best regards,<br>
                        <strong>MEAMS System</strong><br>
                        <em>This is an automated message, please do not reply.</em>
                    </p>
                    <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                        Sent on {datetime.utcnow().strftime('%B %d, %Y at %I:%M %p UTC')}
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        email_sent = await send_email(request.email, email_subject, email_body)
        
        # Log the attempt
        await create_log_entry(
            user.get('username', 'Unknown'),
            "Password reset requested.",
            f"Reset link sent to: {request.email}",
            client_ip
        )
        
        if email_sent:
            return {
                "success": True, 
                "message": "If an account with that email exists, we've sent a password reset link."
            }
        else:
            # Log email failure but don't reveal to user
            await create_log_entry(
                user.get('username', 'Unknown'),
                "Password reset email failed.",
                f"Failed to send reset email to: {request.email}",
                client_ip
            )
            return {
                "success": True, 
                "message": "If an account with that email exists, we've sent a password reset link."
            }
        
    except Exception as e:
        print(f"Password reset error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/auth/validate-reset-token/{token}")
async def validate_reset_token(token: str):
    """Validate password reset token"""
    try:
        user = accounts_collection.find_one({
            "password_reset_token": token,
            "password_reset_expires": {"$gt": datetime.utcnow()}
        })
        
        if user:
            return {
                "success": True,
                "valid": True,
                "message": "Token is valid"
            }
        else:
            return {
                "success": True,
                "valid": False,
                "message": "Invalid or expired token"
            }
            
    except Exception as e:
        print(f"Token validation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/auth/reset-password")
async def reset_password(request: ResetPasswordRequest, http_request: Request):
    """Reset password using token"""
    client_ip = http_request.client.host if hasattr(http_request, 'client') else "unknown"
    
    try:
        # Validate token and check expiration
        user = accounts_collection.find_one({
            "password_reset_token": request.token,
            "password_reset_expires": {"$gt": datetime.utcnow()}
        })
        
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
        # Validate new password
        if len(request.new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        
        # Hash new password
        new_password_hash = hash_password(request.new_password)
        
        # Update user password and clear reset token
        accounts_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password_hash": new_password_hash,
                    "updated_at": datetime.utcnow(),
                    "first_login": False  # Reset first_login flag if it was set
                },
                "$unset": {
                    "password_reset_token": "",
                    "password_reset_expires": ""
                }
            }
        )
        
        # Log successful password reset
        await create_log_entry(
            user.get('username', 'Unknown'),
            "Password reset completed.",
            "Password successfully reset using email link",
            client_ip
        )
        
        # Send confirmation email
        confirmation_subject = "MEAMS - Password Reset Successful"
        confirmation_body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MEAMS Password Reset Confirmation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-family: 'Koulen', cursive; font-size: 36px; margin: 0; letter-spacing: 2px;">MEAMS</h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Password Reset Successful</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                            <span style="color: white; font-size: 24px;">?</span>
                        </div>
                    </div>
                    
                    <h2 style="color: #28a745; margin: 0 0 20px 0; font-size: 24px; text-align: center;">Password Reset Successful!</h2>
                    <p style="margin: 0 0 20px 0; font-size: 16px;">Hello <strong>{user.get('name', 'User')}</strong>,</p>
                    <p style="margin: 0 0 25px 0; font-size: 16px;">Your password has been successfully reset for your MEAMS account.</p>
                    
                    <!-- Success Info -->
                    <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <p style="margin: 0; color: #155724; font-size: 16px;">
                            <strong>Reset completed on:</strong><br>
                            {datetime.utcnow().strftime('%B %d, %Y at %I:%M %p UTC')}
                        </p>
                    </div>
                    
                    <p style="margin: 25px 0; font-size: 16px;">You can now log in to your account using your new password.</p>
                    
                    <!-- Login Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="http://localhost:3000/login" 
                           style="display: inline-block; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; 
                                  padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; 
                                  font-size: 16px; box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);">
                            Go to Login
                        </a>
                    </div>
                    
                    <!-- Security Tips -->
                    <div style="background-color: #f8f9fa; border-left: 4px solid #17a2b8; padding: 20px; margin: 25px 0; border-radius: 5px;">
                        <h3 style="color: #0c5460; margin: 0 0 15px 0; font-size: 18px;">Security Tips</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #0c5460;">
                            <li>Keep your password secure and don't share it with anyone</li>
                            <li>If you didn't make this change, contact support immediately</li>
                            <li>Consider using a password manager for better security</li>
                            <li>Log out of all devices and log back in with your new password</li>
                        </ul>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-size: 14px; color: #666;">
                        Best regards,<br>
                        <strong>MEAMS System</strong><br>
                        <em>This is an automated message, please do not reply.</em>
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send confirmation email (don't fail if email fails)
        try:
            await send_email(user.get("email", ""), confirmation_subject, confirmation_body)
        except Exception as e:
            print(f"Failed to send confirmation email: {str(e)}")
        
        return {
            "success": True,
            "message": "Password reset successfully. You can now log in with your new password."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Password reset error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Add this debug endpoint to your main.py to see exactly what's happening
@app.get("/debug/historical-supplies")
async def debug_historical_supplies(token: str = Depends(oauth2_scheme)):
    """Debug version to see what's going wrong with historical supplies data"""
    verify_token(token)
    
    try:
        # Step 1: Check raw data from MongoDB
        raw_data = list(historical_supplies_forecast_collection.find({}, {"_id": 0}))
        print(f"Raw data count: {len(raw_data)}")
        print(f"First raw record: {raw_data[0] if raw_data else 'No data'}")
        
        if not raw_data:
            return {"error": "No raw data found in historical_supplies_forecast collection"}
        
        # Step 2: Convert to DataFrame
        df = pd.DataFrame(raw_data)
        print(f"DataFrame columns: {df.columns.tolist()}")
        print(f"DataFrame shape: {df.shape}")
        print(f"DataFrame head:\n{df.head()}")
        
        # Step 3: Check for required columns
        if 'date' not in df.columns or 'quantity' not in df.columns:
            return {
                "error": "Missing required columns", 
                "available_columns": df.columns.tolist(),
                "sample_data": df.head(2).to_dict() if not df.empty else {}
            }
        
        # Step 4: Check data types
        print(f"Date column dtype: {df['date'].dtype}")
        print(f"Quantity column dtype: {df['quantity'].dtype}")
        print(f"First 3 dates: {df['date'].head(3).tolist()}")
        print(f"First 3 quantities: {df['quantity'].head(3).tolist()}")
        
        # Step 5: Try bootstrap function
        try:
            bootstrapped_df = bootstrap_missing_months(df, date_col='date', value_col='quantity')
            print(f"Bootstrap successful! Shape: {bootstrapped_df.shape}")
            
            # Step 6: Try to format dates
            try:
                bootstrapped_df['date'] = bootstrapped_df['date'].dt.strftime('%Y-%m-%d')
                return {
                    "success": True,
                    "message": "Debug successful",
                    "raw_count": len(raw_data),
                    "processed_count": len(bootstrapped_df),
                    "sample_processed": bootstrapped_df.head(3).to_dict('records')
                }
            except Exception as date_format_error:
                return {
                    "error": "Date formatting failed",
                    "details": str(date_format_error),
                    "bootstrap_successful": True,
                    "bootstrap_shape": bootstrapped_df.shape
                }
                
        except Exception as bootstrap_error:
            return {
                "error": "Bootstrap function failed",
                "details": str(bootstrap_error),
                "raw_data_sample": df.head(2).to_dict('records')
            }
            
    except Exception as e:
        import traceback
        return {
            "error": "Debug failed",
            "details": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
    
