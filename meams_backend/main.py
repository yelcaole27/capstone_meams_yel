from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional, List
import os
from datetime import datetime
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

app = FastAPI(title="MEAMS Asset Management API", version="1.0.0")

# CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Your React app URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://admin:MEAMSDS42@cluster0.xl6k426.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DATABASE_NAME = os.getenv("DATABASE_NAME", "MEAMS")

try:
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    # Test connection
    client.admin.command('ping')
    print(f"✅ Connected to MongoDB: {DATABASE_NAME}")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")

# Collections
supplies_collection = db.supplies

# Helper function to convert ObjectId to string
def supply_helper(supply) -> dict:
    return {
        "_id": str(supply["_id"]),
        "name": supply["name"],
        "description": supply.get("description", ""),
        "category": supply["category"],
        "quantity": supply["quantity"],
        "supplier": supply.get("supplier", ""),
        "location": supply.get("location", ""),
        "status": supply.get("status", "available"),
        "created_at": supply.get("created_at", datetime.utcnow()),
        "updated_at": supply.get("updated_at", datetime.utcnow())
    }

# Pydantic models for request/response
class SupplyCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: str
    quantity: int
    supplier: Optional[str] = ""
    location: Optional[str] = ""
    status: Optional[str] = "available"

class SupplyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    supplier: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None

class SupplyResponse(BaseModel):
    _id: str
    name: str
    description: str
    category: str
    quantity: int
    unit_price: float
    supplier: str
    location: str
    status: str
    created_at: datetime
    updated_at: datetime

# API Routes

@app.get("/")
async def root():
    return {"message": "MEAMS Asset Management API is running!", "status": "active"}

@app.get("/health")
async def health_check():
    try:
        # Test database connection
        client.admin.command('ping')
        return {"status": "healthy", "database": "connected", "timestamp": datetime.utcnow()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

# Supplies API Routes

@app.post("/api/supplies", response_model=dict)
async def add_supply(supply: SupplyCreate):
    """Add a new supply item"""
    try:
        supply_dict = supply.dict()
        supply_dict["created_at"] = datetime.utcnow()
        supply_dict["updated_at"] = datetime.utcnow()
        
        result = supplies_collection.insert_one(supply_dict)
        created_supply = supplies_collection.find_one({"_id": result.inserted_id})
        
        return {
            "success": True,
            "message": "Supply added successfully",
            "data": supply_helper(created_supply)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add supply: {str(e)}")

@app.get("/api/supplies", response_model=dict)
async def get_all_supplies():
    """Get all supply items"""
    try:
        supplies = []
        for supply in supplies_collection.find():
            supplies.append(supply_helper(supply))
        
        return {
            "success": True,
            "message": f"Found {len(supplies)} supplies",
            "data": supplies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve supplies: {str(e)}")

@app.get("/api/supplies/{supply_id}", response_model=dict)
async def get_supply(supply_id: str):
    """Get a specific supply item by ID"""
    try:
        if not ObjectId.is_valid(supply_id):
            raise HTTPException(status_code=400, detail="Invalid supply ID format")
        
        supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        if not supply:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        return {
            "success": True,
            "message": "Supply found",
            "data": supply_helper(supply)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve supply: {str(e)}")

@app.put("/api/supplies/{supply_id}", response_model=dict)
async def update_supply(supply_id: str, supply_update: SupplyUpdate):
    """Update a supply item"""
    try:
        if not ObjectId.is_valid(supply_id):
            raise HTTPException(status_code=400, detail="Invalid supply ID format")
        
        # Only update fields that are provided
        update_data = {k: v for k, v in supply_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        update_data["updated_at"] = datetime.utcnow()
        
        result = supplies_collection.update_one(
            {"_id": ObjectId(supply_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        updated_supply = supplies_collection.find_one({"_id": ObjectId(supply_id)})
        
        return {
            "success": True,
            "message": "Supply updated successfully",
            "data": supply_helper(updated_supply)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update supply: {str(e)}")

@app.delete("/api/supplies/{supply_id}", response_model=dict)
async def delete_supply(supply_id: str):
    """Delete a supply item"""
    try:
        if not ObjectId.is_valid(supply_id):
            raise HTTPException(status_code=400, detail="Invalid supply ID format")
        
        result = supplies_collection.delete_one({"_id": ObjectId(supply_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Supply not found")
        
        return {
            "success": True,
            "message": "Supply deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete supply: {str(e)}")

@app.get("/api/supplies/category/{category}", response_model=dict)
async def get_supplies_by_category(category: str):
    """Get supplies by category"""
    try:
        supplies = []
        for supply in supplies_collection.find({"category": category}):
            supplies.append(supply_helper(supply))
        
        return {
            "success": True,
            "message": f"Found {len(supplies)} supplies in category '{category}'",
            "data": supplies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve supplies by category: {str(e)}")

@app.get("/api/categories", response_model=dict)
async def get_categories():
    """Get all unique categories"""
    try:
        categories = supplies_collection.distinct("category")
        return {
            "success": True,
            "message": f"Found {len(categories)} categories",
            "data": categories
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve categories: {str(e)}")

# Search functionality
@app.get("/api/supplies/search/{query}", response_model=dict)
async def search_supplies(query: str):
    """Search supplies by name or description"""
    try:
        # Case-insensitive search in name and description
        search_filter = {
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}}
            ]
        }
        
        supplies = []
        for supply in supplies_collection.find(search_filter):
            supplies.append(supply_helper(supply))
        
        return {
            "success": True,
            "message": f"Found {len(supplies)} supplies matching '{query}'",
            "data": supplies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)