"""
========================
OPTIMIZED dashboard.py
========================
Uses database indices for faster queries
"""
from fastapi import APIRouter, Depends
from datetime import datetime
from database import get_supplies_collection, get_equipment_collection
from services.auth_service import verify_token
from dependencies import get_current_user
from functools import lru_cache
from typing import Dict, Any

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Cache status distribution calculations for 30 seconds
_cache_timestamp = {}
_cache_data = {}

def get_cached_stats(cache_key: str, compute_func, ttl_seconds: int = 30):
    """Simple time-based cache"""
    now = datetime.utcnow().timestamp()
    
    if cache_key in _cache_timestamp:
        if now - _cache_timestamp[cache_key] < ttl_seconds:
            return _cache_data[cache_key]
    
    # Cache miss or expired - recompute
    result = compute_func()
    _cache_data[cache_key] = result
    _cache_timestamp[cache_key] = now
    return result

@router.get("/stats")
async def get_dashboard_stats(token: str = Depends(get_current_user)):
    """Get aggregated dashboard statistics - optimized with caching"""
    verify_token(token)
    
    def compute_stats():
        supplies_collection = get_supplies_collection()
        equipment_collection = get_equipment_collection()
        
        # Optimized aggregation pipeline with $facet for parallel processing
        supplies_stats = list(supplies_collection.aggregate([
            {
                "$facet": {
                    "overview": [
                        {
                            "$group": {
                                "_id": None,
                                "total_items": {"$sum": 1},
                                "total_quantity": {"$sum": "$quantity"},
                                "categories": {"$addToSet": "$category"}
                            }
                        }
                    ],
                    "status_distribution": [
                        {
                            "$group": {
                                "_id": "$status",
                                "count": {"$sum": 1}
                            }
                        }
                    ]
                }
            }
        ]))
        
        equipment_stats = list(equipment_collection.aggregate([
            {
                "$facet": {
                    "overview": [
                        {
                            "$group": {
                                "_id": None,
                                "total_items": {"$sum": 1},
                                "total_quantity": {"$sum": "$quantity"},
                                "total_value": {"$sum": {"$multiply": ["$quantity", "$amount"]}},
                                "categories": {"$addToSet": "$category"}
                            }
                        }
                    ],
                    "status_distribution": [
                        {
                            "$group": {
                                "_id": "$status",
                                "count": {"$sum": 1}
                            }
                        }
                    ]
                }
            }
        ]))
        
        # Process supplies data
        supplies_status_dist = {}
        supplies_overview = {}
        
        if supplies_stats and supplies_stats[0]:
            if supplies_stats[0].get("status_distribution"):
                supplies_status_dist = {
                    item["_id"]: item["count"] 
                    for item in supplies_stats[0]["status_distribution"]
                }
            if supplies_stats[0].get("overview") and supplies_stats[0]["overview"]:
                supplies_overview = supplies_stats[0]["overview"][0]
        
        # Process equipment data
        equipment_status_dist = {}
        equipment_overview = {}
        
        if equipment_stats and equipment_stats[0]:
            if equipment_stats[0].get("status_distribution"):
                equipment_status_dist = {
                    item["_id"]: item["count"] 
                    for item in equipment_stats[0]["status_distribution"]
                }
            if equipment_stats[0].get("overview") and equipment_stats[0]["overview"]:
                equipment_overview = equipment_stats[0]["overview"][0]
        
        return {
            "supplies": {
                "total_items": supplies_overview.get("total_items", 0),
                "total_quantity": supplies_overview.get("total_quantity", 0),
                "categories_count": len(supplies_overview.get("categories", [])),
                "status_distribution": supplies_status_dist
            },
            "equipment": {
                "total_items": equipment_overview.get("total_items", 0),
                "total_quantity": equipment_overview.get("total_quantity", 0),
                "total_value": equipment_overview.get("total_value", 0),
                "categories_count": len(equipment_overview.get("categories", [])),
                "status_distribution": equipment_status_dist
            }
        }
    
    # Use cached stats (30 second TTL)
    stats = get_cached_stats("dashboard_stats", compute_stats, ttl_seconds=30)
    
    return {
        "success": True,
        "data": {
            **stats,
            "timestamp": datetime.utcnow().isoformat()
        }
    }

@router.get("/recent-supplies")
async def get_recent_supplies(token: str = Depends(get_current_user), limit: int = 10):
    """Get most recently added supplies - cached"""
    verify_token(token)
    
    def compute_recent():
        supplies_collection = get_supplies_collection()
        # Only fetch necessary fields for better performance
        recent = list(supplies_collection.find(
            {},
            {
                "name": 1, "category": 1, "quantity": 1, 
                "status": 1, "created_at": 1, "itemCode": 1
            }
        ).sort("created_at", -1).limit(limit))
        
        from services.supply_service import supply_helper
        return [supply_helper(s) for s in recent]
    
    data = get_cached_stats(f"recent_supplies_{limit}", compute_recent, ttl_seconds=15)
    
    return {
        "success": True,
        "data": data
    }

@router.get("/recent-equipment")
async def get_recent_equipment(token: str = Depends(get_current_user), limit: int = 10):
    """Get most recently added equipment - cached"""
    verify_token(token)
    
    def compute_recent():
        equipment_collection = get_equipment_collection()
        # Only fetch necessary fields
        recent = list(equipment_collection.find(
            {},
            {
                "name": 1, "category": 1, "quantity": 1, 
                "status": 1, "created_at": 1, "itemCode": 1, "amount": 1
            }
        ).sort("created_at", -1).limit(limit))
        
        from services.equipment_service import equipment_helper
        return [equipment_helper(e) for e in recent]
    
    data = get_cached_stats(f"recent_equipment_{limit}", compute_recent, ttl_seconds=15)
    
    return {
        "success": True,
        "data": data
    }
