from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pymongo import MongoClient
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional, List
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import json
from jose import JWTError, jwt
from passlib.context import CryptContext

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

# Authentication setup
SECRET_KEY = "your_secret_key"  # Change this in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2PasswordBearer instance
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# CryptContext for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
equipment_collection = db.equipment  # NEW: Equipment collection

# Authentication Models
class User(BaseModel):
    username: str
    password: str

# Hardcoded valid users with roles
valid_users = {
    "admin": {"password": "password123", "role": "admin"},
    "staff": {"password": "staff123", "role": "staff"},
}

# Function to create JWT token
def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Token verification function
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"username": username, "role": role}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Helper function to convert ObjectId to string for supplies
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

# NEW: Helper function to convert ObjectId to string for equipment
def equipment_helper(equipment) -> dict:
    return {
        "_id": str(equipment["_id"]),
        "name": equipment.get("name", equipment.get("description", "")),           # Equipment name
        "description": equipment.get("description", equipment.get("name", "")),   # Description
        "category": equipment.get("category", "General"),
        "quantity": equipment.get("quantity", 1),
        "unit": equipment.get("unit", "UNIT"),
        "location": equipment.get("location", ""),
        "status": equipment.get("status", "Operational"),
        "serialNo": equipment.get("serialNo", equipment.get("serial_number", "")),
        "itemCode": equipment.get("itemCode", equipment.get("item_code", "")),
        "unit_price": equipment.get("unit_price", 0.0),
        "supplier": equipment.get("supplier", ""),
        "created_at": equipment.get("created_at", datetime.utcnow()),
        "updated_at": equipment.get("updated_at", datetime.utcnow())
    }

# Pydantic models for supplies
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

# NEW: Pydantic models for equipment
class EquipmentCreate(BaseModel):
    name: str                    # Equipment name (required)
    description: str             # Detailed description (required)
    category: str
    quantity: int
    unit: Optional[str] = "UNIT"
    location: Optional[str] = ""
    status: Optional[str] = "Operational"
    serialNo: Optional[str] = ""
    itemCode: Optional[str] = ""
    unit_price: Optional[float] = 0.0
    supplier: Optional[str] = ""

class EquipmentUpdate(BaseModel):
    name: Optional[str] = None           # Equipment name
    description: Optional[str] = None    # Equipment description
    category: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    serialNo: Optional[str] = None
    itemCode: Optional[str] = None
    unit_price: Optional[float] = None
    supplier: Optional[str] = None

# Authentication Routes

@app.get("/")
async def root():
    return {"message": "MEAMS Asset Management API is running!", "status": "active"}

@app.post("/login")
async def login(user: User):
    """Login endpoint for authentication"""
    print(f"Login attempt: {user.username}")  # Debug log
    
    # Check if the username and password match
    if user.username not in valid_users or user.password != valid_users[user.username]["password"]:
        print(f"Invalid credentials for user: {user.username}")  # Debug log
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user role from hardcoded credentials
    role = valid_users[user.username]["role"]
    print(f"Login successful for {user.username} with role {role}")  # Debug log
    
    # Create and return token with role
    access_token = create_access_token(data={"sub": user.username, "role": role})
    return {"access_token": access_token, "token_type": "bearer"}

# Protected route for staff and admin
@app.get("/dashboard")
async def dashboard(token: str = Depends(oauth2_scheme)):
    """Dashboard endpoint - requires authentication"""
    payload = verify_token(token)
    username = payload["username"]
    return {"message": f"Welcome to the dashboard, {username}!"}

# Admin protected route
@app.get("/logs")
async def logs(token: str = Depends(oauth2_scheme)):
    """Logs endpoint - admin only"""
    payload = verify_token(token)
    role = payload.get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this page",
        )
    return {"message": "Welcome to the logs page"}

@app.get("/health")
async def health_check():
    try:
        # Test database connection
        client.admin.command('ping')
        return {"status": "healthy", "database": "connected", "timestamp": datetime.utcnow()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

# =============================================================================
# SUPPLIES API ROUTES (EXISTING - UNCHANGED)
# =============================================================================

@app.post("/api/supplies", response_model=dict)
async def add_supply(supply: SupplyCreate, token: str = Depends(oauth2_scheme)):
    """Add a new supply item - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
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
async def get_all_supplies(token: str = Depends(oauth2_scheme)):
    """Get all supply items - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
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
async def get_supply(supply_id: str, token: str = Depends(oauth2_scheme)):
    """Get a specific supply item by ID - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
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
async def update_supply(supply_id: str, supply_update: SupplyUpdate, token: str = Depends(oauth2_scheme)):
    """Update a supply item - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
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
async def delete_supply(supply_id: str, token: str = Depends(oauth2_scheme)):
    """Delete a supply item - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
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
async def get_supplies_by_category(category: str, token: str = Depends(oauth2_scheme)):
    """Get supplies by category - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
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
async def get_categories(token: str = Depends(oauth2_scheme)):
    """Get all unique categories - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
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
async def search_supplies(query: str, token: str = Depends(oauth2_scheme)):
    """Search supplies by name or description - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
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

# =============================================================================
# NEW: EQUIPMENT API ROUTES
# =============================================================================

@app.post("/api/equipment", response_model=dict)
async def add_equipment(equipment: EquipmentCreate, token: str = Depends(oauth2_scheme)):
    """Add a new equipment item - requires authentication"""
    verify_token(token)
    
    try:
        equipment_dict = equipment.dict()
        equipment_dict["created_at"] = datetime.utcnow()
        equipment_dict["updated_at"] = datetime.utcnow()
        
        # Generate item code if not provided
        if not equipment_dict.get("itemCode"):
            category_prefix = equipment_dict.get("category", "EQP")[:3].upper()
            random_num = str(abs(hash(str(datetime.utcnow()))))[:5]
            equipment_dict["itemCode"] = f"{category_prefix}-E-{random_num}"
        
        result = equipment_collection.insert_one(equipment_dict)
        created_equipment = equipment_collection.find_one({"_id": result.inserted_id})
        
        print(f"✅ Equipment added: {equipment_dict.get('name', 'Unknown')}")
        
        return {
            "success": True,
            "message": "Equipment added successfully",
            "data": equipment_helper(created_equipment)
        }
    except Exception as e:
        print(f"❌ Error adding equipment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add equipment: {str(e)}")

@app.get("/api/equipment", response_model=dict)
async def get_all_equipment(token: str = Depends(oauth2_scheme)):
    """Get all equipment items - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        equipment_list = []
        for equipment in equipment_collection.find():
            equipment_list.append(equipment_helper(equipment))
        
        print(f"📦 Retrieved {len(equipment_list)} equipment items")
        
        return {
            "success": True,
            "message": f"Found {len(equipment_list)} equipment items",
            "data": equipment_list
        }
    except Exception as e:
        print(f"❌ Error retrieving equipment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment: {str(e)}")

@app.get("/api/equipment/{equipment_id}", response_model=dict)
async def get_equipment(equipment_id: str, token: str = Depends(oauth2_scheme)):
    """Get a specific equipment item by ID - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        if not ObjectId.is_valid(equipment_id):
            raise HTTPException(status_code=400, detail="Invalid equipment ID format")
        
        equipment = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")
        
        return {
            "success": True,
            "message": "Equipment found",
            "data": equipment_helper(equipment)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment: {str(e)}")

@app.put("/api/equipment/{equipment_id}", response_model=dict)
async def update_equipment(equipment_id: str, equipment_update: EquipmentUpdate, token: str = Depends(oauth2_scheme)):
    """Update an equipment item - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        if not ObjectId.is_valid(equipment_id):
            raise HTTPException(status_code=400, detail="Invalid equipment ID format")
        
        # Only update fields that are provided
        update_data = {k: v for k, v in equipment_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        update_data["updated_at"] = datetime.utcnow()
        
        result = equipment_collection.update_one(
            {"_id": ObjectId(equipment_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Equipment not found")
        
        updated_equipment = equipment_collection.find_one({"_id": ObjectId(equipment_id)})
        
        print(f"✅ Equipment updated: {equipment_id}")
        
        return {
            "success": True,
            "message": "Equipment updated successfully",
            "data": equipment_helper(updated_equipment)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update equipment: {str(e)}")

@app.delete("/api/equipment/{equipment_id}", response_model=dict)
async def delete_equipment(equipment_id: str, token: str = Depends(oauth2_scheme)):
    """Delete an equipment item - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        if not ObjectId.is_valid(equipment_id):
            raise HTTPException(status_code=400, detail="Invalid equipment ID format")
        
        result = equipment_collection.delete_one({"_id": ObjectId(equipment_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Equipment not found")
        
        print(f"🗑️ Equipment deleted: {equipment_id}")
        
        return {
            "success": True,
            "message": "Equipment deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete equipment: {str(e)}")

@app.get("/api/equipment/category/{category}", response_model=dict)
async def get_equipment_by_category(category: str, token: str = Depends(oauth2_scheme)):
    """Get equipment by category - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        equipment_list = []
        for equipment in equipment_collection.find({"category": category}):
            equipment_list.append(equipment_helper(equipment))
        
        return {
            "success": True,
            "message": f"Found {len(equipment_list)} equipment items in category '{category}'",
            "data": equipment_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment by category: {str(e)}")

@app.get("/api/equipment/status/{status}", response_model=dict)
async def get_equipment_by_status(status: str, token: str = Depends(oauth2_scheme)):
    """Get equipment by status - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        equipment_list = []
        for equipment in equipment_collection.find({"status": status}):
            equipment_list.append(equipment_helper(equipment))
        
        return {
            "success": True,
            "message": f"Found {len(equipment_list)} equipment items with status '{status}'",
            "data": equipment_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment by status: {str(e)}")

@app.get("/api/equipment/location/{location}", response_model=dict)
async def get_equipment_by_location(location: str, token: str = Depends(oauth2_scheme)):
    """Get equipment by location - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        equipment_list = []
        for equipment in equipment_collection.find({"location": location}):
            equipment_list.append(equipment_helper(equipment))
        
        return {
            "success": True,
            "message": f"Found {len(equipment_list)} equipment items at location '{location}'",
            "data": equipment_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment by location: {str(e)}")

@app.get("/api/equipment/search/{query}", response_model=dict)
async def search_equipment(query: str, token: str = Depends(oauth2_scheme)):
    """Search equipment by name, description, serial number, or item code - requires authentication"""
    verify_token(token)
    
    try:
        # Case-insensitive search in multiple fields including name
        search_filter = {
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}},
                {"serialNo": {"$regex": query, "$options": "i"}},
                {"itemCode": {"$regex": query, "$options": "i"}},
                {"category": {"$regex": query, "$options": "i"}}
            ]
        }
        
        equipment_list = []
        for equipment in equipment_collection.find(search_filter):
            equipment_list.append(equipment_helper(equipment))
        
        return {
            "success": True,
            "message": f"Found {len(equipment_list)} equipment items matching '{query}'",
            "data": equipment_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Equipment search failed: {str(e)}")

@app.get("/api/equipment/categories", response_model=dict)
async def get_equipment_categories(token: str = Depends(oauth2_scheme)):
    """Get all unique equipment categories - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        categories = equipment_collection.distinct("category")
        if not categories:
            # Return default categories if none exist
            categories = ['Mechanical', 'Electrical', 'Medical', 'IT Equipment', 'Laboratory', 'HVAC', 'Safety']
        
        return {
            "success": True,
            "message": f"Found {len(categories)} equipment categories",
            "data": categories
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment categories: {str(e)}")

@app.get("/api/equipment/statuses", response_model=dict)
async def get_equipment_statuses(token: str = Depends(oauth2_scheme)):
    """Get all unique equipment statuses - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        statuses = equipment_collection.distinct("status")
        if not statuses:
            # Return default statuses if none exist
            statuses = ['Operational', 'Maintenance', 'Out of Service', 'Under Repair']
        
        return {
            "success": True,
            "message": f"Found {len(statuses)} equipment statuses",
            "data": statuses
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment statuses: {str(e)}")

@app.get("/api/equipment/locations", response_model=dict)
async def get_equipment_locations(token: str = Depends(oauth2_scheme)):
    """Get all unique equipment locations - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        locations = equipment_collection.distinct("location")
        # Filter out empty locations
        locations = [loc for loc in locations if loc and loc.strip()]
        
        return {
            "success": True,
            "message": f"Found {len(locations)} equipment locations",
            "data": locations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve equipment locations: {str(e)}")

@app.post("/api/equipment/batch", response_model=dict)
async def add_multiple_equipment(equipment_data: dict, token: str = Depends(oauth2_scheme)):
    """Add multiple equipment items at once - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        equipment_list = equipment_data.get("equipment", [])
        if not equipment_list or not isinstance(equipment_list, list):
            raise HTTPException(status_code=400, detail="Invalid equipment array provided")
        
        added_equipment = []
        for eq_data in equipment_list:
            try:
                equipment = EquipmentCreate(**eq_data)
                equipment_dict = equipment.dict()
                equipment_dict["created_at"] = datetime.utcnow()
                equipment_dict["updated_at"] = datetime.utcnow()
                
                # Generate item code if not provided
                if not equipment_dict.get("itemCode"):
                    category_prefix = equipment_dict.get("category", "EQP")[:3].upper()
                    random_num = str(abs(hash(str(datetime.utcnow()) + str(len(added_equipment)))))[:5]
                    equipment_dict["itemCode"] = f"{category_prefix}-E-{random_num}"
                
                result = equipment_collection.insert_one(equipment_dict)
                created_equipment = equipment_collection.find_one({"_id": result.inserted_id})
                added_equipment.append(equipment_helper(created_equipment))
                
            except Exception as e:
                print(f"❌ Failed to add equipment item: {str(e)}")
                continue
        
        return {
            "success": True,
            "message": f"Successfully added {len(added_equipment)} equipment items",
            "data": added_equipment
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add multiple equipment: {str(e)}")

@app.get("/api/equipment/export", response_model=dict)
async def export_equipment(format: str = "json", token: str = Depends(oauth2_scheme)):
    """Export equipment data - requires authentication"""
    verify_token(token)  # Verify user is authenticated
    
    try:
        equipment_list = []
        for equipment in equipment_collection.find():
            equipment_list.append(equipment_helper(equipment))
        
        if format.lower() == "csv":
            # Return data formatted for CSV export
            return {
                "success": True,
                "message": f"Exported {len(equipment_list)} equipment items as CSV",
                "data": equipment_list,
                "format": "csv"
            }
        else:
            # Return JSON format
            return {
                "success": True,
                "message": f"Exported {len(equipment_list)} equipment items as JSON",
                "data": equipment_list,
                "format": "json"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export equipment: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)