"""
Supplies router - handles all supply-related endpoints including documents
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from bson import ObjectId
from models.supply import SupplyCreate, SupplyUpdate
from services.supply_service import (
    get_all_supplies,
    create_supply,
    get_supply_by_id,
    update_supply,
    delete_supply,
    add_supply_image,
    get_supply_image,
    delete_supply_image,
    # NEW: Document functions
    add_supply_document,
    get_supply_documents,
    get_supply_document,
    delete_supply_document
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

# IMAGE ENDPOINTS

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

# NEW: DOCUMENT ENDPOINTS

@router.post("/{supply_id}/documents")
async def upload_document(
    supply_id: str,
    file: UploadFile = File(...),
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Upload document for supply"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    updated_supply = await add_supply_document(supply_id, file)
    
    await create_log_entry(
        username,
        "Uploaded supply document.",
        f"Uploaded document '{file.filename}' for supply: {updated_supply['name']} ({updated_supply['itemCode']})",
        client_ip
    )
    
    return {
        "success": True, 
        "message": f"Document '{file.filename}' uploaded successfully",
        "data": updated_supply
    }

@router.get("/{supply_id}/documents")
async def list_documents(supply_id: str, token: str = Depends(get_current_user)):
    """Get all documents for a supply"""
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    documents = get_supply_documents(supply_id)
    
    return {
        "success": True,
        "message": f"Found {len(documents)} documents",
        "data": documents
    }

@router.get("/{supply_id}/documents/{document_index}")
async def download_document(
    supply_id: str, 
    document_index: int,
    token: str = Depends(get_current_user)
):
    """Download a specific document"""
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    return get_supply_document(supply_id, document_index)

@router.delete("/{supply_id}/documents/{document_index}")
async def remove_document(
    supply_id: str,
    document_index: int,
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Delete a specific document"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID format")
    
    updated_supply = delete_supply_document(supply_id, document_index)
    
    await create_log_entry(
        username,
        "Deleted supply document.",
        f"Deleted document for supply: {updated_supply['name']} ({updated_supply['itemCode']})",
        client_ip
    )
    
    return {
        "success": True,
        "message": "Document deleted successfully",
        "data": updated_supply
    }

