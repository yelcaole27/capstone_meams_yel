"""
Supplies router - handles all supply-related endpoints including documents
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from bson import ObjectId
from fastapi.responses import HTMLResponse
from datetime import datetime
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


@router.get("/scan/{supply_id}", response_class=HTMLResponse)
async def scan_supply_qr(supply_id: str):
    """
    Handle QR code scan - fetches CURRENT data from database
    """
    from fastapi.responses import HTMLResponse
    from datetime import datetime
    
    # Validate ID
    if not ObjectId.is_valid(supply_id):
        return HTMLResponse(
            content="<h1>Invalid QR Code</h1>",
            status_code=400
        )
    
    # Fetch CURRENT data from database
    supply = get_supply_by_id(supply_id)
    
    if not supply:
        return HTMLResponse(
            content="<h1>Item Not Found</h1>",
            status_code=404
        )
    
    # Build transaction history HTML
    transaction_html = ""
    if supply.get('transactionHistory'):
        recent = sorted(supply['transactionHistory'], 
                       key=lambda x: x.get('date', ''), 
                       reverse=True)[:5]
        
        rows = ""
        for trans in recent:
            rows += f"""
            <tr>
                <td>{trans.get('date', 'N/A')}</td>
                <td>{trans.get('receipt') or '-'}</td>
                <td>{trans.get('issue') or '-'}</td>
                <td style="font-weight: 600;">{trans.get('balance', 0)}</td>
            </tr>
            """
        
        transaction_html = f"""
        <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0;">Recent Transactions</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #667eea; color: white;">
                    <th style="padding: 8px; text-align: left;">Date</th>
                    <th style="padding: 8px;">Receipt</th>
                    <th style="padding: 8px;">Issue</th>
                    <th style="padding: 8px;">Balance</th>
                </tr>
                {rows}
            </table>
        </div>
        """
    
    # Return beautiful HTML with CURRENT data
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{supply['name']} - Stock Card</title>
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
            .quantity {{
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
            .status-normal {{ background: #d1fae5; color: #065f46; }}
            .status-understock {{ background: #fee2e2; color: #991b1b; }}
            .status-overstock {{ background: #fef3c7; color: #92400e; }}
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
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">📦</div>
                <h1>{supply['name']}</h1>
                <p class="subtitle">MEAMS - Supply Inventory</p>
            </div>
            
            <div class="timestamp">
                📅 Scanned: {datetime.now().strftime('%B %d, %Y')}
            </div>
            
            {f'''
            <div class="image-container" style="text-align: center; margin: 30px 0;">
            <img src="data:{supply.get('image_content_type', 'image/jpeg')};base64,{supply.get('image_data', '')}" 
            alt="{supply['name']}" 
            style="max-width: 100%; max-height: 400px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); object-fit: contain;" />
            </div>
            ''' if supply.get('image_data') else ''}

            <div class="info-grid">
                <div class="info-card">
                    <div class="label">Item Code</div>
                    <div class="value">{supply.get('itemCode', 'N/A')}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Stock Number</div>
                    <div class="value">{supply.get('supplier', 'N/A')}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Category</div>
                    <div class="value">{supply.get('category', 'N/A')}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Location</div>
                    <div class="value">{supply.get('location', 'Not specified')}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Current Quantity</div>
                    <div class="quantity">{supply.get('quantity', 0)} {supply.get('unit', 'units')}</div>
                </div>
                
                <div class="info-card">
                    <div class="label">Status</div>
                    <div class="value">
                        <span class="status status-{supply.get('status', 'normal').lower()}">
                            {supply.get('status', 'Normal')}
                        </span>
                    </div>
                </div>
            </div>
            
            {transaction_html}
            
            <div class="footer">
                <p>Supply ID: {supply['_id']}</p>
                <p class="footer-logo">Maintenance And Engineering Asset Management System</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@router.get("/scan/{supply_id}", response_class=HTMLResponse)
async def scan_supply_qr(supply_id: str):
    """Handle QR code scan - fetches CURRENT data from database"""
    
    if not ObjectId.is_valid(supply_id):
        return HTMLResponse(content="<h1>Invalid QR Code</h1>", status_code=400)
    
    supply = get_supply_by_id(supply_id)
    
    if not supply:
        return HTMLResponse(content="<h1>Item Not Found</h1>", status_code=404)
    
    # Build transaction history
    transaction_html = ""
    if supply.get('transactionHistory'):
        recent = sorted(supply['transactionHistory'], key=lambda x: x.get('date', ''), reverse=True)[:5]
        rows = ""
        for trans in recent:
            rows += f"<tr><td>{trans.get('date', 'N/A')}</td><td>{trans.get('receipt') or '-'}</td><td>{trans.get('issue') or '-'}</td><td style='font-weight:600;'>{trans.get('balance', 0)}</td></tr>"
        
        transaction_html = f"<div style='margin-top:20px;padding:15px;background:#f9fafb;border-radius:8px;'><h3 style='margin:0 0 10px;'>Recent Transactions</h3><table style='width:100%;border-collapse:collapse;'><tr style='background:#3d9130;color:white;'><th style='padding:8px;'>Date</th><th style='padding:8px;'>Receipt</th><th style='padding:8px;'>Issue</th><th style='padding:8px;'>Balance</th></tr>{rows}</table></div>"
    
    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{supply['name']}</title><style>body{{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;margin:0}}.container{{background:white;border-radius:20px;padding:30px;max-width:600px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}}.header{{text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #e5e7eb}}.logo{{font-size:60px;margin-bottom:10px}}h1{{color:#1f2937;margin:10px 0}}.info-card{{background:#f9fafb;padding:15px;margin:10px 0;border-radius:10px;border-left:4px solid #667eea}}.label{{font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600}}.value{{font-size:18px;color:#1f2937;font-weight:600;margin-top:5px}}.quantity{{font-size:32px;color:#667eea;font-weight:800}}.status{{display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:600}}.status-normal{{background:#d1fae5;color:#065f46}}.status-understock{{background:#fee2e2;color:#991b1b}}.status-overstock{{background:#fef3c7;color:#92400e}}table{{width:100%;border-collapse:collapse;margin-top:10px}}th,td{{padding:8px;border-bottom:1px solid #e5e7eb}}th{{background:#667eea;color:white}}</style></head><body><div class="container"><div class="header"><div class="logo">📦</div><h1>{supply['name']}</h1><p>Universidad De Manila</p></div><div class="info-card"><div class="label">Item Code</div><div class="value">{supply.get('itemCode', 'N/A')}</div></div><div class="info-card"><div class="label">Current Quantity</div><div class="quantity">{supply.get('quantity', 0)} {supply.get('unit', 'units')}</div></div><div class="info-card"><div class="label">Status</div><div class="value"><span class="status status-{supply.get('status', 'normal').lower()}">{supply.get('status', 'Normal')}</span></div></div><div class="info-card"><div class="label">Category</div><div class="value">{supply.get('category', 'N/A')}</div></div><div class="info-card"><div class="label">Location</div><div class="value">{supply.get('location', 'Not specified')}</div></div>{transaction_html}<div style="margin-top:20px;text-align:center;color:#9ca3af;font-size:12px;"><p>Scanned: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p></div></div></body></html>"""
    
    return HTMLResponse(content=html)