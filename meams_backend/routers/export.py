"""
Export router - handles data export functionality
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import zipfile
import io
import base64

from services.auth_service import verify_token
from services.log_service import create_log_entry
from database import (
    get_supplies_collection,
    get_equipment_collection,
    get_accounts_collection,
    get_logs_collection
)
from services.supply_service import supply_helper
from services.equipment_service import equipment_helper
from dependencies import get_current_user

router = APIRouter(prefix="/api/export", tags=["export"])

def escape_csv_field(field):
    """Escape CSV field for proper formatting"""
    field = str(field).replace('"', '""')
    if ',' in field or '"' in field or '\n' in field:
        field = f'"{field}"'
    return field

@router.get("/supplies")
async def export_supplies(token: str = Depends(get_current_user)):
    """Export supplies data as CSV"""
    payload = verify_token(token)
    username = payload["username"]
    
    collection = get_supplies_collection()
    supplies = list(collection.find())
    
    if not supplies:
        csv_data = "name,description,category,quantity,supplier,location,status,itemCode,date\n"
        filename = f"supplies_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return {
            "success": True,
            "message": "No supplies data found",
            "data": [],
            "csv_data": csv_data,
            "filename": filename
        }
    
    csv_rows = ["name,description,category,quantity,supplier,location,status,itemCode,date"]
    
    for supply in supplies:
        row_data = [
            str(supply.get('name', '')),
            str(supply.get('description', '')),
            str(supply.get('category', '')),
            str(supply.get('quantity', 0)),
            str(supply.get('supplier', '')),
            str(supply.get('location', '')),
            str(supply.get('status', 'available')),
            str(supply.get('itemCode', '')),
            str(supply.get('date', ''))
        ]
        
        escaped_row = [escape_csv_field(field) for field in row_data]
        csv_rows.append(','.join(escaped_row))
    
    csv_data = '\n'.join(csv_rows)
    filename = f"supplies_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    await create_log_entry(username, "Exported supplies data.", f"Exported {len(supplies)} supplies to CSV", "system")
    
    return {
        "success": True,
        "message": f"Successfully exported {len(supplies)} supplies",
        "data": [supply_helper(supply) for supply in supplies],
        "csv_data": csv_data,
        "filename": filename
    }

@router.get("/equipment")
async def export_equipment(token: str = Depends(get_current_user)):
    """Export equipment data as CSV"""
    payload = verify_token(token)
    username = payload["username"]
    
    collection = get_equipment_collection()
    equipment_list = list(collection.find())
    
    if not equipment_list:
        csv_data = "name,description,category,quantity,usefulLife,amount,location,status,itemCode,supplier,date\n"
        filename = f"equipment_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return {
            "success": True,
            "message": "No equipment data found",
            "data": [],
            "csv_data": csv_data,
            "filename": filename
        }
    
    csv_rows = ["name,description,category,quantity,usefulLife,amount,location,status,itemCode,supplier,date"]
    
    for equipment in equipment_list:
        row_data = [
            str(equipment.get('name', '')),
            str(equipment.get('description', '')),
            str(equipment.get('category', '')),
            str(equipment.get('quantity', 1)),
            str(equipment.get('usefulLife', 1)),
            str(equipment.get('amount', 0.0)),
            str(equipment.get('location', '')),
            str(equipment.get('status', 'Operational')),
            str(equipment.get('itemCode', '')),
            str(equipment.get('supplier', '')),
            str(equipment.get('date', ''))
        ]
        
        escaped_row = [escape_csv_field(field) for field in row_data]
        csv_rows.append(','.join(escaped_row))
    
    csv_data = '\n'.join(csv_rows)
    filename = f"equipment_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    await create_log_entry(username, "Exported equipment data.", f"Exported {len(equipment_list)} equipment items to CSV", "system")
    
    return {
        "success": True,
        "message": f"Successfully exported {len(equipment_list)} equipment items",
        "data": [equipment_helper(equipment) for equipment in equipment_list],
        "csv_data": csv_data,
        "filename": filename
    }

@router.get("/accounts")
async def export_accounts(token: str = Depends(get_current_user)):
    """Export user accounts data as CSV - admin only"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    collection = get_accounts_collection()
    accounts = list(collection.find())
    
    if not accounts:
        csv_data = "name,username,email,role,department,position,phone_number,status,account_creation,last_login\n"
        filename = f"accounts_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return {
            "success": True,
            "message": "No accounts data found",
            "data": [],
            "csv_data": csv_data,
            "filename": filename
        }
    
    csv_rows = ["name,username,email,role,department,position,phone_number,status,account_creation,last_login"]
    
    for account in accounts:
        row_data = [
            str(account.get('name', '')),
            str(account.get('username', '')),
            str(account.get('email', '')),
            str(account.get('role', 'staff')),
            str(account.get('department', '')),
            str(account.get('position', '')),
            str(account.get('phone_number', '')),
            str(account.get('status', True)),
            str(account.get('account_creation', '')),
            str(account.get('last_login', 'Never'))
        ]
        
        escaped_row = [escape_csv_field(field) for field in row_data]
        csv_rows.append(','.join(escaped_row))
    
    csv_data = '\n'.join(csv_rows)
    filename = f"accounts_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    await create_log_entry(username, "Exported accounts data.", f"Exported {len(accounts)} user accounts to CSV", "system")
    
    from routers.accounts import account_helper
    return {
        "success": True,
        "message": f"Successfully exported {len(accounts)} accounts",
        "data": [account_helper(account) for account in accounts],
        "csv_data": csv_data,
        "filename": filename
    }

@router.get("/all")
async def export_all_data(token: str = Depends(get_current_user)):
    """Export all system data as ZIP - admin only"""
    payload = verify_token(token)
    user_role = payload.get("role", "staff")
    username = payload["username"]
    
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Export supplies
        supplies = list(get_supplies_collection().find())
        if supplies:
            supplies_csv = "name,description,category,quantity,supplier,location,status,itemCode,date\n"
            for supply in supplies:
                row_data = [
                    str(supply.get('name', '')),
                    str(supply.get('description', '')),
                    str(supply.get('category', '')),
                    str(supply.get('quantity', 0)),
                    str(supply.get('supplier', '')),
                    str(supply.get('location', '')),
                    str(supply.get('status', 'available')),
                    str(supply.get('itemCode', '')),
                    str(supply.get('date', ''))
                ]
                escaped_row = [escape_csv_field(field) for field in row_data]
                supplies_csv += ','.join(escaped_row) + '\n'
            
            zip_file.writestr('supplies.csv', supplies_csv)
        
        # Export equipment
        equipment_list = list(get_equipment_collection().find())
        if equipment_list:
            equipment_csv = "name,description,category,quantity,usefulLife,amount,location,status,itemCode,supplier,date\n"
            for equipment in equipment_list:
                row_data = [
                    str(equipment.get('name', '')),
                    str(equipment.get('description', '')),
                    str(equipment.get('category', '')),
                    str(equipment.get('quantity', 1)),
                    str(equipment.get('usefulLife', 1)),
                    str(equipment.get('amount', 0.0)),
                    str(equipment.get('location', '')),
                    str(equipment.get('status', 'Operational')),
                    str(equipment.get('itemCode', '')),
                    str(equipment.get('supplier', '')),
                    str(equipment.get('date', ''))
                ]
                escaped_row = [escape_csv_field(field) for field in row_data]
                equipment_csv += ','.join(escaped_row) + '\n'
            
            zip_file.writestr('equipment.csv', equipment_csv)
        
        # Export accounts
        accounts = list(get_accounts_collection().find())
        if accounts:
            accounts_csv = "name,username,email,role,department,position,phone_number,status,account_creation,last_login\n"
            for account in accounts:
                row_data = [
                    str(account.get('name', '')),
                    str(account.get('username', '')),
                    str(account.get('email', '')),
                    str(account.get('role', 'staff')),
                    str(account.get('department', '')),
                    str(account.get('position', '')),
                    str(account.get('phone_number', '')),
                    str(account.get('status', True)),
                    str(account.get('account_creation', '')),
                    str(account.get('last_login', 'Never'))
                ]
                escaped_row = [escape_csv_field(field) for field in row_data]
                accounts_csv += ','.join(escaped_row) + '\n'
            
            zip_file.writestr('accounts.csv', accounts_csv)
    
    zip_buffer.seek(0)
    zip_data = base64.b64encode(zip_buffer.getvalue()).decode('utf-8')
    
    filename = f"meams_all_data_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"
    
    await create_log_entry(
        username,
        "Exported all system data.",
        f"Exported complete system data (supplies: {len(supplies)}, equipment: {len(equipment_list)}, accounts: {len(accounts)})",
        "system"
    )
    
    return {
        "success": True,
        "message": "Successfully exported all data",
        "zip_data": zip_data,
        "filename": filename,
        "summary": {
            "supplies_count": len(supplies),
            "equipment_count": len(equipment_list),
            "accounts_count": len(accounts)
        }
    }