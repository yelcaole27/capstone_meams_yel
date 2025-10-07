"""
========================
forecast_service.py (FIXED - Column Selection Issue)
========================
Fix: Properly handles DataFrame column selection and ensures forecast_type exists.
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
    """Clean NaN/inf values recursively for JSON output."""
    if isinstance(data, dict):
        return {k: clean_nan_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_nan_data(item) for item in data]
    elif isinstance(data, float) and (math.isnan(data) or math.isinf(data)):
        return 0.0
    return data


def generate_2024_historical(df_bootstrapped: pd.DataFrame, start_date: str = '2024-01-01') -> pd.DataFrame:
    """Generate 2024 data using SARIMA from bootstrapped data."""
    from processing import generate_sarima_forecast
    print("[GENERATING] 2024 historical data from bootstrap...")

    try:
        bootstrap_ts = df_bootstrapped.reset_index()
        bootstrap_ts['date'] = pd.to_datetime(bootstrap_ts['date'])
        bootstrap_ts['quantity'] = pd.to_numeric(bootstrap_ts['quantity'], errors='coerce').fillna(0)

        dates_2024 = pd.date_range(start=start_date, end='2024-12-01', freq='MS')
        n_periods_2024 = len(dates_2024)

        bootstrap_ts = bootstrap_ts.set_index('date').asfreq('MS').fillna(0)
        bootstrap_ts_for_sarima = bootstrap_ts.reset_index()

        historical_2024 = generate_sarima_forecast(
            bootstrap_ts_for_sarima, 'date', 'quantity',
            n_periods=n_periods_2024, seasonal_period=12
        )

        # Ensure date column exists
        if 'date' not in historical_2024.columns:
            historical_2024['date'] = dates_2024
        else:
            historical_2024['date'] = pd.to_datetime(historical_2024['date'])

        # Ensure bounds exist BEFORE adding forecast_type
        if 'lower_bound' not in historical_2024.columns:
            historical_2024['lower_bound'] = historical_2024['quantity'] * 0.8
        if 'upper_bound' not in historical_2024.columns:
            historical_2024['upper_bound'] = historical_2024['quantity'] * 1.2

        # Add forecast_type column
        historical_2024['forecast_type'] = 'generated'

        # Now select columns - use .loc to avoid ambiguity
        historical_2024 = historical_2024.loc[:, ['date', 'quantity', 'lower_bound', 'upper_bound', 'forecast_type']].copy()
        
        print(f"[INFO] Generated {len(historical_2024)} months of 2024 historical data")
        return historical_2024

    except Exception as e:
        print(f"[ERROR] Failed to generate 2024 historical data: {e}")
        import traceback
        traceback.print_exc()
        
        dates_2024 = pd.date_range(start=start_date, end='2024-12-01', freq='MS')
        return pd.DataFrame({
            'date': dates_2024,
            'quantity': [0] * len(dates_2024),
            'lower_bound': [0] * len(dates_2024),
            'upper_bound': [0] * len(dates_2024),
            'forecast_type': ['generated'] * len(dates_2024)
        })


def _generate_forecast(collection_fn, label: str, n_periods: int = 12):
    """Shared logic for supplies and equipment forecast."""
    cache_key = f"{label}_{n_periods}"
    now = datetime.utcnow()

    if cache_key in _forecast_cache and now < _cache_expiry.get(cache_key, now):
        print(f"[CACHE HIT] Using cached {label} forecast.")
        return _forecast_cache[cache_key]

    print(f"[GENERATING] {label.capitalize()} forecast for {n_periods} periods...")

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

        # Generate bootstrapped and historical
        boot_df = bootstrap_years(df, 'date', 'quantity', start_year=2021, end_year=2024)
        boot_df_processed = boot_df.set_index('date').asfreq('MS').fillna(0)

        # Generate 2024 historical data
        historical_2024 = generate_2024_historical(boot_df_processed)

        # Generate 2025 forecast
        boot_df_for_forecast = boot_df_processed.reset_index()
        forecast_df = generate_sarima_forecast(
            boot_df_for_forecast, 'date', 'quantity', n_periods=n_periods, seasonal_period=12
        )

        if forecast_df.empty:
            raise ValueError("Forecast data is empty")

        # Prepare forecast DataFrame
        if 'date' not in forecast_df.columns:
            last_date = historical_2024['date'].max()
            forecast_df['date'] = pd.date_range(
                last_date + pd.DateOffset(months=1), 
                periods=n_periods, 
                freq='MS'
            )
        else:
            forecast_df['date'] = pd.to_datetime(forecast_df['date'])

        # Ensure all required columns exist
        for col in ['quantity', 'lower_bound', 'upper_bound']:
            if col not in forecast_df.columns:
                forecast_df[col] = 0.0

        # Add forecast_type
        forecast_df['forecast_type'] = 'forecast'
        
        # Select columns using .loc
        forecast_df = forecast_df.loc[:, ['date', 'quantity', 'lower_bound', 'upper_bound', 'forecast_type']].copy()

        # Add 2023 historical data
        historical_2023 = df.copy()
        historical_2023['forecast_type'] = 'historical'
        
        # Ensure bounds exist
        if 'lower_bound' not in historical_2023.columns:
            historical_2023['lower_bound'] = historical_2023['quantity'] * 0.8
        if 'upper_bound' not in historical_2023.columns:
            historical_2023['upper_bound'] = historical_2023['quantity'] * 1.2
        
        # Select columns using .loc
        historical_2023 = historical_2023.loc[:, ['date', 'quantity', 'lower_bound', 'upper_bound', 'forecast_type']].copy()

        # Combine all datasets
        combined_df = pd.concat([historical_2023, historical_2024, forecast_df], ignore_index=True)
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
    """Get supplies forecast with historical data."""
    return _generate_forecast(get_historical_supplies_forecast_collection, "supplies", n_periods)


def get_equipment_forecast(n_periods: int = 12) -> List[Dict]:
    """Get equipment forecast with historical data."""
    return _generate_forecast(get_historical_equipment_forecast_collection, "equipment", n_periods)
