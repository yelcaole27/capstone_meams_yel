"""
Equipment router - handles all equipment-related endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Body
from bson import ObjectId
from typing import Optional
from datetime import datetime
from database import get_equipment_collection
from services.equipment_service import equipment_helper
from models.equipment import EquipmentCreate, EquipmentUpdate
from services.equipment_service import (
    get_all_equipment,
    create_equipment,
    get_equipment_by_id,
    update_equipment,
    delete_equipment,
    add_equipment_image,
    update_equipment_repair,
    add_equipment_document,
    get_equipment_documents,
    get_equipment_document,
    delete_equipment_document
)

from services.auth_service import verify_token
from services.log_service import create_log_entry
from dependencies import get_current_user

router = APIRouter(prefix="/api/equipment", tags=["equipment"])

@router.get("")
async def list_equipment(token: str = Depends(get_current_user)):
    """Get all equipment"""
    verify_token(token)
    equipment_list = get_all_equipment()
    return {"success": True, "message": f"Found {len(equipment_list)} equipment items", "data": equipment_list}

@router.post("")
async def add_new_equipment(
    equipment: EquipmentCreate = Body(...),
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Add new equipment"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    created_equipment = create_equipment(equipment.dict())
    
    await create_log_entry(
        username,
        "Added equipment.",
        f"Added equipment: {created_equipment['name']} ({created_equipment['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Equipment added successfully", "data": created_equipment}

@router.get("/{equipment_id}")
async def get_single_equipment(equipment_id: str, token: str = Depends(get_current_user)):
    """Get a specific equipment by ID"""
    verify_token(token)
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    equipment = get_equipment_by_id(equipment_id)
    return {"success": True, "message": "Equipment found", "data": equipment}

@router.put("/{equipment_id}")
async def update_existing_equipment(
    equipment_id: str,
    equipment_update: EquipmentUpdate,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Update equipment"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    updated_equipment = update_equipment(equipment_id, equipment_update.dict(exclude_none=True))
    
    await create_log_entry(
        username,
        "Updated equipment.",
        f"Updated equipment: {updated_equipment['name']} ({updated_equipment['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Equipment updated successfully", "data": updated_equipment}

@router.delete("/{equipment_id}")
async def remove_equipment(
    equipment_id: str,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Delete equipment"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    deleted_equipment = delete_equipment(equipment_id)
    
    await create_log_entry(
        username,
        "Deleted equipment.",
        f"Deleted equipment: {deleted_equipment['name']} ({deleted_equipment['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Equipment deleted successfully"}

@router.post("/{equipment_id}/image")
async def upload_image(
    equipment_id: str,
    image: UploadFile = File(...),
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Upload image for equipment"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    updated_equipment = await add_equipment_image(equipment_id, image)
    
    await create_log_entry(
        username,
        "Uploaded equipment image.",
        f"Uploaded image for equipment: {updated_equipment['name']} ({updated_equipment['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Image uploaded successfully", "data": updated_equipment}

@router.put("/{equipment_id}/report")
async def add_equipment_report(
    equipment_id: str,
    report_data: dict,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Add repair report to equipment"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    # Validate equipment ID
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID")
    
    # Validate required fields
    if not report_data.get("reportDate"):
        raise HTTPException(status_code=400, detail="Report date is required")
    
    if not report_data.get("reportDetails") or not report_data.get("reportDetails").strip():
        raise HTTPException(status_code=400, detail="Report details are required")
    
    collection = get_equipment_collection()
    
    # Check if equipment exists
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    # Update equipment with report data and set status to Maintenance
    update_result = collection.update_one(
        {"_id": ObjectId(equipment_id)},
        {
            "$set": {
                "reportDate": report_data.get("reportDate"),
                "reportDetails": report_data.get("reportDetails").strip(),
                "status": "Maintenance",
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Check if update was successful
    if update_result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update equipment with report")
    
    # Retrieve the updated equipment
    updated_equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    
    if not updated_equipment:
        raise HTTPException(status_code=404, detail="Equipment not found after update")
    
    # Log the action
    await create_log_entry(
        username,
        "Added repair report.",
        f"Added repair report for equipment: {updated_equipment['name']} ({updated_equipment['itemCode']}) - Details: {report_data.get('reportDetails')[:50]}...",
        client_ip
    )
    
    # Return formatted equipment data
    formatted_equipment = equipment_helper(updated_equipment)
    
    print(f"✅ Report added successfully for equipment {equipment_id}")
    print(f"   Report Date: {formatted_equipment.get('reportDate')}")
    print(f"   Report Details: {formatted_equipment.get('reportDetails')[:50]}...")
    print(f"   Status: {formatted_equipment.get('status')}")
    
    return {
        "success": True,
        "message": "Repair report added successfully",
        "data": formatted_equipment
    }

@router.put("/{equipment_id}/repair")
async def update_equipment_repair_route(
    equipment_id: str,
    repair_data: dict,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Update equipment with repair information"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID")
    
    updated_equipment = update_equipment_repair(equipment_id, repair_data)
    
    await create_log_entry(
        username,
        "Completed equipment repair.",
        f"Completed repair for equipment: {updated_equipment['name']} ({updated_equipment['itemCode']}) - Amount: ₱{repair_data.get('amountUsed')}",
        client_ip
    )
    
    return {
        "success": True,
        "message": "Equipment repair completed successfully",
        "data": updated_equipment
    }

# DOCUMENT ENDPOINTS

@router.post("/{equipment_id}/documents")
async def upload_document(
    equipment_id: str,
    file: UploadFile = File(...),
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Upload document for equipment"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    updated_equipment = await add_equipment_document(equipment_id, file)
    
    await create_log_entry(
        username,
        "Uploaded equipment document.",
        f"Uploaded document '{file.filename}' for equipment: {updated_equipment['name']} ({updated_equipment['itemCode']})",
        client_ip
    )
    
    return {
        "success": True, 
        "message": f"Document '{file.filename}' uploaded successfully",
        "data": updated_equipment
    }

@router.get("/{equipment_id}/documents")
async def list_documents(equipment_id: str, token: str = Depends(get_current_user)):
    """Get all documents for equipment"""
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    documents = get_equipment_documents(equipment_id)
    
    return {
        "success": True,
        "message": f"Found {len(documents)} documents",
        "data": documents
    }

@router.get("/{equipment_id}/documents/{document_index}")
async def download_document(
    equipment_id: str, 
    document_index: int,
    token: str = Depends(get_current_user)
):
    """Download a specific document"""
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    return get_equipment_document(equipment_id, document_index)

@router.delete("/{equipment_id}/documents/{document_index}")
async def remove_document(
    equipment_id: str,
    document_index: int,
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Delete a specific document"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    updated_equipment = delete_equipment_document(equipment_id, document_index)
    
    await create_log_entry(
        username,
        "Deleted equipment document.",
        f"Deleted document for equipment: {updated_equipment['name']} ({updated_equipment['itemCode']})",
        client_ip
    )
    
    return {
        "success": True,
        "message": "Document deleted successfully",
        "data": updated_equipment
    }
