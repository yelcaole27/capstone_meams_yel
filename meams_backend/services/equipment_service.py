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
        "usefulLife": equipment.get("usefulLife", 0),
        "amount": equipment.get("amount", 0.0),
        "location": equipment.get("location", ""),
        "status": equipment.get("status", "Within-Useful-Life"),
        "unit_price": equipment.get("unit_price", 0.0),
        "supplier": equipment.get("supplier", ""),
        "date": equipment.get("date", ""),
        "reportDate": equipment.get("reportDate", ""),
        "reportDetails": equipment.get("reportDetails", ""),
        "repairHistory": equipment.get("repairHistory", []),
        "documents": equipment.get("documents", []),
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
    
    # Validate repair data
    if not repair_data.get("repairDate"):
        raise HTTPException(status_code=400, detail="Repair date is required")
    
    if not repair_data.get("repairDetails"):
        raise HTTPException(status_code=400, detail="Repair details are required")
    
    if not repair_data.get("amountUsed"):
        raise HTTPException(status_code=400, detail="Amount used is required")
    
    # Create repair history entry
    repair_entry = {
        "repairDate": repair_data.get("repairDate"),
        "repairDetails": repair_data.get("repairDetails"),
        "amountUsed": float(repair_data.get("amountUsed")),
        "timestamp": datetime.utcnow()
    }
    
    # Update equipment: add to repair history, clear report fields, set status to Within-Useful-Life
    collection.update_one(
        {"_id": ObjectId(equipment_id)},
        {
            "$push": {"repairHistory": repair_entry},
            "$set": {
                "reportDate": "",
                "reportDetails": "",
                "status": "Within-Useful-Life",
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return equipment_helper(collection.find_one({"_id": ObjectId(equipment_id)}))

async def add_equipment_document(equipment_id: str, file: UploadFile) -> Dict:
    """Add document to equipment"""
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    # Validate file
    allowed_types = ['application/pdf', 'application/msword', 
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/jpeg', 'image/png', 'image/jpg', 'image/gif']
    
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")
    
    file_base64 = base64.b64encode(contents).decode('utf-8')
    
    document = {
        "filename": file.filename,
        "content_type": file.content_type,
        "data": file_base64,
        "uploaded_at": datetime.utcnow()
    }
    
    collection.update_one(
        {"_id": ObjectId(equipment_id)},
        {
            "$push": {"documents": document},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return equipment_helper(collection.find_one({"_id": ObjectId(equipment_id)}))

def get_equipment_documents(equipment_id: str) -> List[Dict]:
    """Get all documents for equipment"""
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    documents = equipment.get("documents", [])
    
    # Return documents without the base64 data (just metadata)
    return [
        {
            "index": idx,
            "filename": doc.get("filename"),
            "content_type": doc.get("content_type"),
            "uploaded_at": doc.get("uploaded_at")
        }
        for idx, doc in enumerate(documents)
    ]

def get_equipment_document(equipment_id: str, document_index: int) -> Response:
    """Get specific document for download"""
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    documents = equipment.get("documents", [])
    
    if document_index < 0 or document_index >= len(documents):
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = documents[document_index]
    file_data = base64.b64decode(document.get("data"))
    
    return Response(
        content=file_data,
        media_type=document.get("content_type"),
        headers={
            "Content-Disposition": f'attachment; filename="{document.get("filename")}"'
        }
    )

def delete_equipment_document(equipment_id: str, document_index: int) -> Dict:
    """Delete specific document from equipment"""
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    documents = equipment.get("documents", [])
    
    if document_index < 0 or document_index >= len(documents):
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Remove document at index
    documents.pop(document_index)
    
    collection.update_one(
        {"_id": ObjectId(equipment_id)},
        {
            "$set": {
                "documents": documents,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return equipment_helper(collection.find_one({"_id": ObjectId(equipment_id)}))

def calculate_lcc_analysis(equipment_id: str) -> Dict:
    """
    Performs Life Cycle Cost (LCC) analysis for a given equipment.
    """
    collection = get_equipment_collection()
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    # Use equipment_helper to get a consistent dictionary format
    formatted_equipment = equipment_helper(equipment)

    repair_history = formatted_equipment.get("repairHistory", [])
    useful_life = formatted_equipment.get("usefulLife", 5) # Default to 5 years if not specified
    purchase_price = formatted_equipment.get("amount", 0.0) # Assuming 'amount' is the purchase price

    current_date = datetime.utcnow()
    
    # Safely get purchase date, default to current date if not available
    purchase_date_str = formatted_equipment.get("date")
    try:
        purchase_date = datetime.fromisoformat(purchase_date_str) if purchase_date_str else current_date
    except ValueError:
        # Handle cases where date might be in a different format or invalid
        purchase_date = current_date

    age_in_years = (current_date - purchase_date).days / 365.25 if purchase_date != current_date else 0

    # Calculate repair metrics
    total_repairs = len(repair_history)
    total_repair_cost = sum(float(repair.get("amountUsed", 0.0)) for repair in repair_history)
    average_repair_cost = total_repair_cost / total_repairs if total_repairs > 0 else 0.0  # FIXED: Corrected division

    # Calculate repair frequency (repairs per year)
    repair_frequency = total_repairs / age_in_years if age_in_years > 0 else 0

    # Calculate cost thresholds
    cost_threshold = purchase_price * 0.5 # 50% of purchase price
    total_cost_of_ownership = purchase_price + total_repair_cost
    cost_ratio = (total_repair_cost / purchase_price) * 100 if purchase_price > 0 else 0

    # Determine LCC remarks and risk level
    lcc_remarks = []
    risk_level = 'Low'
    recommend_replacement = False

    if total_repair_cost >= cost_threshold and purchase_price > 0:
        lcc_remarks.append('Costly Repair')
        risk_level = 'High'
        recommend_replacement = True

    if repair_frequency > 2: # More than 2 repairs per year
        lcc_remarks.append('Frequent Repair')
        if risk_level != 'High':
            risk_level = 'Medium'
        if repair_frequency > 3:
            recommend_replacement = True

    if age_in_years >= useful_life and useful_life > 0:
        lcc_remarks.append('Beyond Useful Life')
        risk_level = 'High'
        recommend_replacement = True
    elif age_in_years >= useful_life - 1 and useful_life > 0: # Within 1 year of useful life
        lcc_remarks.append('Approaching End of Life')
        if risk_level == 'Low':
            risk_level = 'Medium'

    # Check for multiple recent repairs (e.g., 3+ repairs in last 6 months)
    six_months_ago = current_date - datetime.timedelta(days=180)
    recent_repairs_count = 0
    for repair in repair_history:
        try:
            repair_date = datetime.fromisoformat(repair.get("repairDate", ""))
            if repair_date >= six_months_ago:
                recent_repairs_count += 1
        except ValueError:
            # Skip invalid dates
            continue
    
    if recent_repairs_count >= 3:
        lcc_remarks.append('High Recent Repair Activity')
        risk_level = 'High'
        recommend_replacement = True

    if not lcc_remarks:
        lcc_remarks.append('Operational - Within Parameters')
        risk_level = 'Low'

    return {
        "equipment_id": str(formatted_equipment["_id"]),
        "equipment_name": formatted_equipment["name"],
        "item_code": formatted_equipment["itemCode"],
        "purchase_price": purchase_price,
        "useful_life_years": useful_life,
        "age_in_years": round(age_in_years, 2),
        "total_repairs": total_repairs,
        "total_repair_cost": round(total_repair_cost, 2),
        "average_repair_cost_per_repair": round(average_repair_cost, 2),
        "repair_frequency_per_year": round(repair_frequency, 2),
        "total_cost_of_ownership": round(total_cost_of_ownership, 2),
        "cost_ratio_to_purchase_price_percent": round(cost_ratio, 2),
        "lcc_remarks": lcc_remarks,
        "risk_level": risk_level,
        "recommend_replacement": recommend_replacement,
        "analysis_date": current_date.isoformat()
    }
