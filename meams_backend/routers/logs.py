"""
Logs router - handles system logs
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import Optional

from models.log import LogsFilter
from services.auth_service import verify_token
from services.log_service import create_log_entry, log_helper
from database import get_logs_collection
from dependencies import get_current_user

router = APIRouter(prefix="/api/logs", tags=["logs"])

@router.get("")
async def get_logs(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None,
    token: str = Depends(get_current_user)
):
    """Get logs with filtering - admin only"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    collection = get_logs_collection()
    query = {}
    
    # Date filtering
    if date_from or date_to:
        date_query = {}
        if date_from:
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            date_query["$gte"] = from_date
        if date_to:
            to_date = datetime.strptime(date_to, "%Y-%m-%d")
            to_date = to_date + timedelta(days=1) - timedelta(seconds=1)
            date_query["$lte"] = to_date
        query["timestamp"] = date_query
    
    # Username filtering
    if username and username != "ALL USERS":
        query["username"] = {"$regex": username, "$options": "i"}
    
    # Search filtering
    if search:
        query["$or"] = [
            {"action": {"$regex": search, "$options": "i"}},
            {"details": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}}
        ]
    
    logs_cursor = collection.find(query).sort("timestamp", -1).limit(1000)
    
    logs = []
    usernames_set = set()
    
    for log in logs_cursor:
        formatted_log = log_helper(log)
        formatted_log["remarks"] = f"{formatted_log['action']} {formatted_log['details']}".strip()
        logs.append(formatted_log)
        usernames_set.add(log.get("username", ""))
    
    usernames = ["ALL USERS"] + sorted(list(usernames_set - {""}))
    
    return {
        "success": True,
        "message": f"Found {len(logs)} log entries",
        "data": logs,
        "usernames": usernames
    }

@router.post("/export")
async def export_logs(
    filters: LogsFilter,
    token: str = Depends(get_current_user)
):
    """Export logs as CSV - admin only"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    collection = get_logs_collection()
    query = {}
    
    # Apply filters (same as get_logs)
    if filters.date_from or filters.date_to:
        date_query = {}
        if filters.date_from:
            from_date = datetime.strptime(filters.date_from, "%Y-%m-%d")
            date_query["$gte"] = from_date
        if filters.date_to:
            to_date = datetime.strptime(filters.date_to, "%Y-%m-%d")
            to_date = to_date + timedelta(days=1) - timedelta(seconds=1)
            date_query["$lte"] = to_date
        query["timestamp"] = date_query
    
    if filters.username and filters.username != "ALL USERS":
        query["username"] = {"$regex": filters.username, "$options": "i"}
    
    if filters.search:
        query["$or"] = [
            {"action": {"$regex": filters.search, "$options": "i"}},
            {"details": {"$regex": filters.search, "$options": "i"}},
            {"username": {"$regex": filters.search, "$options": "i"}}
        ]
    
    logs_cursor = collection.find(query).sort("timestamp", -1)
    csv_rows = ["Timestamp,Username,Action,Details,IP Address"]
    
    for log in logs_cursor:
        timestamp = log.get("formatted_timestamp", log.get("timestamp", ""))
        username = log.get("username", "")
        action = log.get("action", "")
        details = log.get("details", "")
        ip_address = log.get("ip_address", "unknown")
        
        def escape_csv_field(field):
            field = str(field).replace('"', '""')
            if ',' in field or '"' in field or '\n' in field:
                field = f'"{field}"'
            return field
        
        csv_row = f"{escape_csv_field(timestamp)},{escape_csv_field(username)},{escape_csv_field(action)},{escape_csv_field(details)},{escape_csv_field(ip_address)}"
        csv_rows.append(csv_row)
    
    csv_data = "\n".join(csv_rows)
    current_date = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"meams_logs_{current_date}.csv"
    
    await create_log_entry(
        payload["username"],
        "Exported logs.",
        f"Exported {len(csv_rows) - 1} log entries to CSV",
        "system"
    )
    
    return {
        "success": True,
        "message": f"Exported {len(csv_rows) - 1} log entries",
        "csv_data": csv_data,
        "filename": filename
    }