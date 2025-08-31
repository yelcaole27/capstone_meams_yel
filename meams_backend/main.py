from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pymongo import MongoClient
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId
from typing import Optional, List
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import json
from jose import JWTError, jwt
from passlib.context import CryptContext
import secrets
import string
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables
load_dotenv()

app = FastAPI(title="MEAMS Asset Management API", version="1.0.0")

# CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Your React app URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication setup
SECRET_KEY = "your_secret_key"  # Change this in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2PasswordBearer instance
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# CryptContext for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Email configuration - UPDATE THESE WITH YOUR GMAIL CREDENTIALS
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", "your-email@gmail.com")  # Your Gmail address
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "your-app-password")      # Your Gmail App Password
EMAIL_FROM = os.getenv("EMAIL_FROM", "MEAMS System <your-email@gmail.com>")

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://admin:MEAMSDS42@cluster0.xl6k426.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DATABASE_NAME = os.getenv("DATABASE_NAME", "MEAMS")

try:
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    # Test connection
    client.admin.command('ping')
    print(f"✅ Connected to MongoDB: {DATABASE_NAME}")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")

# Collections
supplies_collection = db.supplies
equipment_collection = db.equipment
accounts_collection = db.accounts  # NEW: Accounts collection

# ===============================================
# PASSWORD AND EMAIL UTILITIES
# ===============================================

def generate_secure_password(length: int = 12) -> str:
    """Generate a secure random password"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(characters) for _ in range(length))
    return password

def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email with generated password"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Attach body to email
        msg.attach(MIMEText(body, 'html'))
        
        # Gmail SMTP configuration
        context = ssl.create_default_context()
        
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls(context=context)
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            text = msg.as_string()
            server.sendmail(EMAIL_FROM, to_email, text)
        
        print(f"✅ Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {str(e)}")
        return False

def create_welcome_email_body(name: str, username: str, password: str) -> str:
    """Create HTML email body for new account"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #2c3e50; color: white; padding: 20px; text-align: center; }}
            .content {{ background-color: #f9f9f9; padding: 30px; }}
            .credentials {{ background-color: #e8f4f8; padding: 20px; margin: 20px 0; border-radius: 5px; }}
            .footer {{ background-color: #34495e; color: white; padding: 15px; text-align: center; }}
            .warning {{ color: #e74c3c; font-weight: bold; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to MEAMS</h1>
                <p>Mechanical Engineering Asset Management System</p>
            </div>
            
            <div class="content">
                <h2>Hello {name},</h2>
                <p>Your account has been successfully created in the MEAMS system. Below are your login credentials:</p>
                
                <div class="credentials">
                    <h3>Your Login Credentials:</h3>
                    <p><strong>Username:</strong> {username}</p>
                    <p><strong>Password:</strong> {password}</p>
                </div>
                
                <p class="warning">⚠️ IMPORTANT: Please change your password after your first login for security purposes.</p>
                
                <p>You can access the MEAMS system at: <a href="http://localhost:3000">http://localhost:3000</a></p>
                
                <p>If you have any questions or need assistance, please contact your system administrator.</p>
            </div>
            
            <div class="footer">
                <p>&copy; 2025 MEAMS - Mechanical Engineering Asset Management System</p>
            </div>
        </div>
    </body>
    </html>
    """

# ===============================================
# ACCOUNT MODELS
# ===============================================

class AccountCreate(BaseModel):
    name: str
    username: str
    email: EmailStr
    role: Optional[str] = "staff"
    department: Optional[str] = "Operations"
    position: Optional[str] = "Staff Member"
    phone_number: Optional[str] = ""

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[bool] = None

def account_helper(account) -> dict:
    """Helper function to format account data"""
    return {
        "_id": str(account["_id"]),
        "name": account["name"],
        "username": account["username"],
        "email": account["email"],
        "role": account.get("role", "staff"),
        "department": account.get("department", "Operations"),
        "position": account.get("position", "Staff Member"),
        "phone_number": account.get("phone_number", ""),
        "status": account.get("status", True),
        "account_creation": account.get("account_creation", ""),
        "last_login": account.get("last_login", "Never"),
        "created_at": account.get("created_at", datetime.utcnow()),
        "updated_at": account.get("updated_at", datetime.utcnow())
    }

# Authentication Models
class User(BaseModel):
    username: str
    password: str

# Function to create JWT token
def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Updated token verification to check both hardcoded users and database users
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

# Helper functions for supplies and equipment (keeping existing)
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
        "created_at": equipment.get("created_at", datetime.utcnow()),
        "updated_at": equipment.get("updated_at", datetime.utcnow())
    }

# Pydantic models for supplies (keeping existing)
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

# Equipment models (keeping existing)
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

# ===============================================
# AUTHENTICATION ROUTES
# ===============================================

@app.get("/")
async def root():
    return {"message": "MEAMS Asset Management API is running!", "status": "active"}

@app.post("/login")
async def login(user: User):
    """Login endpoint for authentication - checks both hardcoded and database users"""
    print(f"Login attempt: {user.username}")
    
    # First check hardcoded users (for backwards compatibility)
    valid_users = {
        "admin": {"password": "password123", "role": "admin"},
        "staff": {"password": "staff123", "role": "staff"},
    }
    
    # Check hardcoded users first
    if user.username in valid_users and user.password == valid_users[user.username]["password"]:
        role = valid_users[user.username]["role"]
        print(f"Login successful for hardcoded user {user.username} with role {role}")
        access_token = create_access_token(data={"sub": user.username, "role": role})
        return {"access_token": access_token, "token_type": "bearer"}
    
    # Check database users
    try:
        db_user = accounts_collection.find_one({"username": user.username})
        if db_user and verify_password(user.password, db_user["password_hash"]):
            role = db_user.get("role", "staff")
            
            # Update last login
            accounts_collection.update_one(
                {"_id": db_user["_id"]},
                {"$set": {"last_login": datetime.utcnow().strftime("%m/%d/%Y")}}
            )
            
            print(f"Login successful for database user {user.username} with role {role}")
            access_token = create_access_token(data={"sub": user.username, "role": role})
            return {"access_token": access_token, "token_type": "bearer"}
        
    except Exception as e:
        print(f"Error checking database users: {str(e)}")
    
    # If no user found
    print(f"Invalid credentials for user: {user.username}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

# ===============================================
# ACCOUNT MANAGEMENT ROUTES
# ===============================================

@app.post("/api/accounts", response_model=dict)
async def create_account(account: AccountCreate, token: str = Depends(oauth2_scheme)):
    """Create a new account with generated password and email notification"""
    payload = verify_token(token)
    
    # Only admin can create accounts
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create accounts"
        )
    
    try:
        # Check if username already exists
        existing_user = accounts_collection.find_one({"username": account.username})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        
        # Check if email already exists
        existing_email = accounts_collection.find_one({"email": account.email})
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        
        # Generate secure password
        generated_password = generate_secure_password()
        password_hash = hash_password(generated_password)
        
        # Create account document
        account_dict = account.dict()
        account_dict.update({
            "password_hash": password_hash,
            "status": True,
            "account_creation": datetime.utcnow().strftime("%m/%d/%Y"),
            "last_login": "Never",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Insert into database
        result = accounts_collection.insert_one(account_dict)
        created_account = accounts_collection.find_one({"_id": result.inserted_id})
        
        # Send welcome email with password
        email_subject = "Welcome to MEAMS - Your Account Credentials"
        email_body = create_welcome_email_body(account.name, account.username, generated_password)
        
        email_sent = await send_email(account.email, email_subject, email_body)
        
        # Remove password_hash from response for security
        response_data = account_helper(created_account)
        response_data.pop("password_hash", None)
        
        print(f"✅ Account created: {account.username}, Email sent: {email_sent}")
        
        return {
            "success": True,
            "message": f"Account created successfully. {'Welcome email sent.' if email_sent else 'Account created but email failed to send.'}",
            "data": response_data,
            "email_sent": email_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating account: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")

@app.get("/api/accounts", response_model=dict)
async def get_all_accounts(token: str = Depends(oauth2_scheme)):
    """Get all accounts - admin only"""
    payload = verify_token(token)
    
    # Only admin can view all accounts
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view all accounts"
        )
    
    try:
        accounts = []
        for account in accounts_collection.find():
            account_data = account_helper(account)
            # Remove sensitive data from response
            account_data.pop("password_hash", None)
            accounts.append(account_data)
        
        return {
            "success": True,
            "message": f"Found {len(accounts)} accounts",
            "data": accounts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve accounts: {str(e)}")

@app.get("/api/accounts/{account_id}", response_model=dict)
async def get_account(account_id: str, token: str = Depends(oauth2_scheme)):
    """Get specific account - admin only"""
    payload = verify_token(token)
    
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view account details"
        )
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        account = accounts_collection.find_one({"_id": ObjectId(account_id)})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        account_data = account_helper(account)
        account_data.pop("password_hash", None)  # Remove sensitive data
        
        return {
            "success": True,
            "message": "Account found",
            "data": account_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve account: {str(e)}")

@app.put("/api/accounts/{account_id}", response_model=dict)
async def update_account(account_id: str, account_update: AccountUpdate, token: str = Depends(oauth2_scheme)):
    """Update account - admin only"""
    payload = verify_token(token)
    
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update accounts"
        )
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        # Only update fields that are provided
        update_data = {k: v for k, v in account_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        update_data["updated_at"] = datetime.utcnow()
        
        result = accounts_collection.update_one(
            {"_id": ObjectId(account_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")
        
        updated_account = accounts_collection.find_one({"_id": ObjectId(account_id)})
        response_data = account_helper(updated_account)
        response_data.pop("password_hash", None)
        
        return {
            "success": True,
            "message": "Account updated successfully",
            "data": response_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update account: {str(e)}")

@app.delete("/api/accounts/{account_id}", response_model=dict)
async def delete_account(account_id: str, token: str = Depends(oauth2_scheme)):
    """Delete account - admin only"""
    payload = verify_token(token)
    
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete accounts"
        )
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        result = accounts_collection.delete_one({"_id": ObjectId(account_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")
        
        return {
            "success": True,
            "message": "Account deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

@app.post("/api/accounts/{account_id}/reset-password", response_model=dict)
async def reset_password(account_id: str, token: str = Depends(oauth2_scheme)):
    """Reset account password and send new password via email - admin only"""
    payload = verify_token(token)
    
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can reset passwords"
        )
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        account = accounts_collection.find_one({"_id": ObjectId(account_id)})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Generate new password
        new_password = generate_secure_password()
        new_password_hash = hash_password(new_password)
        
        # Update password in database
        accounts_collection.update_one(
            {"_id": ObjectId(account_id)},
            {"$set": {"password_hash": new_password_hash, "updated_at": datetime.utcnow()}}
        )
        
        # Send password reset email
        email_subject = "MEAMS - Password Reset"
        email_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #e74c3c; color: white; padding: 20px; text-align: center; }}
                .content {{ background-color: #f9f9f9; padding: 30px; }}
                .credentials {{ background-color: #ffe6e6; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 5px solid #e74c3c; }}
                .warning {{ color: #e74c3c; font-weight: bold; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset - MEAMS</h1>
                </div>
                
                <div class="content">
                    <h2>Hello {account["name"]},</h2>
                    <p>Your password has been reset by the system administrator.</p>
                    
                    <div class="credentials">
                        <h3>Your New Login Credentials:</h3>
                        <p><strong>Username:</strong> {account["username"]}</p>
                        <p><strong>New Password:</strong> {new_password}</p>
                    </div>
                    
                    <p class="warning">⚠️ IMPORTANT: Please change your password immediately after logging in.</p>
                    
                    <p>You can access the MEAMS system at: <a href="http://localhost:3000">http://localhost:3000</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        email_sent = await send_email(account["email"], email_subject, email_body)
        
        return {
            "success": True,
            "message": f"Password reset successfully. {'New password sent via email.' if email_sent else 'Password reset but email failed to send.'}",
            "email_sent": email_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")

# Protected routes (keeping existing)
@app.get("/dashboard")
async def dashboard(token: str = Depends(oauth2_scheme)):
    """Dashboard endpoint - requires authentication"""
    payload = verify_token(token)
    username = payload["username"]
    return {"message": f"Welcome to the dashboard, {username}!"}

@app.get("/logs")
async def logs(token: str = Depends(oauth2_scheme)):
    """Logs endpoint - admin only"""
    payload = verify_token(token)
    role = payload.get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this page",
        )
    return {"message": "Welcome to the logs page"}

@app.get("/health")
async def health_check():
    try:
        client.admin.command('ping')
        return {"status": "healthy", "database": "connected", "timestamp": datetime.utcnow()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

# ===============================================
# SUPPLIES API ROUTES (KEEPING ALL EXISTING)
# ===============================================

@app.post("/api/supplies", response_model=dict)
async def add_supply(supply: SupplyCreate, token: str = Depends(oauth2_scheme)):
    """Add a new supply item - requires authentication"""
    verify_token(token)
    
    try:
        supply_dict = supply.dict()
        supply_dict["created_at"] = datetime.utcnow()
        supply_dict["updated_at"] = datetime.utcnow()
        
        if not supply_dict.get("itemCode"):
            category_prefix = supply_dict.get("category", "SUP")[:3].upper()
            random_num = str(abs(hash(str(datetime.utcnow()))))[:5]
            supply_dict["itemCode"] = f"{category_prefix}-{random_num}"
        
        result = supplies_collection.insert_one(supply_dict)
        created_supply = supplies_collection.find_one({"_id": result.inserted_id})
        
        print(f"✅ Supply added: {supply_dict.get('name', 'Unknown')} with itemCode: {supply_dict.get('itemCode')}")
        
        return {
            "success": True,
            "message": "Supply added successfully",
            "data": supply_helper(created_supply)
        }
    except Exception as e:
        print(f"❌ Error adding supply: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add supply: {str(e)}")

@app.get("/api/supplies", response_model=dict)
async def get_all_supplies(token: str = Depends(oauth2_scheme)):
    """Get all supply items - requires authentication"""
    verify_token(token)
    
    try:
        supplies = []
        for supply in supplies_collection.find():
            supplies.append(supply_helper(supply))
        
        return {
            "success": True,
            "message": f"Found {len(supplies)} supplies",
            "data": supplies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve supplies: {str(e)}")

# ===============================================
# EQUIPMENT API ROUTES (KEEPING ALL EXISTING)
# ===============================================

@app.post("/api/equipment", response_model=dict)
async def add_equipment(equipment: EquipmentCreate, token: str = Depends(oauth2_scheme)):
    """Add a new equipment item - requires authentication"""
    verify_token(token)
    
    try:
        equipment_dict = equipment.dict()
        equipment_dict["created_at"] = datetime.utcnow()
        equipment_dict["updated_at"] = datetime.utcnow()
        
        if not equipment_dict.get("itemCode"):
            category_prefix = equipment_dict.get("category", "EQP")[:3].upper()
            random_num = str(abs(hash(str(datetime.utcnow()))))[:5]
            equipment_dict["itemCode"] = f"{category_prefix}-E-{random_num}"
        
        result = equipment_collection.insert_one(equipment_dict)
        created_equipment = equipment_collection.find_one({"_id": result.inserted_id})
        
        print(f"✅ Equipment added: {equipment_dict.get('name', 'Unknown')}")
        
        return {
            "success": True,
            "message": "Equipment added successfully",
            "data": equipment_helper(created_equipment)
        }
    except Exception as e:
        print(f"❌ Error adding equipment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add equipment: {str(e)}")

@app.get("/api/equipment", response_model=dict)
async def get_all_equipment(token: str = Depends(oauth2_scheme)):
    """Get all equipment items - requires authentication"""
    verify_token(token)
    
    try:
        equipment_list = []
        for equipment in equipment_collection.find():
            equipment_list.append(equipment_helper(equipment))
        
        return {
            "success": True,
            "message": f"Found {len(equipment_list)} equipment items",
            "data": equipment_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)