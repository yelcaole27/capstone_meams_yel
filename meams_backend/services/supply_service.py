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
        "unit": supply.get("unit", "piece"),
        "itemCode": supply.get("itemCode", ""),
        "date": supply.get("date", ""),
        "has_image": supply.get("image_data") is not None and supply.get("image_data") != "",
        "image_data": supply.get("image_data"),
        "image_filename": supply.get("image_filename"),
        "image_content_type": supply.get("image_content_type"),
        "transactionHistory": supply.get("transactionHistory", []),
        "documents": supply.get("documents", []),
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
    
    if "documents" not in supply_data:
        supply_data["documents"] = []
    
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

async def add_supply_document(supply_id: str, file: UploadFile) -> Dict:
    """Add document to supply"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    allowed_types = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/jpeg',
        'image/png',
        'image/gif'
    ]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Allowed: PDF, DOCX, DOC, JPEG, PNG, GIF"
        )
    
    contents = await file.read()
    file_size = len(contents)
    
    if file_size > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")
    
    file_base64 = base64.b64encode(contents).decode('utf-8')
    
    document = {
        "filename": file.filename,
        "file_data": file_base64,
        "content_type": file.content_type,
        "file_size": file_size,
        "uploaded_at": datetime.utcnow().isoformat()
    }
    
    collection.update_one(
        {"_id": ObjectId(supply_id)},
        {
            "$push": {"documents": document},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return supply_helper(collection.find_one({"_id": ObjectId(supply_id)}))

def get_supply_documents(supply_id: str) -> List[Dict]:
    """Get all documents for a supply"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    documents = supply.get("documents", [])
    
    return [{
        "index": idx,
        "filename": doc["filename"],
        "content_type": doc["content_type"],
        "file_size": doc["file_size"],
        "uploaded_at": doc["uploaded_at"]
    } for idx, doc in enumerate(documents)]

def get_supply_document(supply_id: str, document_index: int) -> Response:
    """Get a specific document by index"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    documents = supply.get("documents", [])
    
    if document_index < 0 or document_index >= len(documents):
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = documents[document_index]
    file_data = base64.b64decode(document["file_data"])
    
    return Response(
        content=file_data,
        media_type=document["content_type"],
        headers={
            "Content-Disposition": f'inline; filename="{document["filename"]}"'
        }
    )

def delete_supply_document(supply_id: str, document_index: int) -> Dict:
    """Delete a specific document by index"""
    collection = get_supplies_collection()
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    documents = supply.get("documents", [])
    
    if document_index < 0 or document_index >= len(documents):
        raise HTTPException(status_code=404, detail="Document not found")
    
    documents.pop(document_index)
    
    collection.update_one(
        {"_id": ObjectId(supply_id)},
        {
            "$set": {
                "documents": documents,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return supply_helper(collection.find_one({"_id": ObjectId(supply_id)}))
