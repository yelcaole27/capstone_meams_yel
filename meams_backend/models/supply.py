from pydantic import BaseModel
from typing import Optional

class SupplyCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: str
    quantity: int
    supplier: Optional[str] = ""
    location: Optional[str] = ""
    status: Optional[str] = "available"
    itemCode: Optional[str] = ""
    date: Optional[str] = ""
    itemPicture: Optional[str] = None
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None

class SupplyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    supplier: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    itemCode: Optional[str] = None
    date: Optional[str] = None
    image_data: Optional[str] = None
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None