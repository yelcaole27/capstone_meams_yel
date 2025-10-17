"""
========================
forecast_service.py (REVISED - 2024-2025 Output)
========================
Revised to show 2024 historical data + 2025 forecast on line graphs.
"""
from typing import List, Dict, Any
from datetime import datetime, timedelta
import math
import numpy as np
import pandas as pd

from database import (
    get_historical_supplies_forecast_collection,
    get_historical_equipment_forecast_collection
)

_forecast_cache = {}
_cache_expiry = {}


def clean_nan_data(data: Any) -> Any:
    """Clean NaN/inf values recursively for JSON output. Preserves 0 values."""
    if isinstance(data, dict):
        return {k: clean_nan_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_nan_data(item) for item in data]
    elif isinstance(data, float):
        if math.isnan(data):
            return 0.0
        elif math.isinf(data):
            return 0.0
        else:
            # Return the actual value, even if it's 0 (don't convert)
            return data
    return data


def generate_2025_forecast(df_bootstrapped: pd.DataFrame) -> pd.DataFrame:
    """Generate 2025 forecast using SARIMA from 2024 data."""
    from processing import generate_sarima_forecast
    print("[GENERATING] 2025 forecast from 2024 historical data...")

    try:
        bootstrap_ts = df_bootstrapped.reset_index()
        bootstrap_ts['date'] = pd.to_datetime(bootstrap_ts['date'])
        bootstrap_ts['quantity'] = pd.to_numeric(bootstrap_ts['quantity'], errors='coerce').fillna(0)

        # Generate 12 months of 2025 forecast
        n_periods_2025 = 12

        bootstrap_ts = bootstrap_ts.set_index('date').asfreq('MS').fillna(0)
        bootstrap_ts_for_sarima = bootstrap_ts.reset_index()

        # Call generate_sarima_forecast which returns bounds from SARIMA
        forecast_2025 = generate_sarima_forecast(
            bootstrap_ts_for_sarima, 'date', 'quantity',
            n_periods=n_periods_2025, seasonal_period=12
        )

        print(f"[DEBUG] Forecast returned {len(forecast_2025)} records")
        print(f"[DEBUG] Forecast columns: {forecast_2025.columns.tolist()}")
        if not forecast_2025.empty:
            print(f"[DEBUG] Sample forecast row - quantity: {forecast_2025['quantity'].iloc[0]}, lower: {forecast_2025['lower_bound'].iloc[0]}, upper: {forecast_2025['upper_bound'].iloc[0]}")

        # Ensure date column exists and is properly formatted
        if 'date' not in forecast_2025.columns:
            print("[WARNING] Date column missing from forecast, generating dates...")
            dates_2025 = pd.date_range(start='2025-01-01', end='2025-12-01', freq='MS')
            forecast_2025['date'] = dates_2025[:len(forecast_2025)]
        else:
            forecast_2025['date'] = pd.to_datetime(forecast_2025['date'])

        # Ensure bounds exist and are not zero (use SARIMA bounds, fallback to 85/115% if needed)
        # Check each bound value individually
        if 'lower_bound' in forecast_2025.columns:
            # If any lower bounds are 0 or NaN, replace with 85% fallback
            zero_mask = (forecast_2025['lower_bound'] == 0) | forecast_2025['lower_bound'].isna()
            if zero_mask.any():
                print(f"[WARNING] Found {zero_mask.sum()} zero/NaN lower bounds, applying fallback")
                forecast_2025.loc[zero_mask, 'lower_bound'] = forecast_2025.loc[zero_mask, 'quantity'] * 0.85
        else:
            print("[WARNING] Lower bound column missing, creating from quantity")
            forecast_2025['lower_bound'] = forecast_2025['quantity'] * 0.85
        
        if 'upper_bound' in forecast_2025.columns:
            # If any upper bounds are 0 or NaN, replace with 115% fallback
            zero_mask = (forecast_2025['upper_bound'] == 0) | forecast_2025['upper_bound'].isna()
            if zero_mask.any():
                print(f"[WARNING] Found {zero_mask.sum()} zero/NaN upper bounds, applying fallback")
                forecast_2025.loc[zero_mask, 'upper_bound'] = forecast_2025.loc[zero_mask, 'quantity'] * 1.15
        else:
            print("[WARNING] Upper bound column missing, creating from quantity")
            forecast_2025['upper_bound'] = forecast_2025['quantity'] * 1.15

        # Add forecast_type column
        forecast_2025['forecast_type'] = 'forecast'

        # Select columns using .loc to avoid ambiguity
        forecast_2025 = forecast_2025.loc[:, ['date', 'quantity', 'lower_bound', 'upper_bound', 'forecast_type']].copy()
        
        print(f"[INFO] Generated {len(forecast_2025)} months of 2025 forecast data")
        return forecast_2025

    except Exception as e:
        print(f"[ERROR] Failed to generate 2025 forecast: {e}")
        import traceback
        traceback.print_exc()
        
        dates_2025 = pd.date_range(start='2025-01-01', end='2025-12-01', freq='MS')
        return pd.DataFrame({
            'date': dates_2025,
            'quantity': [0] * len(dates_2025),
            'lower_bound': [0] * len(dates_2025),
            'upper_bound': [0] * len(dates_2025),
            'forecast_type': ['forecast'] * len(dates_2025)
        })


def _generate_forecast(collection_fn, label: str, n_periods: int = 12):
    """Shared logic for supplies and equipment forecast - outputs 2024 historical + 2025 forecast."""
    cache_key = f"{label}_{n_periods}"
    now = datetime.utcnow()

    if cache_key in _forecast_cache and now < _cache_expiry.get(cache_key, now):
        print(f"[CACHE HIT] Using cached {label} forecast.")
        return _forecast_cache[cache_key]

    print(f"[GENERATING] {label.capitalize()} forecast (2024 historical + 2025 forecast)...")

    try:
        from processing import bootstrap_years, generate_sarima_forecast
        collection = collection_fn()
        raw_data = list(collection.find({}, {"_id": 0}))
        if not raw_data:
            print(f"[WARNING] No raw {label} data found.")
            return []

        df = pd.DataFrame(raw_data)
        df['date'] = pd.to_datetime(df['date'])
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)

        # Filter to 2024 data only (your MongoDB now contains 2024 data after manual update)
        df['date'] = pd.to_datetime(df['date'])
        df_2024 = df[(df['date'].dt.year == 2024)].copy()
        
        print(f"[DEBUG] Found {len(df_2024)} records for 2024")
        if not df_2024.empty:
            print(f"[DEBUG] Date range in 2024 data: {df_2024['date'].min()} to {df_2024['date'].max()}")
        
        if df_2024.empty:
            print(f"[WARNING] No 2024 {label} data found in MongoDB.")
            return []

        # Prepare 2024 historical data - sort by date to ensure chronological order
        historical_2024 = df_2024.copy()
        historical_2024 = historical_2024.sort_values('date').reset_index(drop=True)
        historical_2024['forecast_type'] = 'historical'
        
        # Only add bounds if they don't exist (don't overwrite existing bounds from SARIMA)
        if 'lower_bound' not in historical_2024.columns:
            historical_2024['lower_bound'] = historical_2024['quantity'] * 0.8
        if 'upper_bound' not in historical_2024.columns:
            historical_2024['upper_bound'] = historical_2024['quantity'] * 1.2
        
        # Ensure these columns exist before selection
        for col in ['lower_bound', 'upper_bound']:
            if col not in historical_2024.columns:
                historical_2024[col] = 0.0
        
        # Select columns using .loc
        historical_2024 = historical_2024.loc[:, ['date', 'quantity', 'lower_bound', 'upper_bound', 'forecast_type']].copy()
        print(f"[DEBUG] Historical 2024 prepared: {len(historical_2024)} records from {historical_2024['date'].min()} to {historical_2024['date'].max()}")

        # Generate 2025 forecast using 2024 data
        df_2024_for_forecast = df_2024.set_index('date').asfreq('MS').fillna(0)
        forecast_2025 = generate_2025_forecast(df_2024_for_forecast)
        print(f"[DEBUG] Forecast 2025 generated: {len(forecast_2025)} records")

        # Combine 2024 historical + 2025 forecast
        combined_df = pd.concat([historical_2024, forecast_2025], ignore_index=True)
        combined_df = combined_df.sort_values('date').drop_duplicates('date')
        combined_df['date'] = combined_df['date'].dt.strftime('%Y-%m-%d')

        # Clean and prepare result
        result = clean_nan_data(combined_df.to_dict(orient='records'))
        
        # Cache the result
        _forecast_cache[cache_key] = result
        _cache_expiry[cache_key] = now + timedelta(hours=1)

        print(f"[COMPLETE] {label.capitalize()} forecast ready. Total records: {len(result)}")
        print(f"[COMPLETE] Date range: {combined_df['date'].min()} to {combined_df['date'].max()}")
        
        return result

    except Exception as e:
        print(f"[ERROR] {label.capitalize()} forecast generation failed: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_supplies_forecast(n_periods: int = 12) -> List[Dict]:
    """Get supplies forecast: 2024 historical + 2025 forecast."""
    return _generate_forecast(get_historical_supplies_forecast_collection, "supplies", n_periods)


def get_equipment_forecast(n_periods: int = 12) -> List[Dict]:
    """Get equipment forecast: 2024 historical + 2025 forecast."""
    return _generate_forecast(get_historical_equipment_forecast_collection, "equipment", n_periods)
