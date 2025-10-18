from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from config import API_TITLE, API_VERSION, ALLOWED_ORIGINS
from database import connect_db
from routers import help_support
import time

app = FastAPI(title=API_TITLE, version=API_VERSION)

@app.get("/")
async def root():
    return {
        "message": "MEAMS API is running!",
        "status": "active",
        "version": API_VERSION
    }

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
