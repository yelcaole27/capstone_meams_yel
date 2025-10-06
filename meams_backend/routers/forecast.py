"""
Forecast service - generates safe predictions for supplies and equipment
Handles NaN, division by zero, and empty data to prevent JSON serialization errors.
"""
import math
from datetime import datetime, timedelta
from typing import Dict, List, Any
from bson import ObjectId
from database import get_supplies_collection, get_equipment_collection
import numpy as np  # For safe array operations (install if needed: pip install numpy)

from fastapi import APIRouter
router = APIRouter()  # Or prefix it with tags/prefix as needed, e.g., router = APIRouter(prefix="/forecast", tags=["forecast"])
    
def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safely divide, returning default if denominator is zero or result is NaN/inf."""
    if denominator == 0 or math.isnan(denominator) or math.isinf(denominator):
        return default
    result = numerator / denominator
    if math.isnan(result) or math.isinf(result):
        return default
    return result

def safe_mean(values: List[float]) -> float:
    """Safely calculate mean, handling empty lists or NaN."""
    if not values:
        return 0.0
    # Replace NaN with 0 and compute mean
    clean_values = [0.0 if math.isnan(v) or math.isinf(v) else v for v in values]
    return np.mean(clean_values)

def safe_trend_slope(values: List[float], time_periods: List[float]) -> float:
    """Simple linear trend slope, safely."""
    if len(values) < 2 or not time_periods:
        return 0.0
    n = len(values)
    # Basic least-squares slope: avoid NaN
    sum_x = sum(time_periods)
    sum_y = sum(values)
    sum_xy = sum(x * y for x, y in zip(time_periods, values))
    sum_x2 = sum(x * x for x in time_periods)
    denominator = n * sum_x2 - sum_x ** 2
    if denominator == 0:
        return 0.0
    slope = safe_divide(n * sum_xy - sum_x * sum_y, denominator)
    return slope

def get_supplies_forecast(n_periods: int = 12) -> List[Dict[str, Any]]:
    """
    Generate supplies forecast for next n_periods months.
    Returns list of monthly predictions; handles empty data safely.
    """
    collection = get_supplies_collection()
    supplies = list(collection.find().sort("date", 1))  # Sort by date ascending
    
    if not supplies:
        # Return empty forecast with safe defaults
        return [{"month": i+1, "predicted_demand": 0.0, "trend": 0.0, "total_value": 0.0} for i in range(n_periods)]
    
    # Extract historical data safely
    historical_amounts = []
    historical_dates = []
    current_date = datetime.now()
    
    for item in supplies:
        amount = float(item.get("amount", 0.0))
        date_str = item.get("date")
        if amount > 0 and date_str:
            try:
                item_date = datetime.fromisoformat(date_str)
                if item_date <= current_date:  # Only historical data
                    historical_amounts.append(amount)
                    # Time period in months from earliest date
                    months_since_start = (item_date - min(historical_dates or [item_date])).days / 30.25
                    historical_dates.append(months_since_start)
            except ValueError:
                # Invalid date: skip
                continue
    
    if not historical_amounts:
        # No valid historical data
        return [{"month": i+1, "predicted_demand": 0.0, "trend": 0.0, "total_value": 0.0} for i in range(n_periods)]
    
    # Calculate base metrics safely
    avg_monthly_demand = safe_mean(historical_amounts)
    trend_slope = safe_trend_slope(historical_amounts, historical_dates)
    
    # Generate forecast for each period
    forecast_data = []
    base_demand = avg_monthly_demand
    for period in range(1, n_periods + 1):
        # Simple linear projection: base + (slope * period)
        predicted = base_demand + (trend_slope * period)
        predicted = max(0.0, round(predicted, 2))  # No negatives, round safely
        
        forecast_data.append({
            "month": period,
            "predicted_demand": predicted,
            "trend": round(trend_slope, 4),  # Same trend for all periods
            "total_value": round(predicted * len(supplies), 2),  # Projected total
            "risk_level": "low" if trend_slope > -0.1 else "medium" if trend_slope < 0 else "high"
        })
    
    # Final NaN sweep (redundant but safe)
    for item in forecast_data:
        for key, value in item.items():
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                item[key] = 0.0
    
    return forecast_data

def get_equipment_forecast(n_periods: int = 12) -> List[Dict[str, Any]]:
    """
    Generate equipment forecast for next n_periods months.
    Focuses on repairs, replacements, maintenance costs; handles empty data safely.
    """
    collection = get_equipment_collection()
    equipment = list(collection.find().sort("date", 1))
    
    if not equipment:
        # Return empty forecast with safe defaults
        return [{"month": i+1, "predicted_repairs": 0, "maintenance_cost": 0.0, "replacement_needs": 0} for i in range(n_periods)]
    
    # Extract historical data safely
    historical_repairs = []
    historical_costs = []
    historical_dates = []
    current_date = datetime.now()
    total_useful_life = 0
    total_equipment = len(equipment)
    
    for item in equipment:
        useful_life = float(item.get("usefulLife", 5.0))
        total_useful_life += useful_life
        date_str = item.get("date")
        repair_history = item.get("repairHistory", [])
        
        # Age calculation
        age = 0.0
        if date_str:
            try:
                purchase_date = datetime.fromisoformat(date_str)
                if purchase_date <= current_date:
                    age = (current_date - purchase_date).days / 365.25
                    age = max(0.0, age)  # No negatives
            except ValueError:
                age = 0.0
        
        # Aggregate repairs per item (monthly-ish)
        item_repairs = len(repair_history)
        item_cost = sum(float(repair.get("amountUsed", 0.0)) for repair in repair_history)
        if item_repairs > 0 or item_cost > 0:
            historical_repairs.append(item_repairs)
            historical_costs.append(item_cost)
            # Time period based on age
            historical_dates.append(age)
    
    if not historical_repairs:
        # No repair history
        avg_repairs = 0
        avg_cost = 0.0
        trend_slope = 0.0
    else:
        avg_repairs = safe_mean(historical_repairs)
        avg_cost = safe_mean(historical_costs)
        trend_slope = safe_trend_slope(historical_costs, historical_dates)  # Cost trend over time
    
    avg_lifespan = safe_divide(total_useful_life, total_equipment)
    replacement_rate = safe_divide(sum(1 for item in equipment if age >= item.get("usefulLife", 5.0)), total_equipment)
    
    # Generate forecast
    forecast_data = []
    base_repairs = avg_repairs * total_equipment
    base_cost = avg_cost * total_equipment
    for period in range(1, n_periods + 1):
        # Project with trend
        projected_repairs = max(0, round(base_repairs + (trend_slope * period / 12), 0))  # Monthly
        projected_cost = max(0.0, round(base_cost + (trend_slope * period), 2))
        projected_replacements = round(replacement_rate * total_equipment * (period / 12), 0)  # Cumulative
        
        forecast_data.append({
            "month": period,
            "predicted_repairs": projected_repairs,
            "maintenance_cost": projected_cost,
            "replacement_needs": projected_replacements,
            "avg_lifespan_remaining": round(max(0, avg_lifespan - (period / 12)), 1)
        })
    
    # Final NaN sweep
    for item in forecast_data:
        for key, value in item.items():
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                item[key] = 0.0
    
    return forecast_data
