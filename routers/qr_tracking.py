"""
QR Tracking Router - Dynamic QR code system for real-time supply data
Render.com Deployment Ready
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from bson import ObjectId
from datetime import datetime
from database import get_supplies_collection
from services.supply_service import supply_helper
import secrets
import qrcode
from io import BytesIO
import os

router = APIRouter(prefix="/api/qr", tags=["qr-tracking"])

# Get base URL from environment variable (for Render deployment)
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

@router.post("/generate/{supply_id}")
async def generate_qr_tracking_link(supply_id: str):
    """
    Generate a unique tracking ID for QR code.
    This ID stays with the supply forever - printed QR never changes.
    """
    collection = get_supplies_collection()
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID")
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    # Check if QR tracking ID already exists
    existing_tracking_id = supply.get("qr_tracking_id")
    
    if existing_tracking_id:
        # Return existing tracking ID
        tracking_id = existing_tracking_id
        print(f"♻️ Reusing existing QR tracking ID: {tracking_id}")
    else:
        # Generate new unique tracking ID
        tracking_id = secrets.token_urlsafe(12)  # Shorter for QR codes
        
        # Save tracking ID to supply (permanent)
        collection.update_one(
            {"_id": ObjectId(supply_id)},
            {
                "$set": {
                    "qr_tracking_id": tracking_id,
                    "qr_generated_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        print(f"✨ Generated new QR tracking ID: {tracking_id}")
    
    # Use environment variable BASE_URL
    tracking_url = f"{BASE_URL}/track/{tracking_id}"
    
    return {
        "success": True,
        "tracking_id": tracking_id,
        "tracking_url": tracking_url,
        "qr_image_url": f"{BASE_URL}/api/qr/image/{supply_id}",
        "message": "QR tracking URL generated. Use qr_image_url to get printable QR code."
    }

@router.get("/image/{supply_id}")
async def generate_qr_image(supply_id: str):
    """
    Generate printable QR code image.
    This creates the actual PNG image you can print and stick on supplies.
    """
    collection = get_supplies_collection()
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID")
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    # Get or generate tracking ID
    tracking_id = supply.get("qr_tracking_id")
    
    if not tracking_id:
        # Generate new tracking ID if doesn't exist
        tracking_id = secrets.token_urlsafe(12)
        collection.update_one(
            {"_id": ObjectId(supply_id)},
            {
                "$set": {
                    "qr_tracking_id": tracking_id,
                    "qr_generated_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    # Create tracking URL
    tracking_url = f"{BASE_URL}/track/{tracking_id}"
    
    # Generate QR code image
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(tracking_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to bytes
    buf = BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")

@router.get("/track/{tracking_id}")
async def track_and_display(tracking_id: str, request: Request):
    """
    When QR code is scanned, this endpoint:
    1. Finds the supply by tracking_id
    2. Gets REAL-TIME current data from database
    3. Displays live stock card with current quantity
    """
    collection = get_supplies_collection()
    
    # Find supply by tracking ID
    supply = collection.find_one({"qr_tracking_id": tracking_id})
    
    if not supply:
        return HTMLResponse(
            content="""
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Invalid QR Code</title>
                </head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1 style="color: #dc2626;">❌ Invalid QR Code</h1>
                    <p>This QR code is not registered in the system.</p>
                </body>
            </html>
            """,
            status_code=404
        )
    
    # Get REAL-TIME supply data
    supply_data = supply_helper(supply)
    
    # Generate real-time stock card HTML
    html_content = generate_realtime_stock_card(supply_data)
    
    print(f"📱 QR Scanned! Supply: {supply_data['name']}, Current Qty: {supply_data['quantity']}")
    
    return HTMLResponse(content=html_content)

def generate_realtime_stock_card(supply: dict) -> str:
    """
    Generate simple text-based stock card with REAL-TIME data
    """
    # Get latest transaction for display
    transactions = supply.get("transactionHistory", [])
    latest_transactions = sorted(
        transactions, 
        key=lambda x: x.get("date", ""), 
        reverse=True
    )[:10]  # Show last 10 transactions
    
    # Build transaction rows
    transaction_rows = ""
    if latest_transactions:
        for trans in latest_transactions:
            transaction_rows += f"""
            <tr>
                <td>{trans.get('date', '')}</td>
                <td>{trans.get('receipt', '') or ''}</td>
                <td>{trans.get('issue', '') or ''}</td>
                <td><strong>{trans.get('balance', '')}</strong></td>
            </tr>
            """
    else:
        # If no transaction history, show current quantity
        transaction_rows = f"""
        <tr>
            <td>{supply.get('date', '')}</td>
            <td>{supply.get('quantity', 0)}</td>
            <td></td>
            <td><strong>{supply.get('quantity', 0)}</strong></td>
        </tr>
        """
    
    # Get current timestamp
    current_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="30">
        <title>Stock Card - {supply.get('name', 'N/A')}</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                padding: 15px;
                margin: 0;
                background: white;
                font-size: 12px;
                max-width: 800px;
                margin: 0 auto;
            }}
            .live {{
                background: #ffeb3b;
                color: #333;
                text-align: center;
                padding: 8px;
                font-weight: bold;
                margin-bottom: 15px;
                border: 2px solid #fbc02d;
                border-radius: 4px;
            }}
            h1 {{
                font-size: 18px;
                text-align: center;
                margin: 10px 0 5px 0;
            }}
            h2 {{
                font-size: 16px;
                text-align: center;
                margin: 5px 0 15px 0;
                font-weight: normal;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 10px 0;
            }}
            td, th {{
                border: 1px solid #000;
                padding: 8px;
                text-align: left;
            }}
            th {{
                background: #f0f0f0;
                text-align: center;
                font-weight: bold;
            }}
            .info-table td:nth-child(odd) {{
                background: #f5f5f5;
                font-weight: bold;
                width: 120px;
            }}
            .time {{
                text-align: center;
                font-size: 11px;
                color: #666;
                margin-top: 15px;
                padding: 8px;
                background: #f5f5f5;
                border-top: 2px solid #333;
            }}
        </style>
    </head>
    <body>
        <div class="live">🔴 LIVE DATA - Auto-refreshing every 30 seconds</div>
        
        <h1>Universidad De Manila</h1>
        <h2>Stock Card</h2>
        
        <table class="info-table">
            <tr>
                <td>Item:</td>
                <td>{supply.get('name', 'N/A')}</td>
                <td>Stock No.:</td>
                <td>{supply.get('supplier', 'N/A')}</td>
            </tr>
            <tr>
                <td>Category:</td>
                <td>{supply.get('category', 'N/A')}</td>
                <td>Description:</td>
                <td>{supply.get('description', 'N/A')}</td>
            </tr>
            <tr>
                <td>Location:</td>
                <td>{supply.get('location', 'N/A')}</td>
                <td>Unit:</td>
                <td>{supply.get('unit', 'piece')}</td>
            </tr>
            <tr>
                <td>Status:</td>
                <td>{supply.get('status', 'N/A')}</td>
                <td>Current Qty:</td>
                <td><strong style="font-size: 14px;">{supply.get('quantity', 0)} {supply.get('unit', 'units')}</strong></td>
            </tr>
        </table>
        
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Receipt</th>
                    <th>Issue</th>
                    <th>Balance</th>
                </tr>
            </thead>
            <tbody>
                {transaction_rows}
            </tbody>
        </table>
        
        <div class="time">
            Last Updated: {current_time} UTC | Auto-refresh: 30 seconds
        </div>
    </body>
    </html>
    """
    
    return html

# Optional: Get tracking info for a supply
@router.get("/info/{supply_id}")
async def get_qr_tracking_info(supply_id: str):
    """Get QR tracking information for a supply"""
    collection = get_supplies_collection()
    
    if not ObjectId.is_valid(supply_id):
        raise HTTPException(status_code=400, detail="Invalid supply ID")
    
    supply = collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    tracking_id = supply.get("qr_tracking_id")
    
    if not tracking_id:
        return {
            "success": False,
            "message": "No QR code generated for this supply yet"
        }
    
    tracking_url = f"{BASE_URL}/track/{tracking_id}"
    
    return {
        "success": True,
        "supply_id": str(supply["_id"]),
        "supply_name": supply.get("name"),
        "tracking_id": tracking_id,
        "tracking_url": tracking_url,
        "qr_image_url": f"{BASE_URL}/api/qr/image/{supply_id}",
        "generated_at": supply.get("qr_generated_at")
    }