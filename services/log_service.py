"""
Log service - handles logging operations
"""
from datetime import datetime
from database import get_logs_collection

def log_helper(log) -> dict:
    """Helper function to format log data"""
    return {
        "_id": str(log["_id"]),
        "timestamp": log.get("formatted_timestamp", log.get("timestamp", "")),
        "username": log.get("username", ""),
        "action": log.get("action", ""),
        "details": log.get("details", ""),
        "ip_address": log.get("ip_address", "unknown"),
        "created_at": log.get("timestamp", datetime.utcnow())
    }

async def create_log_entry(username: str, action: str, details: str = "", ip_address: str = "unknown"):
    """Create a log entry in the database"""
    try:
        collection = get_logs_collection()
        log_entry = {
            "timestamp": datetime.utcnow(),
            "username": username,
            "action": action,
            "details": details,
            "ip_address": ip_address,
            "formatted_timestamp": datetime.utcnow().strftime("%m/%d/%Y - %H:%M:%S")
        }
        collection.insert_one(log_entry)
        print(f"Log created: {username} - {action}")
    except Exception as e:
        print(f"Failed to create log entry: {str(e)}")