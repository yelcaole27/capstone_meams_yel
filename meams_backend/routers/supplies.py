"""
Supplies router - handles all supply-related endpoints including documents
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from bson import ObjectId
from fastapi.responses import HTMLResponse
from datetime import datetime
from typing import Optional
from fastapi import Header
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
    add_supply_document,
    get_supply_documents,
    get_supply_document,
    delete_supply_document
)
from services.auth_service import verify_token
from services.log_service import create_log_entry
from dependencies import get_current_user

router = APIRouter(prefix="/api/supplies", tags=["supplies"])

def pluralize_unit(quantity: int, unit: str) -> str:
    """Pluralize unit based on quantity"""
    if not unit:
        return 'unit' if quantity == 1 else 'units'
    
    if quantity == 1:
        return unit
    
    if unit.endswith('s'):
        return unit
    
    special_plurals = {
        'box': 'boxes',
        'piece': 'pieces',
        'pack': 'packs',
        'bottle': 'bottles',
        'gallon': 'gallons',
        'set': 'sets',
        'roll': 'rolls',
        'bag': 'bags',
        'meter': 'meters',
        'ream': 'reams'
    }
    
    return special_plurals.get(unit.lower(), unit + 's')

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

# DOCUMENT ENDPOINTS

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
async def scan_supply_qr(supply_id: str, authorization: Optional[str] = Header(None)):
    """
    Handle QR code scan - fetches CURRENT data from database
    Shows supply summary with recent 5 transactions
    NOW REQUIRES AUTHENTICATION
    """
    from fastapi.responses import HTMLResponse
    from datetime import datetime
    
    # Check for authorization token
    if not authorization:
        return HTMLResponse(
            content=generate_auth_required_html("supply", supply_id),
            status_code=200
        )
    
    # Verify token
    try:
        token = authorization.replace("Bearer ", "")
        payload = verify_token(token)
    except:
        return HTMLResponse(
            content=generate_auth_required_html("supply", supply_id),
            status_code=200
        )
    
    try:
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
        
        # Ensure required fields exist with defaults
        supply.setdefault('quantity', 0)
        supply.setdefault('unit', 'unit')
        supply.setdefault('name', 'Unknown Item')
        supply.setdefault('itemCode', 'N/A')
        supply.setdefault('category', 'N/A')
        supply.setdefault('location', 'Not specified')
        supply.setdefault('status', 'Normal')
        supply.setdefault('supplier', 'N/A')
        
        # Convert ObjectId to string for display
        supply_id_str = str(supply.get('_id', supply_id))
        
        # Get quantity and unit for pluralization
        qty = supply.get('quantity', 0)
        unit = supply.get('unit', 'unit')
        pluralized_unit = pluralize_unit(qty, unit)
        
        # Build transaction history HTML - SHOW ONLY 5 RECENT
        transaction_html = ""
        if supply.get('transactionHistory'):
            all_transactions = sorted(supply['transactionHistory'], 
                           key=lambda x: x.get('date', ''), 
                           reverse=True)
            recent = all_transactions[:5]  # Only 5
            
            rows = ""
            for trans in recent:
                rows += f"""
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{trans.get('date', 'N/A')}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">{trans.get('receipt') or '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">{trans.get('issue') or '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">{trans.get('balance', 0)}</td>
                </tr>
                """
            
            # Show button if more than 5 transactions
            view_full_button = ""
            if len(all_transactions) > 5:
                view_full_button = f"""
                <div style="text-align: center; margin-top: 20px;">
                    <a href="/api/supplies/stock-card/{supply_id}" style="text-decoration: none;">
                        <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                   color: white; 
                                   padding: 12px 30px; 
                                   border: none; 
                                   border-radius: 8px; 
                                   font-size: 16px; 
                                   font-weight: 600; 
                                   cursor: pointer;
                                   box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                                   transition: transform 0.2s;"
                                onmouseover="this.style.transform='translateY(-2px)'"
                                onmouseout="this.style.transform='translateY(0)'">
                            📊 View Full Stock Card ({len(all_transactions)} transactions)
                        </button>
                    </a>
                </div>
                <script>
                    // Store token for next page
                    sessionStorage.setItem('auth_token', '{token}');
                </script>
                """
            
            transaction_html = f"""
            <div style="margin-top: 20px; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 15px 0; color: #1f2937; border-bottom: 3px solid #667eea; padding-bottom: 10px;">
                    📊 Transaction History {f'<span style="font-size: 14px; color: #6b7280; font-weight: normal;">(Recent 5 of {len(all_transactions)})</span>' if len(all_transactions) > 5 else ''}
                </h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 10px; text-align: left; font-weight: 600; color: #4b5563;">Date</th>
                        <th style="padding: 10px; text-align: center; font-weight: 600; color: #4b5563;">Receipt</th>
                        <th style="padding: 10px; text-align: center; font-weight: 600; color: #4b5563;">Issue</th>
                        <th style="padding: 10px; text-align: center; font-weight: 600; color: #4b5563;">Balance</th>
                    </tr>
                    {rows}
                </table>
                {view_full_button}
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
                    {f'''
    <div class="image-container" style="text-align: center; margin: 20px 0;">
        <img src="{supply.get('image_data', '')}" 
             alt="{supply['name']}" 
             style="max-width: 70%; max-height: 200px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); object-fit: contain;" />
    </div>
    ''' if supply.get('image_data') else ''}
                    <div class="header">
                    <h1>{supply['name']}</h1>
                    <p class="subtitle">MEAMS - Supply Inventory</p>
                </div>
                
                <div class="timestamp">
                    📅 Scanned: {datetime.now().strftime('%B %d, %Y')}
                </div>
                
    
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
                        <div class="quantity">{qty} {pluralized_unit}</div>
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
                    <p>Supply ID: {supply_id_str}</p>
                    <p class="footer-logo">Maintenance And Engineering Asset Management System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return HTMLResponse(content=html)
        
    except Exception as e:
        return HTMLResponse(
            content=f"<h1>Error Loading Supply</h1><p>{str(e)}</p>",
            status_code=500
        )


# NEW ENDPOINT: Full Stock Card Page
@router.get("/stock-card/{supply_id}", response_class=HTMLResponse)
async def view_full_stock_card(supply_id: str):
    """
    Separate page showing FULL stock card (all transactions)
    """
    from fastapi.responses import HTMLResponse
    from datetime import datetime
    
    # Validate ID
    if not ObjectId.is_valid(supply_id):
        return HTMLResponse(
            content="<h1>Invalid Supply ID</h1>",
            status_code=400
        )
    
    # Fetch supply data
    supply = get_supply_by_id(supply_id)
    
    if not supply:
        return HTMLResponse(
            content="<h1>Supply Not Found</h1>",
            status_code=404
        )
    
    # Get quantity and unit
    qty = supply.get('quantity', 0)
    unit = supply.get('unit', 'unit')
    pluralized_unit = pluralize_unit(qty, unit)
    
    # Build FULL transaction table
    transaction_rows = ""
    
    if supply.get('transactionHistory'):
        all_transactions = sorted(supply['transactionHistory'], 
                       key=lambda x: x.get('date', ''), 
                       reverse=True)
        
        for trans in all_transactions:
            transaction_rows += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{trans.get('date', 'N/A')}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">{trans.get('receipt') or '-'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">{trans.get('issue') or '-'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #059669;">{trans.get('balance', 0)}</td>
            </tr>
            """
    else:
        transaction_rows = """
        <tr>
            <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
                No transaction history available
            </td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Full Stock Card - {supply['name']}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: #363636;
                min-height: 100vh;
                padding: 20px;
                margin: 0;
            }}
            .container {{
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 1200px;
                margin: 0 auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 3px solid #667eea;
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
            .back-button {{
                display: inline-block;
                margin-bottom: 20px;
                padding: 10px 20px;
                background: #6b7280;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                transition: background 0.3s;
            }}
            .back-button:hover {{
                background: #4b5563;
            }}
            .info-box {{
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
                display: flex;
                justify-content: space-around;
                flex-wrap: wrap;
                gap: 20px;
            }}
            .info-item {{
                text-align: center;
            }}
            .info-label {{
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                font-weight: 600;
            }}
            .info-value {{
                font-size: 24px;
                color: #1f2937;
                font-weight: 700;
                margin-top: 5px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }}
            thead {{
                background: #f9fafb;
                border-bottom: 2px solid #e5e7eb;
            }}
            th {{
                padding: 12px;
                text-align: left;
                font-weight: 600;
                color: #4b5563;
            }}
            .footer {{
                margin-top: 40px;
                text-align: center;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                color: #9ca3af;
                font-size: 14px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <a href="javascript:history.back()" class="back-button">← Back to Supply</a>
            
            <div class="header">
                <h1>📊 Complete Stock Card</h1>
                <p class="subtitle">{supply['name']} ({supply.get('itemCode', 'N/A')})</p>
            </div>
            
            <div class="info-box">
                <div class="info-item">
                    <div class="info-label">Current Quantity</div>
                    <div class="info-value" style="color: #3d9130;">{qty} {pluralized_unit}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Category</div>
                    <div class="info-value">{supply.get('category', 'N/A')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Location</div>
                    <div class="info-value">{supply.get('location', 'N/A')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Status</div>
                    <div class="info-value">{supply.get('status', 'Normal')}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th style="text-align: center;">Receipt</th>
                        <th style="text-align: center;">Issue</th>
                        <th style="text-align: center;">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    {transaction_rows}
                </tbody>
            </table>
            
            <div class="footer">
                <p>Total Transactions: {len(supply.get('transactionHistory', []))}</p>
                <p>Supply ID: {supply.get('_id')}</p>
                <p style="font-weight: 700; color: #3d9130; margin-top: 10px;">
                    Maintenance And Engineering Asset Management System
                </p>
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
            <p class="subtitle">Please login to view this information</p>
            
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
                    Access Supply Information
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
                    // Authenticate user
                    const authResponse = await fetch(`${{API_URL}}/api/supplies/verify-scan-access`, {{
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
                    
                    // Fetch supply page with token in header
                    const supplyResponse = await fetch(`${{API_URL}}/api/supplies/scan/${{ITEM_ID}}`, {{
                        headers: {{
                            'Authorization': `Bearer ${{authData.access_token}}`
                        }}
                    }});
                    
                    if (!supplyResponse.ok) {{
                        throw new Error('Failed to load supply details');
                    }}
                    
                    // Replace current page with supply details
                    const html = await supplyResponse.text();
                    document.open();
                    document.write(html);
                    document.close();
                    
                }} catch (error) {{
                    console.error('Authentication error:', error);
                    errorMsg.textContent = error.message || 'Invalid credentials';
                    errorMsg.classList.add('show');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Access Supply Information';
                }}
            }});
        </script>
    </body>
    </html>
    """
