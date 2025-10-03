"""
Supply service - business logic for supplies
"""
from bson import ObjectId
from datetime import datetime
from typing import List, Dict
from fastapi import HTTPException, UploadFile, Response
import base64

from database import get_supplies_collection

def supply_helper(supply) -> dict:
    """Format supply data"""
    return {
        "_id": str(supply["_id"]),
        "name": supply["name"],
        "description": supply.get("description", ""),
        "category": supply["category"],
        "quantity": supply["quantity"],
        "supplier": supply.get("supplier", ""),
        "location": supply.get("location", ""),
        "status": supply.get("status", "available"),
        "itemCode": supply.get("itemCode", ""),
        "date": supply.get("date", ""),
        "has_image": supply.get("image_data") is not None and supply.get("image_data") != "",
        "image_data": supply.get("image_data"),
        "image_filename": supply.get("image_filename"),
        "image_content_type": supply.get("image_content_type"),
        "created_at": supply.get("created_at", datetime.utcnow()),
        "updated_at": supply.get("updated_at", datetime.utcnow())
    }

def get_all_supplies() -> List[Dict]:
    """Get all supplies from database"""
    collection = get_supplies_collection()
    return [supply_helper(s) for s in collection.find()]

def create_supply(supply_data: dict) -> Dict:
    """Create a new supply"""
    collection = get_supplies_collection()
    
    # Process image data
    if supply_data.get("itemPicture"):
        supply_data["image_data"] = supply_data["itemPicture"]
        filename = supply_data.get("image_filename")
        supply_data["image_filename"] = filename if filename and filename.strip() else "unknown_filename"
        supply_data["image_content_type"] = supply_data.get("image_content_type") or "image/jpeg"
    else:
        supply_data["image_data"] = None
        supply_data["image_filename"] = None
        supply_data["image_content_type"] = None
    
    supply_data.pop("itemPicture", None)
    
    # Generate item code if missing
    if not supply_data.get("itemCode"):
        category_prefix = supply_data.get("category", "SUP")[:3].upper()
        random_num = str(abs(hash(str(datetime.utcnow()))))[:5]
        supply_data["itemCode"] = f"{category_prefix}-{random_num}"
    
    supply_data["created_at"] = supply_data["updated_at"] = datetime.utcnow()
    
    result = collection.insert_one(supply_data)
    return supply_helper(collection.find_one({"_id": result.inserted_id}))

def get_supply_by_id(supply_id: str) -> Dict:
    """Get supply by ID"""
    collection = get_supplies_collection()
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    return supply_helper(supply)

def update_supply(supply_id: str, update_data: dict) -> Dict:
    """Update a supply"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    collection.update_one({"_id": ObjectId(supply_id)}, {"$set": update_data})
    return supply_helper(collection.find_one({"_id": ObjectId(supply_id)}))

def delete_supply(supply_id: str) -> Dict:
    """Delete a supply"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    supply_data = supply_helper(supply)
    collection.delete_one({"_id": ObjectId(supply_id)})
    return supply_data

async def add_supply_image(supply_id: str, image: UploadFile) -> Dict:
    """Add image to supply"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    contents = await image.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file too large (max 5MB)")
    
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    collection.update_one(
        {"_id": ObjectId(supply_id)},
        {"$set": {
            "image_data": image_base64,
            "image_filename": image.filename,
            "image_content_type": image.content_type,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return supply_helper(collection.find_one({"_id": ObjectId(supply_id)}))

def get_supply_image(supply_id: str) -> Response:
    """Get supply image"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    if not supply.get("image_data"):
        raise HTTPException(status_code=404, detail="No image found for this supply")
    
    image_data = base64.b64decode(supply["image_data"])
    content_type = supply.get("image_content_type", "image/jpeg")
    
    return Response(content=image_data, media_type=content_type)

def delete_supply_image(supply_id: str) -> Dict:
    """Delete supply image"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    collection.update_one(
        {"_id": ObjectId(supply_id)},
        {
            "$unset": {
                "image_data": "",
                "image_filename": "",
                "image_content_type": ""
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return supply_helper(collection.find_one({"_id": ObjectId(supply_id)}))