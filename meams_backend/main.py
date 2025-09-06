from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status, Request
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
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication setup
SECRET_KEY = "your_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2PasswordBearer instance
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# CryptContext for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Email configuration
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", "your-email@gmail.com")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "your-app-password")
EMAIL_FROM = os.getenv("EMAIL_FROM", "MEAMS System <your-email@gmail.com>")

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://admin:MEAMSDS42@cluster0.xl6k426.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DATABASE_NAME = os.getenv("DATABASE_NAME", "MEAMS")

try:
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    client.admin.command('ping')
    print(f"✅ Connected to MongoDB: {DATABASE_NAME}")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")

# Collections
supplies_collection = db.supplies
equipment_collection = db.equipment
accounts_collection = db.accounts
logs_collection = db.logs  # NEW: Logs collection

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
        print(f"📝 Log created: {username} - {action}")
    except Exception as e:
        print(f"❌ Failed to create log entry: {str(e)}")

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

# ===============================================
# LOGS MODELS
# ===============================================

class LogsFilter(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    username: Optional[str] = None
    search: Optional[str] = None

# ===============================================
# PASSWORD AND EMAIL UTILITIES (EXISTING)
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
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
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
                <p>Maintenance and Engineering Asset Management System</p>
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
                <p>&copy; 2025 MEAMS - Maintenance and Engineering Asset Management System</p>
            </div>
        </div>
    </body>
    </html>
    """

# ===============================================
# EXISTING MODELS (ACCOUNTS, SUPPLIES, EQUIPMENT)
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

class User(BaseModel):
    username: str
    password: str

def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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
# LOGS API ROUTES - NEW
# ===============================================

@app.get("/api/logs", response_model=dict)
async def get_logs(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None,
    token: str = Depends(oauth2_scheme)
):
    """Get filtered logs - admin only"""
    payload = verify_token(token)
    
    # Only admin can view logs
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view logs"
        )
    
    try:
        # Build filter query
        filter_query = {}
        
        # Date filtering
        if date_from or date_to:
            date_filter = {}
            if date_from:
                try:
                    start_date = datetime.strptime(date_from, "%Y-%m-%d")
                    date_filter["$gte"] = start_date
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")
            
            if date_to:
                try:
                    end_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
                    date_filter["$lt"] = end_date
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")
            
            filter_query["timestamp"] = date_filter
        
        # Username filtering
        if username and username != "ALL USERS":
            filter_query["username"] = username
        
        # Search filtering (search in username, action, and details)
        if search:
            filter_query["$or"] = [
                {"username": {"$regex": search, "$options": "i"}},
                {"action": {"$regex": search, "$options": "i"}},
                {"details": {"$regex": search, "$options": "i"}}
            ]
        
        # Get logs with filtering and sorting (newest first)
        logs_cursor = logs_collection.find(filter_query).sort("timestamp", -1).limit(1000)  # Limit to 1000 most recent
        logs = []
        
        for log in logs_cursor:
            log_data = log_helper(log)
            # Format the remarks field to match frontend expectations
            log_data["remarks"] = log_data["action"]
            if log_data["details"]:
                log_data["remarks"] += f" - {log_data['details']}"
            logs.append(log_data)
        
        # Get unique usernames for dropdown
        unique_usernames = logs_collection.distinct("username")
        
        return {
            "success": True,
            "message": f"Found {len(logs)} log entries",
            "data": logs,
            "usernames": ["ALL USERS"] + sorted(unique_usernames)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error retrieving logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve logs: {str(e)}")

@app.post("/api/logs/export", response_model=dict)
async def export_logs(
    logs_filter: LogsFilter,
    token: str = Depends(oauth2_scheme)
):
    """Export logs as CSV data - admin only"""
    payload = verify_token(token)
    
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can export logs"
        )
    
    try:
        # Build filter query (same logic as get_logs)
        filter_query = {}
        
        if logs_filter.date_from or logs_filter.date_to:
            date_filter = {}
            if logs_filter.date_from:
                start_date = datetime.strptime(logs_filter.date_from, "%Y-%m-%d")
                date_filter["$gte"] = start_date
            if logs_filter.date_to:
                end_date = datetime.strptime(logs_filter.date_to, "%Y-%m-%d") + timedelta(days=1)
                date_filter["$lt"] = end_date
            filter_query["timestamp"] = date_filter
        
        if logs_filter.username and logs_filter.username != "ALL USERS":
            filter_query["username"] = logs_filter.username
        
        if logs_filter.search:
            filter_query["$or"] = [
                {"username": {"$regex": logs_filter.search, "$options": "i"}},
                {"action": {"$regex": logs_filter.search, "$options": "i"}},
                {"details": {"$regex": logs_filter.search, "$options": "i"}}
            ]
        
        # Get all matching logs
        logs_cursor = logs_collection.find(filter_query).sort("timestamp", -1)
        
        # Convert to CSV format
        csv_data = "Timestamp,Username,Action,Details,IP Address\n"
        for log in logs_cursor:
            timestamp = log.get("formatted_timestamp", "")
            username = log.get("username", "")
            action = log.get("action", "")
            details = log.get("details", "")
            ip_address = log.get("ip_address", "unknown")
            
            # Escape commas and quotes in CSV
            csv_data += f'"{timestamp}","{username}","{action}","{details}","{ip_address}"\n'
        
        return {
            "success": True,
            "message": "Logs exported successfully",
            "csv_data": csv_data,
            "filename": f"meams_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export logs: {str(e)}")

# ===============================================
# AUTHENTICATION ROUTES (UPDATED WITH LOGGING)
# ===============================================

@app.get("/")
async def root():
    return {"message": "MEAMS Asset Management API is running!", "status": "active"}

@app.post("/login")
async def login(user: User, request: Request):
    """Login endpoint for authentication - with logging"""
    print(f"Login attempt: {user.username}")
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    # Check hardcoded users first
    valid_users = {
        "admin": {"password": "password123", "role": "admin"},
        "staff": {"password": "staff123", "role": "staff"},
    }
    
    if user.username in valid_users and user.password == valid_users[user.username]["password"]:
        role = valid_users[user.username]["role"]
        print(f"Login successful for hardcoded user {user.username} with role {role}")
        
        # Log successful login
        await create_log_entry(user.username, "Logged in.", f"Role: {role}", client_ip)
        
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
            
            # Log successful login
            await create_log_entry(user.username, "Logged in.", f"Role: {role}", client_ip)
            
            access_token = create_access_token(data={"sub": user.username, "role": role})
            return {"access_token": access_token, "token_type": "bearer"}
        
    except Exception as e:
        print(f"Error checking database users: {str(e)}")
    
    # Log failed login attempt
    await create_log_entry(user.username, "Failed login attempt.", "Invalid credentials", client_ip)
    
    print(f"Invalid credentials for user: {user.username}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

@app.post("/logout")
async def logout(request: Request, token: str = Depends(oauth2_scheme)):
    """Logout endpoint - creates log entry"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    # Log logout
    await create_log_entry(username, "Logged out.", "", client_ip)
    
    return {"message": "Successfully logged out"}

# ===============================================
# ACCOUNT MANAGEMENT ROUTES (UPDATED WITH LOGGING)
# ===============================================

@app.post("/api/accounts", response_model=dict)
async def create_account(account: AccountCreate, request: Request, token: str = Depends(oauth2_scheme)):
    """Create a new account with generated password and email notification"""
    payload = verify_token(token)
    admin_username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
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
        
        generated_password = generate_secure_password()
        password_hash = hash_password(generated_password)
        
        account_dict = account.dict()
        account_dict.update({
            "password_hash": password_hash,
            "status": True,
            "account_creation": datetime.utcnow().strftime("%m/%d/%Y"),
            "last_login": "Never",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        result = accounts_collection.insert_one(account_dict)
        created_account = accounts_collection.find_one({"_id": result.inserted_id})
        
        # Send welcome email
        email_subject = "Welcome to MEAMS - Your Account Credentials"
        email_body = create_welcome_email_body(account.name, account.username, generated_password)
        email_sent = await send_email(account.email, email_subject, email_body)
        
        # Log account creation
        await create_log_entry(
            admin_username, 
            "Added an account.", 
            f"Created account for {account.username} ({account.name})", 
            client_ip
        )
        
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
    
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view all accounts"
        )
    
    try:
        accounts = []
        for account in accounts_collection.find():
            account_data = account_helper(account)
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
        account_data.pop("password_hash", None)
        
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
async def update_account(account_id: str, account_update: AccountUpdate, request: Request, token: str = Depends(oauth2_scheme)):
    """Update account - admin only"""
    payload = verify_token(token)
    admin_username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update accounts"
        )
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        # Get account before update for logging
        account_before = accounts_collection.find_one({"_id": ObjectId(account_id)})
        if not account_before:
            raise HTTPException(status_code=404, detail="Account not found")
        
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
        
        # Log account update
        await create_log_entry(
            admin_username,
            "Updated an account.",
            f"Updated account for {account_before['username']} ({account_before['name']})",
            client_ip
        )
        
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
async def delete_account(account_id: str, request: Request, token: str = Depends(oauth2_scheme)):
    """Delete account - admin only"""
    payload = verify_token(token)
    admin_username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete accounts"
        )
    
    try:
        if not ObjectId.is_valid(account_id):
            raise HTTPException(status_code=400, detail="Invalid account ID format")
        
        # Get account before deletion for logging
        account_to_delete = accounts_collection.find_one({"_id": ObjectId(account_id)})
        if not account_to_delete:
            raise HTTPException(status_code=404, detail="Account not found")
        
        result = accounts_collection.delete_one({"_id": ObjectId(account_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Log account deletion
        await create_log_entry(
            admin_username,
            "Deleted an account.",
            f"Deleted account for {account_to_delete['username']} ({account_to_delete['name']})",
            client_ip
        )
        
        return {
            "success": True,
            "message": "Account deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

@app.post("/api/accounts/{account_id}/reset-password", response_model=dict)
async def reset_password(account_id: str, request: Request, token: str = Depends(oauth2_scheme)):
    """Reset account password and send new password via email - admin only"""
    payload = verify_token(token)
    admin_username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
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
        
        # Log password reset
        await create_log_entry(
            admin_username,
            "Reset password.",
            f"Reset password for {account['username']} ({account['name']})",
            client_ip
        )
        
        return {
            "success": True,
            "message": f"Password reset successfully. {'New password sent via email.' if email_sent else 'Password reset but email failed to send.'}",
            "email_sent": email_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")

# ===============================================
# PROTECTED ROUTES (UPDATED WITH LOGGING)
# ===============================================

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
# SUPPLIES API ROUTES (UPDATED WITH LOGGING)
# ===============================================

@app.post("/api/supplies", response_model=dict)
async def add_supply(supply: SupplyCreate, request: Request, token: str = Depends(oauth2_scheme)):
    """Add a new supply item - requires authentication"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
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
        
        # Log supply addition
        await create_log_entry(
            username,
            "Added a supply.",
            f"Added supply: {supply_dict.get('name', 'Unknown')} ({supply_dict.get('itemCode')})",
            client_ip
        )
        
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

@app.put("/api/supplies/{supply_id}", response_model=dict)
async def update_supply(supply_id: str, supply_update: SupplyUpdate, request: Request, token: str = Depends(oauth2_scheme)):
    """Update supply item - requires authentication"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        if not ObjectId.is_valid(supply_id):
            raise HTTPException(status_code=400, detail="Invalid supply ID format")
        
        # Get supply before update for logging
        supply_before = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        if not supply_before:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        update_data = {k: v for k, v in supply_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        update_data["updated_at"] = datetime.utcnow()
        
        result = supplies_collection.update_one(
            {"_id": ObjectId(supply_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        updated_supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        
        # Log supply update
        await create_log_entry(
            username,
            "Updated a supply.",
            f"Updated supply: {supply_before.get('name', 'Unknown')} ({supply_before.get('itemCode')})",
            client_ip
        )
        
        return {
            "success": True,
            "message": "Supply updated successfully",
            "data": supply_helper(updated_supply)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update supply: {str(e)}")

@app.delete("/api/supplies/{supply_id}", response_model=dict)
async def delete_supply(supply_id: str, request: Request, token: str = Depends(oauth2_scheme)):
    """Delete supply item - requires authentication"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        if not ObjectId.is_valid(supply_id):
            raise HTTPException(status_code=400, detail="Invalid supply ID format")
        
        # Get supply before deletion for logging
        supply_to_delete = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        if not supply_to_delete:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        result = supplies_collection.delete_one({"_id": ObjectId(supply_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        # Log supply deletion
        await create_log_entry(
            username,
            "Deleted a supply.",
            f"Deleted supply: {supply_to_delete.get('name', 'Unknown')} ({supply_to_delete.get('itemCode')})",
            client_ip
        )
        
        return {
            "success": True,
            "message": "Supply deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete supply: {str(e)}")

# ===============================================
# EQUIPMENT API ROUTES (UPDATED WITH LOGGING)
# ===============================================

@app.post("/api/equipment", response_model=dict)
async def add_equipment(equipment: EquipmentCreate, request: Request, token: str = Depends(oauth2_scheme)):
    """Add a new equipment item - requires authentication"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
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
        
        # Log equipment addition
        await create_log_entry(
            username,
            "Added equipment.",
            f"Added equipment: {equipment_dict.get('name', 'Unknown')} ({equipment_dict.get('itemCode')})",
            client_ip
        )
        
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

@app.put("/api/equipment/{equipment_id}", response_model=dict)
async def update_equipment(equipment_id: str, equipment_update: EquipmentUpdate, request: Request, token: str = Depends(oauth2_scheme)):
    """Update equipment item - requires authentication"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        if not ObjectId.is_valid(equipment_id):
            raise HTTPException(status_code=400, detail="Invalid equipment ID format")
        
        # Get equipment before update for logging
        equipment_before = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
        if not equipment_before:
            raise HTTPException(status_code=404, detail="Equipment not found")
        
        update_data = {k: v for k, v in equipment_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        update_data["updated_at"] = datetime.utcnow()
        
        result = equipment_collection.update_one(
            {"_id": ObjectId(equipment_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Equipment not found")
        
        updated_equipment = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
        
        # Log equipment update
        await create_log_entry(
            username,
            "Updated equipment.",
            f"Updated equipment: {equipment_before.get('name', 'Unknown')} ({equipment_before.get('itemCode')})",
            client_ip
        )
        
        return {
            "success": True,
            "message": "Equipment updated successfully",
            "data": equipment_helper(updated_equipment)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update equipment: {str(e)}")

@app.delete("/api/equipment/{equipment_id}", response_model=dict)
async def delete_equipment(equipment_id: str, request: Request, token: str = Depends(oauth2_scheme)):
    """Delete equipment item - requires authentication"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        if not ObjectId.is_valid(equipment_id):
            raise HTTPException(status_code=400, detail="Invalid equipment ID format")
        
        # Get equipment before deletion for logging
        equipment_to_delete = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
        if not equipment_to_delete:
            raise HTTPException(status_code=404, detail="Equipment not found")
        
        result = equipment_collection.delete_one({"_id": ObjectId(equipment_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Equipment not found")
        
        # Log equipment deletion
        await create_log_entry(
            username,
            "Deleted equipment.",
            f"Deleted equipment: {equipment_to_delete.get('name', 'Unknown')} ({equipment_to_delete.get('itemCode')})",
            client_ip
        )
        
        return {
            "success": True,
            "message": "Equipment deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete equipment: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)