"""
Equipment router - handles all equipment-related endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from bson import ObjectId
from typing import Optional
from typing import Optional
from fastapi import Header
import asyncio
import json
from datetime import datetime
from fastapi.responses import HTMLResponse
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
    delete_equipment_document,
    calculate_lcc_analysis,
)

from services.auth_service import verify_token
from services.log_service import create_log_entry
from dependencies import get_current_user

router = APIRouter(prefix="/api/equipment", tags=["equipment"])

# Store for scan events (in production, use Redis or similar)
scan_events = {}

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

# NEW: QR Code Scan Endpoint
@router.get("/scan/{equipment_id}")
async def scan_equipment(equipment_id: str):
    """
    Endpoint called when a QR code is scanned.
    Returns current equipment data and triggers real-time notifications.
    """
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    try:
        # Fetch current equipment data
        equipment = get_equipment_by_id(equipment_id)
        
        # Create scan event data
        scan_data = {
            "equipment_id": equipment["_id"],
            "equipment_name": equipment["name"],
            "item_code": equipment["itemCode"],
            "category": equipment["category"],
            "status": equipment["status"],
            "location": equipment.get("location", "N/A"),
            "amount": equipment.get("amount", 0),
            "useful_life": equipment.get("usefulLife", 0),
            "timestamp": datetime.utcnow().isoformat(),
            "scan_type": "equipment"
        }
        
        # Notify all listeners for this equipment
        if equipment_id in scan_events:
            for queue in scan_events[equipment_id]:
                await queue.put(scan_data)
        
        print(f"📱 QR Code scanned for equipment: {equipment['name']} ({equipment['itemCode']})")
        
        return {
            "success": True,
            "message": "Equipment scanned successfully",
            "data": scan_data
        }
        
    except Exception as e:
        print(f"❌ Error scanning equipment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# NEW: Real-time Scan Listener Endpoint (Server-Sent Events)
@router.get("/listen/{equipment_id}")
async def listen_for_scans(equipment_id: str):
    """
    Server-Sent Events endpoint for real-time scan notifications.
    Frontend connects to this to receive live scan events.
    """
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    async def event_generator():
        # Create a queue for this listener
        queue = asyncio.Queue()
        
        # Register this listener
        if equipment_id not in scan_events:
            scan_events[equipment_id] = []
        scan_events[equipment_id].append(queue)
        
        try:
            print(f"👂 New listener connected for equipment {equipment_id}")
            
            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connected', 'equipment_id': equipment_id})}\n\n"
            
            # Keep connection alive and send events
            while True:
                try:
                    # Wait for scan event (with timeout to keep connection alive)
                    scan_data = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(scan_data)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f": keepalive\n\n"
                    
        except asyncio.CancelledError:
            print(f"👋 Listener disconnected for equipment {equipment_id}")
        finally:
            # Clean up
            if equipment_id in scan_events:
                scan_events[equipment_id].remove(queue)
                if not scan_events[equipment_id]:
                    del scan_events[equipment_id]
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

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
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID")
    
    if not report_data.get("reportDate"):
        raise HTTPException(status_code=400, detail="Report date is required")
    
    if not report_data.get("reportDetails") or not report_data.get("reportDetails").strip():
        raise HTTPException(status_code=400, detail="Report details are required")
    
    collection = get_equipment_collection()
    
    equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
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
    
    if update_result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update equipment with report")
    
    updated_equipment = collection.find_one({"_id": ObjectId(equipment_id)})
    
    if not updated_equipment:
        raise HTTPException(status_code=404, detail="Equipment not found after update")
    
    await create_log_entry(
        username,
        "Added repair report.",
        f"Added repair report for equipment: {updated_equipment['name']} ({updated_equipment['itemCode']}) - Details: {report_data.get('reportDetails')[:50]}...",
        client_ip
    )
    
    formatted_equipment = equipment_helper(updated_equipment)
    
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

@router.get("/{equipment_id}/lcc-analysis")
async def get_lcc_analysis(
    equipment_id: str,
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Get Life Cycle Cost analysis for equipment"""
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID format")
    
    lcc_data = calculate_lcc_analysis(equipment_id)
    
    await create_log_entry(
        username,
        "Viewed LCC analysis.",
        f"Viewed LCC analysis for equipment: {lcc_data['equipment_name']} - Risk Level: {lcc_data['risk_level']}",
        client_ip
    )
    
    return {
        "success": True,
        "message": "LCC analysis calculated successfully",
        "data": lcc_data
    }

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


@router.get("/view/{equipment_id}", response_class=HTMLResponse)  
async def view_equipment_qr(equipment_id: str, authorization: Optional[str] = Header(None), show_full: bool = False):
    """
    Handle QR code scan - NOW REQUIRES AUTHENTICATION
    """
    from fastapi.responses import HTMLResponse
    from datetime import datetime
    
    # Check for authorization
    if not authorization:
        return HTMLResponse(
            content=generate_auth_required_html("equipment", equipment_id),
            status_code=200
        )
    
    # Verify token
    try:
        token = authorization.replace("Bearer ", "")
        verify_token(token)
    except:
        return HTMLResponse(
            content=generate_auth_required_html("equipment", equipment_id),
            status_code=200
        )
    
    # Validate ID
    if not ObjectId.is_valid(equipment_id):
        return HTMLResponse(
            content="<h1>Invalid QR Code</h1>",
            status_code=400
        )
    
    # Fetch CURRENT data from database
    equipment = get_equipment_by_id(equipment_id)
 
    if not equipment:
        return HTMLResponse(
              content="<h1>Equipment Not Found</h1>",
             status_code=404
    )

    # FIX IMAGE DATA FORMAT FOR QR SCAN PAGE
    if equipment.get('image_data'):
        image_data = equipment['image_data']
        # If it doesn't start with 'data:', add the proper prefix
        if not image_data.startswith('data:'):
           content_type = equipment.get('image_content_type', 'image/jpeg')
           equipment['image_data'] = f"data:{content_type};base64,{image_data}"
        print(f"✅ Image ready for display: {equipment.get('image_filename', 'unknown')}")
    else:
     print(f"⚠️ No image for equipment: {equipment['name']}")


    # Build repair history HTML
    repair_html = ""
    if equipment.get('repairHistory'):
        all_repairs = sorted(equipment['repairHistory'], 
                       key=lambda x: x.get('repairDate', ''), 
                       reverse=True)
        
        # Show only recent 10 or all based on show_full parameter
        repairs_to_show = all_repairs if show_full else all_repairs[:10]
        
        rows = ""
        total_cost = 0
        for repair in repairs_to_show:
            amount = float(repair.get('amountUsed', 0))
            total_cost += amount
            rows += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{repair.get('repairDate', 'N/A')}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{repair.get('repairDetails', '-')}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #059669;">₱{amount:.2f}</td>
            </tr>
            """
        
        # Calculate total for ALL repairs
        total_all_repairs = sum(float(r.get('amountUsed', 0)) for r in all_repairs)
        
        # Show button only if there are more than 10 repairs and not showing full
        view_full_button = ""
        if len(all_repairs) > 10 and not show_full:
            view_full_button = f"""
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="window.location.href='/api/equipment/view/{equipment_id}?show_full=true'" 
                        style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                               color: white; 
                               padding: 12px 30px; 
                               border: none; 
                               border-radius: 8px; 
                               font-size: 16px; 
                               font-weight: 600; 
                               cursor: pointer;
                               box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                               transition: transform 0.2s;">
                    📋 View Full Repair History ({len(all_repairs)} repairs)
                </button>
            </div>
            """
        
        showing_text = f"Showing All {len(all_repairs)} Repairs" if show_full else f"Recent 10 of {len(all_repairs)} Repairs"
        
        repair_html = f"""
        <div style="margin-top: 30px; background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 20px 0; color: #1f2937; border-bottom: 3px solid #667eea; padding-bottom: 10px;">
                📋 Repair History {f'<span style="font-size: 14px; color: #6b7280; font-weight: normal;">({showing_text})</span>' if len(all_repairs) > 10 else ''}
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #4b5563;">Repair Date</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #4b5563;">Details</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600; color: #4b5563;">Amount Used</th>
                    </tr>
                </thead>
                <tbody>
                    {rows}
                </tbody>
                <tfoot>
                    <tr style="background: #f3f4f6; font-weight: bold; border-top: 2px solid #e5e7eb;">
                        <td colspan="2" style="padding: 12px;">Total Repairs: {len(all_repairs)}</td>
                        <td style="padding: 12px; text-align: right; color: #059669;">₱{total_all_repairs:.2f}</td>
                    </tr>
                </tfoot>
            </table>
            {view_full_button}
        </div>
        """
    else:
        repair_html = """
        <div style="margin-top: 30px; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin: 0 auto 15px; opacity: 0.3;">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" stroke-width="2"/>
            </svg>
            <h3 style="margin: 0 0 10px 0; color: #6b7280;">No Repair History</h3>
            <p style="margin: 0; color: #9ca3af; font-size: 14px;">This equipment has not been repaired yet</p>
        </div>
        """
    
    # Return beautiful HTML page
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{equipment['name']} - Equipment Details</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: #363636;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                margin: 0;
            }}
            .container {{
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 900px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 3px solid #fbbf24;
            }}
            .logo {{
                font-size: 72px;
                margin-bottom: 15px;
            }}
            h1 {{
                color: #1f2937;
                margin: 10px 0;
                font-size: 32px;
            }}
            .subtitle {{
                color: #6b7280;
                font-size: 16px;
                margin-top: 5px;
            }}
            .timestamp {{
                background: #3d9130;
                color: white;
                padding: 12px 20px;
                border-radius: 10px;
                text-align: center;
                margin: 20px 0;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(61, 145, 48, 0.4);
            }}
            .info-grid {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin: 30px 0;
            }}
            .info-card {{
                background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
                padding: 20px;
                border-radius: 12px;
                border-left: 4px solid #fbbf24;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: transform 0.2s;
            }}
            .info-card:hover {{
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }}
            .label {{
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                font-weight: 600;
                letter-spacing: 0.5px;
            }}
            .value {{
                font-size: 20px;
                color: #1f2937;
                font-weight: 700;
                margin-top: 8px;
            }}
            .amount {{
                font-size: 36px;
                color: #3d9130;
                font-weight: 800;
            }}
            .status {{
                display: inline-block;
                padding: 8px 20px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                text-transform: uppercase;
            }}
            .status-operational {{ background: #d1fae5; color: #065f46; }}
            .status-maintenance {{ background: #fef3c7; color: #92400e; }}
            .status-beyond {{ background: #fee2e2; color: #991b1b; }}
            .status-within {{ background: #dbeafe; color: #1e40af; }}
            .footer {{
                margin-top: 40px;
                text-align: center;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                color: #9ca3af;
                font-size: 14px;
            }}
            .footer-logo {{
                font-weight: 700;
                color: #3d9130;
                margin-top: 10px;
            }}
            button:hover {{
                transform: translateY(-2px) !important;
            }}
        </style>
    </head>
    <body>
        <div class="container">
        {f'''
<div class="image-container" style="text-align: center; margin: 20px 0;">
    <img src="{equipment.get('image_data', '')}" 
         alt="{equipment['name']}" 
         style="max-width: 70%; max-height: 200px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); object-fit: contain;" />
</div>
''' if equipment.get('image_data') else ''}
            <div class="header">
                <h1>{equipment['name']}</h1>
                <p class="subtitle">MEAMS - Equipment Inventory</p>
            </div>
            
            <div class="timestamp">
                📅 Scanned: {datetime.now().strftime('%B %d, %Y')}
            </div>
            <div class="info-grid">
                <div class="info-card">
                    <div class="label">Item Code</div>
                    <div class="value">{equipment.get('itemCode', 'N/A')}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Category</div>
                    <div class="value">{equipment.get('category', 'N/A')}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Status</div>
                    <div class="value">
                        <span class="status status-{equipment.get('status', 'operational').lower().replace(' ', '-').replace('_', '-')}">
                            {equipment.get('status', 'Operational')}
                        </span>
                    </div>
                </div>
                
                <div class="info-card">
                    <div class="label">Location</div>
                    <div class="value">{equipment.get('location', 'Not specified')}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Purchase Amount</div>
                    <div class="amount">₱{float(equipment.get('amount', 0)):.2f}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Useful Life</div>
                    <div class="value">{equipment.get('usefulLife', 0)} years</div>
                </div>
            </div>
            
            <div class="info-card" style="margin-top: 20px;">
                <div class="label">Description</div>
                <div class="value" style="font-size: 16px; font-weight: 500; line-height: 1.6;">
                    {equipment.get('description', 'No description available')}
                </div>
            </div>
            
            {repair_html}
            
            <div class="footer">
                <p>Equipment ID: {equipment['_id']}</p>
                <p class="footer-logo">Maintenance And Engineering Asset Management System</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@router.post("/verify-scan-access")
async def verify_scan_access(credentials: dict):
    """
    Verify user credentials for QR code access
    Accepts BOTH email OR username with password
    Returns a temporary access token if valid
    """
    from services.auth_service import authenticate_user, create_access_token
    from datetime import timedelta
    from database import get_accounts_collection
    
    identifier = credentials.get('identifier')  # Can be email OR username
    password = credentials.get('password')
    
    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Username/Email and password required")
    
    accounts_collection = get_accounts_collection()
    
    # Try to find user by email OR username
    user_doc = accounts_collection.find_one({
        "$or": [
            {"email": identifier},
            {"username": identifier}
        ]
    })
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get username and authenticate
    username = user_doc.get('username')
    user = authenticate_user(username, password)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if account is active
    if user.get("status") == False:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    # Create temporary access token (valid for 30 minutes)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=timedelta(minutes=30)
    )
    
    return {
        "success": True,
        "access_token": access_token,
        "user": {
            "username": user["username"],
            "role": user["role"]
        }
    }


def generate_auth_required_html(item_type: str, item_id: str) -> str:
    """Generate HTML page that requires authentication"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authentication Required</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                margin: 0;
            }}
            .auth-container {{
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }}
            .logo {{
                text-align: center;
                font-size: 48px;
                margin-bottom: 10px;
            }}
            h2 {{
                text-align: center;
                color: #1f2937;
                margin: 0 0 10px 0;
            }}
            .subtitle {{
                text-align: center;
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 30px;
            }}
            .form-group {{
                margin-bottom: 20px;
            }}
            label {{
                display: block;
                color: #374151;
                font-weight: 600;
                margin-bottom: 8px;
                font-size: 14px;
            }}
            input {{
                width: 100%;
                padding: 12px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-size: 14px;
                transition: border-color 0.3s;
                box-sizing: border-box;
            }}
            input:focus {{
                outline: none;
                border-color: #667eea;
            }}
            .btn {{
                width: 100%;
                padding: 14px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
                margin-top: 10px;
            }}
            .btn:hover {{
                transform: translateY(-2px);
            }}
            .btn:disabled {{
                opacity: 0.6;
                cursor: not-allowed;
            }}
            .error {{
                color: #dc2626;
                font-size: 14px;
                margin-top: 10px;
                text-align: center;
                display: none;
            }}
            .error.show {{
                display: block;
            }}
            .info {{
                background: #dbeafe;
                border-left: 4px solid #3b82f6;
                padding: 12px;
                margin-bottom: 20px;
                border-radius: 4px;
                font-size: 13px;
                color: #1e40af;
            }}
        </style>
    </head>
    <body>
        <div class="auth-container">
            <div class="logo">🔒</div>
            <h2>Authentication Required</h2>
            <p class="subtitle">Please login to view this equipment</p>
            
            <div class="info">
                ℹ️ This content is protected. Enter your MEAMS credentials to continue.
            </div>
            
            <form id="authForm">
                <div class="form-group">
                    <label for="identifier">Username or Email</label>
                    <input 
                        type="text" 
                        id="identifier" 
                        name="identifier" 
                        placeholder="Enter username or email"
                        required
                        autocomplete="username"
                    />
                </div>
                
                <div class="form-group">
                    <label for="password">Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password" 
                        placeholder="Enter your password"
                        required
                        autocomplete="current-password"
                    />
                </div>
                
                <button type="submit" class="btn" id="submitBtn">
                    Access Equipment Information
                </button>
                
                <div class="error" id="errorMsg"></div>
            </form>
        </div>
        
        <script>
            const API_URL = window.location.origin;
            const ITEM_TYPE = '{item_type}';
            const ITEM_ID = '{item_id}';
            
            document.getElementById('authForm').addEventListener('submit', async (e) => {{
                e.preventDefault();
                
                const submitBtn = document.getElementById('submitBtn');
                const errorMsg = document.getElementById('errorMsg');
                const identifier = document.getElementById('identifier').value;
                const password = document.getElementById('password').value;
                
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying...';
                errorMsg.classList.remove('show');
                
                try {{
                    // Step 1: Authenticate and get token
                    const authResponse = await fetch(`${{API_URL}}/api/equipment/verify-scan-access`, {{
                        method: 'POST',
                        headers: {{
                            'Content-Type': 'application/json'
                        }},
                        body: JSON.stringify({{
                            identifier: identifier,
                            password: password
                        }})
                    }});
                    
                    if (!authResponse.ok) {{
                        const errorData = await authResponse.json();
                        throw new Error(errorData.detail || 'Authentication failed');
                    }}
                    
                    const authData = await authResponse.json();
                    
                    // Step 2: Fetch equipment page with token in header
                    const equipmentResponse = await fetch(`${{API_URL}}/api/equipment/view/${{ITEM_ID}}`, {{
                        headers: {{
                            'Authorization': `Bearer ${{authData.access_token}}`
                        }}
                    }});
                    
                    if (!equipmentResponse.ok) {{
                        throw new Error('Failed to load equipment details');
                    }}
                    
                    // Step 3: Replace current page with equipment details
                    const html = await equipmentResponse.text();
                    document.open();
                    document.write(html);
                    document.close();
                    
                }} catch (error) {{
                    console.error('Authentication error:', error);
                    errorMsg.textContent = error.message || 'Invalid credentials';
                    errorMsg.classList.add('show');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Access Equipment Information';
                }}
            }});
        </script>
    </body>
    </html>
    """
