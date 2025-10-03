"""
Supplies router - handles all supply-related endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from bson import ObjectId
from typing import Optional
import base64

from models.supply import SupplyCreate, SupplyUpdate
from services.supply_service import (
    get_all_supplies,
    create_supply,
    get_supply_by_id,
    update_supply,
    delete_supply,
    add_supply_image,
    get_supply_image,
    delete_supply_image
)
from services.auth_service import verify_token
from services.log_service import create_log_entry
from dependencies import get_current_user

router = APIRouter(prefix="/api/supplies", tags=["supplies"])

@router.get("")
async def list_supplies(token: str = Depends(get_current_user)):
    """Get all supplies"""
    supplies = get_all_supplies()
    return {"success": True, "message": f"Found {len(supplies)} supplies", "data": supplies}

@router.post("")
async def add_new_supply(
    supply: SupplyCreate,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Add a new supply"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    created_supply = create_supply(supply.dict(exclude_none=False))
    
    await create_log_entry(
        username,
        "Added a supply." + (" (with image)" if supply.itemPicture else ""),
        f"Added supply: {created_supply['name']} ({created_supply['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Supply added successfully", "data": created_supply}

@router.get("/{supply_id}")
async def get_single_supply(supply_id: str, token: str = Depends(get_current_user)):
    """Get a specific supply by ID"""
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    supply = get_supply_by_id(supply_id)
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    return {"success": True, "message": "Supply found", "data": supply}

@router.put("/{supply_id}")
async def update_existing_supply(
    supply_id: str,
    supply_update: SupplyUpdate,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Update a supply"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    updated_supply = update_supply(supply_id, supply_update.dict(exclude_none=True))
    
    await create_log_entry(
        username,
        "Updated a supply.",
        f"Updated supply: {updated_supply['name']} ({updated_supply['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Supply updated successfully", "data": updated_supply}

@router.delete("/{supply_id}")
async def remove_supply(
    supply_id: str,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Delete a supply"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    deleted_supply = delete_supply(supply_id)
    
    await create_log_entry(
        username,
        "Deleted a supply.",
        f"Deleted supply: {deleted_supply['name']} ({deleted_supply['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Supply deleted successfully"}

@router.post("/{supply_id}/image")
async def upload_image(
    supply_id: str,
    image: UploadFile = File(...),
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Upload image for supply"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    updated_supply = await add_supply_image(supply_id, image)
    
    await create_log_entry(
        username,
        "Uploaded supply image.",
        f"Uploaded image for supply: {updated_supply['name']} ({updated_supply['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Image uploaded successfully", "data": updated_supply}

@router.get("/{supply_id}/image")
async def get_image(supply_id: str, token: str = Depends(get_current_user)):
    """Get supply image"""
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    return get_supply_image(supply_id)

@router.delete("/{supply_id}/image")
async def remove_image(
    supply_id: str,
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Delete supply image"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    updated_supply = delete_supply_image(supply_id)
    
    await create_log_entry(
        username,
        "Deleted supply image.",
        f"Deleted image for supply: {updated_supply['name']} ({updated_supply['itemCode']})",
        client_ip
    )
    
    return {"success": True, "message": "Image deleted successfully", "data": updated_supply}