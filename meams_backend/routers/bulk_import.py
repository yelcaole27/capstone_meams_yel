"""
========================
OPTIMIZED bulk_import.py
========================
KEY FIX: Lazy import of pandas only when needed
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
import io
import os
from datetime import datetime
from typing import List
from services.auth_service import verify_token
from services.log_service import create_log_entry
from services.supply_service import supply_helper
from services.equipment_service import equipment_helper
from database import get_supplies_collection, get_equipment_collection
from dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["bulk_import"])

def validate_and_transform_supply(item_data: dict, index: int, pd) -> tuple:
    """Validate and transform supply item data"""
    errors = []
    
    # Get item name
    item_name = (
        item_data.get('item_name') or 
        item_data.get('name') or 
        item_data.get('product_name') or 
        ''
    )
    
    if isinstance(item_name, float) and pd.isna(item_name):
        item_name = ''
    else:
        item_name = str(item_name).strip()
    
    if not item_name:
        errors.append(f"Row {index + 1}: Item name is required")
        return None, errors
    
    # Transform quantity
    try:
        quantity = item_data.get('quantity', 0)
        if pd.isna(quantity):
            quantity = 0
        quantity = int(float(quantity))
        if quantity < 0:
            quantity = 0
    except (ValueError, TypeError):
        quantity = 0
    
    # Get category
    category = str(item_data.get('category', 'General')).strip()
    if pd.isna(item_data.get('category')):
        category = 'General'
    
    # Generate item code if not provided
    item_code = item_data.get('itemCode') or item_data.get('item_code', '')
    if pd.isna(item_code) or not str(item_code).strip():
        category_prefix = category[:3].upper()
        random_num = str(abs(hash(f"{item_name}{datetime.utcnow()}")))[:5]
        item_code = f"{category_prefix}-{random_num}"
    
    def clean_string(value):
        return '' if pd.isna(value) else str(value).strip()
    
    transformed_item = {
        "name": item_name,
        "description": clean_string(item_data.get('description', '')),
        "category": category,
        "quantity": quantity,
        "supplier": clean_string(item_data.get('supplier', '')),
        "location": clean_string(item_data.get('location', '')),
        "status": clean_string(item_data.get('status', 'available')).lower(),
        "itemCode": str(item_code),
        "date": clean_string(item_data.get('date_added') or item_data.get('date', '')),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    return transformed_item, errors

def validate_and_transform_equipment(item_data: dict, index: int, pd) -> tuple:
    """Validate and transform equipment item data"""
    errors = []
    
    # Get item name
    item_name = (
        item_data.get('item_name') or 
        item_data.get('name') or 
        item_data.get('description') or 
        ''
    )
    
    if isinstance(item_name, float) and pd.isna(item_name):
        item_name = ''
    else:
        item_name = str(item_name).strip()
    
    if not item_name:
        errors.append(f"Row {index + 1}: Equipment name is required")
        return None, errors
    
    # Transform quantity
    try:
        quantity = item_data.get('quantity', 1)
        quantity = 1 if pd.isna(quantity) else max(1, int(float(quantity)))
    except (ValueError, TypeError):
        quantity = 1
    
    # Transform useful life
    try:
        useful_life = item_data.get('usefulLife') or item_data.get('useful_life', 1)
        useful_life = 1 if pd.isna(useful_life) else max(1, int(float(useful_life)))
    except (ValueError, TypeError):
        useful_life = 1
    
    # Transform amount
    try:
        amount = item_data.get('amount') or item_data.get('unit_price', 0.0)
        amount = 0.0 if pd.isna(amount) else max(0.0, float(amount))
    except (ValueError, TypeError):
        amount = 0.0
    
    # Get category
    category = str(item_data.get('category', 'General')).strip()
    if pd.isna(item_data.get('category')):
        category = 'General'
    
    # Generate item code if not provided
    item_code = item_data.get('itemCode') or item_data.get('item_code', '')
    if pd.isna(item_code) or not str(item_code).strip():
        category_prefix = category[:3].upper()
        random_num = str(abs(hash(f"{item_name}{datetime.utcnow()}")))[:5]
        item_code = f"{category_prefix}-E-{random_num}"
    
    def clean_string(value):
        return '' if pd.isna(value) else str(value).strip()
    
    transformed_item = {
        "name": item_name,
        "description": clean_string(item_data.get('description', item_name)),
        "category": category,
        "quantity": quantity,
        "usefulLife": useful_life,
        "amount": amount,
        "location": clean_string(item_data.get('location', '')),
        "status": clean_string(item_data.get('status', 'Operational')),
        "itemCode": str(item_code),
        "supplier": clean_string(item_data.get('supplier', '')),
        "date": clean_string(item_data.get('date_added') or item_data.get('date', '')),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    return transformed_item, errors

@router.post("/bulk-import")
async def bulk_import(
    file: UploadFile = File(...),
    import_type: str = Form("supplies"),
    request: Request = None,
    token: str = Depends(get_current_user)
):
    """Bulk import supplies or equipment from CSV/Excel file
    
    PERFORMANCE NOTE: Pandas is imported lazily here to avoid blocking app startup
    """
    payload = verify_token(token)
    username = payload["username"]
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    try:
        # 🚀 LAZY IMPORT - Only import pandas when this endpoint is called
        import pandas as pd
        
        # Validate file extension
        allowed_extensions = ['.csv', '.xls', '.xlsx']
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Read file contents
        contents = await file.read()
        
        # Parse file based on extension
        try:
            if file_extension == '.csv':
                df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
            else:
                df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
        
        if df.empty:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        raw_data = df.to_dict('records')
        
        valid_items = []
        all_errors = []
        
        # Validate and transform each row
        for index, item_data in enumerate(raw_data):
            # Skip empty rows
            if all(pd.isna(value) or str(value).strip() == '' for value in item_data.values()):
                continue
            
            if import_type == "supplies":
                transformed_item, errors = validate_and_transform_supply(item_data, index, pd)
            elif import_type == "equipment":
                transformed_item, errors = validate_and_transform_equipment(item_data, index, pd)
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid import_type. Must be 'supplies' or 'equipment'"
                )
            
            if transformed_item:
                valid_items.append(transformed_item)
            all_errors.extend(errors)
        
        if not valid_items:
            raise HTTPException(status_code=400, detail="No valid items found to import")
        
        # Insert items into database
        saved_items = []
        collection = get_supplies_collection() if import_type == "supplies" else get_equipment_collection()
        helper_function = supply_helper if import_type == "supplies" else equipment_helper
        
        for item in valid_items:
            try:
                # Check if item exists by itemCode
                existing_item = collection.find_one({"itemCode": item["itemCode"]})
                
                if existing_item:
                    # Update existing item
                    if import_type == "supplies":
                        # For supplies, increment quantity
                        collection.update_one(
                            {"_id": existing_item["_id"]},
                            {
                                "$inc": {"quantity": item["quantity"]},
                                "$set": {"updated_at": datetime.utcnow()}
                            }
                        )
                    else:
                        # For equipment, update all fields
                        collection.update_one(
                            {"_id": existing_item["_id"]},
                            {"$set": {**item, "updated_at": datetime.utcnow()}}
                        )
                    
                    updated_item = collection.find_one({"_id": existing_item["_id"]})
                    saved_items.append(helper_function(updated_item))
                else:
                    # Insert new item
                    result = collection.insert_one(item)
                    created_item = collection.find_one({"_id": result.inserted_id})
                    saved_items.append(helper_function(created_item))
            except Exception as e:
                print(f"Error saving item: {e}")
        
        await create_log_entry(
            username,
            f"Bulk imported {import_type}.",
            f"Imported {len(saved_items)} {import_type} from file: {file.filename}",
            client_ip
        )
        
        return {
            "success": True,
            "message": f"Successfully imported {len(saved_items)} {import_type} items",
            "imported_count": len(saved_items),
            "error_count": len(all_errors),
            "errors": all_errors,
            "imported_items": saved_items
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
