"""
Equipment router - handles all equipment-related endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Body
from bson import ObjectId
from typing import Optional

from models.equipment import EquipmentCreate, EquipmentUpdate
from services.equipment_service import (
    get_all_equipment,
    create_equipment,
    get_equipment_by_id,
    update_equipment,
    delete_equipment,
    add_equipment_image
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