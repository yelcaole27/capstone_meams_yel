"""
========================
OPTIMIZED forecast_service.py
========================
KEY FIX: All heavy imports moved to function level
"""
from typing import List, Dict
from datetime import datetime, timedelta
from database import (
    get_historical_supplies_forecast_collection,
    get_historical_equipment_forecast_collection
)

# Simple cache
_forecast_cache = {}
_cache_expiry = {}

def get_supplies_forecast(n_periods: int = 12) -> List[Dict]:
    """Get supplies forecast with caching
    
    PERFORMANCE: Heavy imports (pandas, statsmodels) are lazy-loaded
    """
    cache_key = f"supplies_{n_periods}"
    now = datetime.utcnow()
    
    # Check cache (1 hour expiry)
    if cache_key in _forecast_cache and now < _cache_expiry.get(cache_key, now):
        print(f"[CACHE HIT] Using cached supplies forecast")
        return _forecast_cache[cache_key]
    
    print(f"[GENERATING] New supplies forecast...")
    start_time = datetime.utcnow()
    
    try:
        # 🚀 LAZY IMPORTS - Only load when actually generating forecast
        import pandas as pd
        from processing import bootstrap_years, generate_sarima_forecast
        
        collection = get_historical_supplies_forecast_collection()
        raw_data = list(collection.find({}, {"_id": 0}))
        
        if not raw_data:
            return []
        
        df = pd.DataFrame(raw_data)
        if 'date' not in df.columns or 'quantity' not in df.columns:
            return []
        
        boot_df = bootstrap_years(df, date_col='date', value_col='quantity', start_year=2021, end_year=2024)
        forecast_df = generate_sarima_forecast(boot_df, date_col='date', value_col='quantity', n_periods=n_periods, seasonal_period=12)
        forecast_df['date'] = forecast_df['date'].dt.strftime('%Y-%m-%d')
        
        result = forecast_df.to_dict(orient='records')
        
        # Cache for 1 hour
        _forecast_cache[cache_key] = result
        _cache_expiry[cache_key] = now + timedelta(hours=1)
        
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        print(f"[COMPLETE] Supplies forecast generated in {elapsed:.2f}s")
        
        return result
    except Exception as e:
        print(f"[ERROR] Forecast generation failed: {e}")
        return []

def get_equipment_forecast(n_periods: int = 12) -> List[Dict]:
    """Get equipment forecast with caching
    
    PERFORMANCE: Heavy imports (pandas, statsmodels) are lazy-loaded
    """
    cache_key = f"equipment_{n_periods}"
    now = datetime.utcnow()
    
    # Check cache (1 hour expiry)
    if cache_key in _forecast_cache and now < _cache_expiry.get(cache_key, now):
        print(f"[CACHE HIT] Using cached equipment forecast")
        return _forecast_cache[cache_key]
    
    print(f"[GENERATING] New equipment forecast...")
    start_time = datetime.utcnow()
    
    try:
        # 🚀 LAZY IMPORTS - Only load when actually generating forecast
        import pandas as pd
        from processing import bootstrap_years, generate_sarima_forecast
        
        collection = get_historical_equipment_forecast_collection()
        raw_data = list(collection.find({}, {"_id": 0}))
        
        if not raw_data:
            return []
        
        df = pd.DataFrame(raw_data)
        if 'date' not in df.columns or 'quantity' not in df.columns:
            return []
        
        boot_df = bootstrap_years(df, date_col='date', value_col='quantity', start_year=2021, end_year=2024)
        forecast_df = generate_sarima_forecast(boot_df, date_col='date', value_col='quantity', n_periods=n_periods, seasonal_period=12)
        forecast_df['date'] = forecast_df['date'].dt.strftime('%Y-%m-%d')
        
        result = forecast_df.to_dict(orient='records')
        
        # Cache for 1 hour
        _forecast_cache[cache_key] = result
        _cache_expiry[cache_key] = now + timedelta(hours=1)
        
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        print(f"[COMPLETE] Equipment forecast generated in {elapsed:.2f}s")
        
        return result
    except Exception as e:
        print(f"[ERROR] Forecast generation failed: {e}")
        return []

def clear_forecast_cache():
    """Clear all forecast caches"""
    global _forecast_cache, _cache_expiry
    _forecast_cache.clear()
    _cache_expiry.clear()
    print("[CACHE] Forecast cache cleared")


"""
========================
OPTIMIZED database.py
========================
KEY FIX: Make index creation non-blocking
"""
from pymongo import MongoClient, ASCENDING, DESCENDING
from config import MONGODB_URL, DATABASE_NAME
import threading

client = None
db = None

def connect_db():
    """Initialize database connection"""
    global client, db
    try:
        client = MongoClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=5000,  # 5 second timeout
            connectTimeoutMS=5000,
            socketTimeoutMS=5000
        )
        db = client[DATABASE_NAME]
        
        # Quick ping to verify connection
        client.admin.command('ping')
        print(f"✓ Connected to MongoDB: {DATABASE_NAME}")
        
        # Create indexes in background thread to not block startup
        threading.Thread(target=create_indexes_async, daemon=True).start()
        
        return db
    except Exception as e:
        print(f"✗ Failed to connect to MongoDB: {e}")
        raise

def create_indexes_async():
    """Create indexes asynchronously in background"""
    try:
        print("⏳ Creating database indexes in background...")
        create_indexes()
        print("✓ Database indexes created successfully")
    except Exception as e:
        print(f"⚠ Warning: Could not create some indexes: {e}")

def create_indexes():
    """Create database indexes for better performance"""
    try:
        # Supplies indexes
        db.supplies.create_index([("itemCode", ASCENDING)], background=True)
        db.supplies.create_index([("category", ASCENDING)], background=True)
        db.supplies.create_index([("status", ASCENDING)], background=True)
        db.supplies.create_index([("created_at", DESCENDING)], background=True)
        
        # Equipment indexes
        db.equipment.create_index([("itemCode", ASCENDING)], background=True)
        db.equipment.create_index([("category", ASCENDING)], background=True)
        db.equipment.create_index([("status", ASCENDING)], background=True)
        db.equipment.create_index([("created_at", DESCENDING)], background=True)
        
        # Accounts indexes
        db.accounts.create_index([("username", ASCENDING)], unique=True, background=True)
        db.accounts.create_index([("email", ASCENDING)], unique=True, background=True)
        
        # Logs indexes
        db.logs.create_index([("timestamp", DESCENDING)], background=True)
        db.logs.create_index([("username", ASCENDING)], background=True)
        
    except Exception as e:
        print(f"Error creating indexes: {e}")

def get_database():
    """Get database instance"""
    global db
    if db is None:
        db = connect_db()
    return db

def get_supplies_collection():
    return get_database().supplies

def get_equipment_collection():
    return get_database().equipment

def get_accounts_collection():
    return get_database().accounts

def get_logs_collection():
    return get_database().logs

def get_historical_supplies_forecast_collection():
    return get_database().historical_supplies_forecast

def get_historical_equipment_forecast_collection():
    return get_database().historical_equipment_forecast
