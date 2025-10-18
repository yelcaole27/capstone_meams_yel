"""
Log models - Pydantic models for log validation
"""
from pydantic import BaseModel
from typing import Optional

class LogsFilter(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    username: Optional[str] = None
    search: Optional[str] = None