"""
Forecast router - handles forecasting endpoints
"""
from fastapi import APIRouter, Depends, HTTPException

from services.auth_service import verify_token
from services.forecast_service import get_supplies_forecast, get_equipment_forecast
from dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["forecast"])

@router.get("/forecast-supplies")
async def forecast_supplies(
    token: str = Depends(get_current_user),
    n_periods: int = 12
):
    """Get supplies forecast for next n_periods months"""
    verify_token(token)
    
    try:
        forecast_data = get_supplies_forecast(n_periods)
        
        if not forecast_data:
            return {
                "success": True,
                "message": "No historical supplies data available for forecasting.",
                "data": []
            }
        
        return {
            "success": True,
            "data": forecast_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate supplies forecast: {str(e)}"
        )

@router.get("/forecast-equipment")
async def forecast_equipment(
    token: str = Depends(get_current_user),
    n_periods: int = 12
):
    """Get equipment forecast for next n_periods months"""
    verify_token(token)
    
    try:
        forecast_data = get_equipment_forecast(n_periods)
        
        if not forecast_data:
            return {
                "success": True,
                "message": "No historical equipment data available for forecasting.",
                "data": []
            }
        
        return {
            "success": True,
            "data": forecast_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate equipment forecast: {str(e)}"
        )
