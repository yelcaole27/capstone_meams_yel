"""
User/Account models - Pydantic models for user validation
"""
from pydantic import BaseModel, EmailStr
from typing import Optional

class AccountCreate(BaseModel):
    name: str
    username: str
    email: EmailStr
    role: Optional[str] = "staff"
    department: Optional[str] = "Operations"
    position: Optional[str] = "Staff Member"
    phone_number: Optional[str] = ""

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[bool] = None

class ProfileUpdate(BaseModel):
    email: Optional[str] = None
    fullName: Optional[str] = None
    department: Optional[str] = None
    phoneNumber: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class BugReport(BaseModel):
    message: str
    username: str = "unknown_user"
    role: str = "unknown_role"