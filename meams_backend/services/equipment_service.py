"""
Equipment service - business logic for equipment
"""
from bson import ObjectId
from datetime import datetime
from typing import List, Dict
from fastapi import HTTPException, UploadFile, Response
import base64

from database import get_equipment_collection

def equipment_helper(equipment) -> dict:
    """Format equipment data"""
    return {
        "_id": str(equipment["_id"]),
        "itemCode": equipment.get("itemCode", ""),
        "name": equipment.get("name", ""),
        "description": equipment.get("description", ""),
        "category": equipment.get("category", ""),
        "quantity": equipment.get("quantity", 0),
        "usefulLife": equipment.get("usefulLife", 0),
        "amount": equipment.get("amount", 0.0),
        "location": equipment.get("location", ""),
        "status": equipment.get("status", "Within-Useful-Life"),
        "unit_price": equipment.get("unit_price", 0.0),
        "supplier": equipment.get("supplier", ""),
        "date": equipment.get("date", ""),
        "reportDate": equipment.get("reportDate", ""),
        "reportDetails": equipment.get("reportDetails", ""),
        "repairHistory": equipment.get("repairHistory", []),  # ADD THIS LINE
        "image_data": equipment.get("image_data"),
        "image_filename": equipment.get("image_filename"),
        "image_content_type": equipment.get("image_content_type")
    }

def get_all_equipment() -> List[Dict]:
    """Get all equipment from database"""
    collection = get_equipment_collection()
    return [equipment_helper(e) for e in collection.find()]

def create_equipment(equipment_data: dict) -> Dict:
    """Create new equipment"""
    collection = get_equipment_collection()
    
    if not equipment_data.get("image_data"):
        equipment_data["image_data"] = None
    if not equipment_data.get("image_filename"):
        equipment_data["image_filename"] = None
    if not equipment_data.get("image_content_type"):
        equipment_data["image_content_type"] = None
    
    # Generate item code if not provided
    if not equipment_data.get("itemCode"):
        category_prefix = equipment_data.get("category", "EQP")[:3].upper()
        random_num = str(abs(hash(f"{equipment_data['name']}{datetime.utcnow()}")))[:5]
        equipment_data["itemCode"] = f"{category_prefix}-E-{random_num}"
    
    equipment_data["created_at"] = equipment_data["updated_at"] = datetime.utcnow()
    
    result = collection.insert_one(equipment_data)
    return equipment_helper(collection.find_one({"_id": result.inserted_id}))

def get_equipment_by_id(equipment_id: str) -> Dict:
    """Get equipment by ID"""
    collection = get_equipment_collection()
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment_helper(equipment)

def update_equipment(equipment_id: str, update_data: dict) -> Dict:
    """Update equipment"""
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    collection.update_one({"_id": ObjectId(equipment_id)}, {"$set": update_data})
    return equipment_helper(collection.find_one({"_id": ObjectId(equipment_id)}))

def delete_equipment(equipment_id: str) -> Dict:
    """Delete equipment"""
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    equipment_data = equipment_helper(equipment)
    collection.delete_one({"_id": ObjectId(equipment_id)})
    return equipment_data

async def add_equipment_image(equipment_id: str, image: UploadFile) -> Dict:
    """Add image to equipment"""
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    contents = await image.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file too large (max 5MB)")
    
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    collection.update_one(
        {"_id": ObjectId(equipment_id)},
        {"$set": {
            "image_data": image_base64,
            "image_filename": image.filename,
            "image_content_type": image.content_type,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return equipment_helper(collection.find_one({"_id": ObjectId(equipment_id)}))

def update_equipment_repair(equipment_id: str, repair_data: dict) -> Dict:
    """Update equipment with repair information and add to repair history"""
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    # Validate required fields
    if not repair_data.get("repairDate"):
        raise HTTPException(status_code=400, detail="Repair date is required")
    
    if not repair_data.get("repairDetails") or not repair_data.get("repairDetails").strip():
        raise HTTPException(status_code=400, detail="Repair details are required")
    
    if repair_data.get("amountUsed") is None or float(repair_data.get("amountUsed", 0)) < 0:
        raise HTTPException(status_code=400, detail="Amount used must be a valid number")
    
    # Create new repair entry
    new_repair_entry = {
        "repairDate": repair_data.get("repairDate"),
        "repairDetails": repair_data.get("repairDetails").strip(),
        "amountUsed": float(repair_data.get("amountUsed", 0)),
        "completedAt": datetime.utcnow().isoformat()
    }
    
    # Use $push to add to repairHistory array (this preserves existing entries)
    collection.update_one(
        {"_id": ObjectId(equipment_id)},
        {
            "$push": {"repairHistory": new_repair_entry},
            "$set": {
                "status": "Within-Useful-Life",  # Reset status after repair
                "reportDate": "",  # Clear report date
                "reportDetails": "",  # Clear report details
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    updated_equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    return equipment_helper(updated_equipment)
