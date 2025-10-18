from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DocumentSchema(BaseModel):
    """Schema for embedded documents"""
    filename: str
    file_data: str  # Base64 encoded
    content_type: str
    file_size: int
    uploaded_at: str

class SupplyCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: str
    quantity: int
    supplier: Optional[str] = ""
    location: Optional[str] = ""
    status: Optional[str] = "available"
    unit: Optional[str] = "piece"
    itemCode: Optional[str] = ""
    date: Optional[str] = ""
    itemPicture: Optional[str] = None
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None
    transactionHistory: Optional[List[dict]] = []
    documents: Optional[List[dict]] = []  # NEW: Document storage
    qr_tracking_id: Optional[str] = None
    qr_generated_at: Optional[datetime] = None

class SupplyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    supplier: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    unit: Optional[str] = None
    itemCode: Optional[str] = None
    date: Optional[str] = None
    image_data: Optional[str] = None
    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None
    transactionHistory: Optional[List[dict]] = None
    documents: Optional[List[dict]] = None  # NEW: Document updates
    qr_tracking_id: Optional[str] = None
    qr_generated_at: Optional[datetime] = None

class DocumentUpload(BaseModel):
    """Schema for document upload"""
    filename: str
    file_data: str  # Base64 encoded
    content_type: str
    file_size: int
