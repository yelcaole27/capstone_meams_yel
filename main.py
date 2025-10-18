
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from config import API_TITLE, API_VERSION, ALLOWED_ORIGINS
from database import connect_db
from routers import help_support
from routers import supplies, qr_tracking
import time


app = FastAPI(title=API_TITLE, version=API_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Monitor request performance"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    # Log performance
    if process_time > 2.0:
        print(f"[SLOW] {request.method} {request.url.path} took {process_time:.2f}s")
    elif process_time > 1.0:
        print(f"[WARNING] {request.method} {request.url.path} took {process_time:.2f}s")
    else:
        print(f"[OK] {request.method} {request.url.path} - {process_time:.3f}s")
    
    return response

@app.on_event("startup")
async def startup_event():
    connect_db()
    print("=" * 50)
    print("MEAMS API Started Successfully")
    print("=" * 50)

# Import all routers
from routers import (
    auth, supplies, equipment, profile, 
    logs, accounts, export, forecast, 
    bulk_import, misc, dashboard
)

# Include all routers
app.include_router(auth.router)
app.include_router(dashboard.router)  # Add dashboard first for priority
app.include_router(supplies.router)
app.include_router(equipment.router)
app.include_router(profile.router)
app.include_router(logs.router)
app.include_router(accounts.router)
app.include_router(export.router)
app.include_router(forecast.router)
app.include_router(bulk_import.router)
app.include_router(misc.router)
app.include_router(help_support.router, tags=["help-support"])
app.include_router(qr_tracking.router)

@app.get("/")
async def root():
    return {
        "message": "MEAMS API is running!",
        "status": "active",
        "version": API_VERSION
    }

@app.get("/health")
async def health_check():
    from database import client
    from datetime import datetime
    try:
        client.admin.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }
    
@app.get("/track/{tracking_id}")
async def track_redirect(tracking_id: str, request: Request):
    """Root-level redirect for QR tracking"""
    from routers.qr_tracking import track_and_display
    return await track_and_display(tracking_id, request)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# main.py

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from jose import JWTError, jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware

SECRET_KEY = "your_secret_key"  # Change this in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2PasswordBearer instance
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI()

# CORS middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow React app to make requests
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# CryptContext for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# User model
class User(BaseModel):
    username: str
    password: str

# Hardcoded valid users with roles
valid_users = {
    "admin": {"password": "password123", "role": "admin"},
    "staff": {"password": "staff123", "role": "staff"},
}

# Function to create JWT token
def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Login endpoint
@app.post("/login")
async def login(user: User):
    # Check if the username and password match
    if user.username not in valid_users or user.password != valid_users[user.username]["password"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user role from hardcoded credentials
    role = valid_users[user.username]["role"]
    
    # Create and return token with role
    access_token = create_access_token(data={"sub": user.username, "role": role})
    return {"access_token": access_token, "token_type": "bearer"}

# Token verification function
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")  # Get the role from the token
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

# Protected route for staff and admin
@app.get("/dashboard")
async def dashboard(token: str = Depends(oauth2_scheme)):
    # Verify the token
    payload = verify_token(token)
    username = payload["username"]
    return {"message": f"Welcome to the dashboard, {username}!"}

# Admin protected route
@app.get("/logs")
async def logs(token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    role = payload.get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this page",
        )
    return {"message": "Welcome to the logs page"}

# Staff restricted routes can be added in the same way

