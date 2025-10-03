"""
Dashboard router - fast aggregated data for overview
"""
from fastapi import APIRouter, Depends
from datetime import datetime
from database import get_supplies_collection, get_equipment_collection
from services.auth_service import verify_token
from dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats(token: str = Depends(get_current_user)):
    """Get aggregated dashboard statistics - optimized for speed"""
    verify_token(token)
    
    supplies_collection = get_supplies_collection()
    equipment_collection = get_equipment_collection()
    
    # Use aggregation pipeline for better performance
    supplies_stats = list(supplies_collection.aggregate([
        {
            "$group": {
                "_id": None,
                "total_items": {"$sum": 1},
                "total_quantity": {"$sum": "$quantity"},
                "categories": {"$addToSet": "$category"},
                "statuses": {"$push": "$status"}
            }
        }
    ]))
    
    equipment_stats = list(equipment_collection.aggregate([
        {
            "$group": {
                "_id": None,
                "total_items": {"$sum": 1},
                "total_quantity": {"$sum": "$quantity"},
                "total_value": {"$sum": {"$multiply": ["$quantity", "$amount"]}},
                "categories": {"$addToSet": "$category"},
                "statuses": {"$push": "$status"}
            }
        }
    ]))
    
    # Count status distributions
    supplies_status_dist = {}
    equipment_status_dist = {}
    
    if supplies_stats:
        for status in supplies_stats[0].get("statuses", []):
            supplies_status_dist[status] = supplies_status_dist.get(status, 0) + 1
    
    if equipment_stats:
        for status in equipment_stats[0].get("statuses", []):
            equipment_status_dist[status] = equipment_status_dist.get(status, 0) + 1
    
    supplies_data = supplies_stats[0] if supplies_stats else {}
    equipment_data = equipment_stats[0] if equipment_stats else {}
    
    return {
        "success": True,
        "data": {
            "supplies": {
                "total_items": supplies_data.get("total_items", 0),
                "total_quantity": supplies_data.get("total_quantity", 0),
                "categories_count": len(supplies_data.get("categories", [])),
                "status_distribution": supplies_status_dist
            },
            "equipment": {
                "total_items": equipment_data.get("total_items", 0),
                "total_quantity": equipment_data.get("total_quantity", 0),
                "total_value": equipment_data.get("total_value", 0),
                "categories_count": len(equipment_data.get("categories", [])),
                "status_distribution": equipment_status_dist
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    }

@router.get("/recent-supplies")
async def get_recent_supplies(token: str = Depends(get_current_user), limit: int = 10):
    """Get most recently added supplies"""
    verify_token(token)
    
    supplies_collection = get_supplies_collection()
    recent = list(supplies_collection.find().sort("created_at", -1).limit(limit))
    
    from services.supply_service import supply_helper
    return {
        "success": True,
        "data": [supply_helper(s) for s in recent]
    }

@router.get("/recent-equipment")
async def get_recent_equipment(token: str = Depends(get_current_user), limit: int = 10):
    """Get most recently added equipment"""
    verify_token(token)
    
    equipment_collection = get_equipment_collection()
    recent = list(equipment_collection.find().sort("created_at", -1).limit(limit))
    
    from services.equipment_service import equipment_helper
    return {
        "success": True,
        "data": [equipment_helper(e) for e in recent]
    }