"""
Forecast service - wrapper for forecasting logic with caching
"""
import pandas as pd
from typing import List, Dict
from datetime import datetime, timedelta
from database import (
    get_historical_supplies_forecast_collection,
    get_historical_equipment_forecast_collection
)
from processing import bootstrap_years, generate_sarima_forecast

# Simple cache
_forecast_cache = {}
_cache_expiry = {}

def get_supplies_forecast(n_periods: int = 12) -> List[Dict]:
    """Get supplies forecast with caching"""
    cache_key = f"supplies_{n_periods}"
    now = datetime.utcnow()
    
    # Check cache (1 hour expiry)
    if cache_key in _forecast_cache and now < _cache_expiry.get(cache_key, now):
        print(f"[CACHE HIT] Using cached supplies forecast")
        return _forecast_cache[cache_key]
    
    print(f"[GENERATING] New supplies forecast...")
    start_time = datetime.utcnow()
    
    try:
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
    """Get equipment forecast with caching"""
    cache_key = f"equipment_{n_periods}"
    now = datetime.utcnow()
    
    # Check cache (1 hour expiry)
    if cache_key in _forecast_cache and now < _cache_expiry.get(cache_key, now):
        print(f"[CACHE HIT] Using cached equipment forecast")
        return _forecast_cache[cache_key]
    
    print(f"[GENERATING] New equipment forecast...")
    start_time = datetime.utcnow()
    
    try:
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