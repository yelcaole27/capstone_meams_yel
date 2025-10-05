"""
Equipment models - Pydantic models for equipment validation
"""
from pydantic import BaseModel
from typing import Optional

class EquipmentCreate(BaseModel):
    name: str
    description: str
    category: str
    usefulLife: int
    amount: float
    location: Optional[str] = ""
    status: Optional[str] = "Operational"
    itemCode: Optional[str] = ""
    supplier: Optional[str] = ""
    date: Optional[str] = ""
    image_data: Optional[str] = None
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None

class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    usefulLife: Optional[int] = None
    amount: Optional[float] = None
    location: Optional[str] = None
    status: Optional[str] = None
    itemCode: Optional[str] = None
    supplier: Optional[str] = None
    date: Optional[str] = None
    image_data: Optional[str] = None
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None