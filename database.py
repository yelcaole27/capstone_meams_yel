"""
MongoDB database connection and collection references
"""
from pymongo import MongoClient, ASCENDING, DESCENDING
from config import MONGODB_URL, DATABASE_NAME

client = None
db = None

def connect_db():
    """Initialize database connection"""
    global client, db
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        client.admin.command('ping')
        print(f"Connected to MongoDB: {DATABASE_NAME}")
        create_indexes()
        return db
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise

def create_indexes():
    """Create database indexes for better performance"""
    try:
        # Supplies indexes
        db.supplies.create_index([("itemCode", ASCENDING)])
        db.supplies.create_index([("category", ASCENDING)])
        db.supplies.create_index([("status", ASCENDING)])
        db.supplies.create_index([("created_at", DESCENDING)])
        
        # Equipment indexes
        db.equipment.create_index([("itemCode", ASCENDING)])
        db.equipment.create_index([("category", ASCENDING)])
        db.equipment.create_index([("status", ASCENDING)])
        db.equipment.create_index([("created_at", DESCENDING)])
        
        # Accounts indexes
        db.accounts.create_index([("username", ASCENDING)], unique=True)
        db.accounts.create_index([("email", ASCENDING)], unique=True)
        
        # Logs indexes
        db.logs.create_index([("timestamp", DESCENDING)])
        db.logs.create_index([("username", ASCENDING)])
        
        print("Database indexes created successfully")
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