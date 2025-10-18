from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json
import os

router = APIRouter()

# Pydantic models
class BugReportRequest(BaseModel):
    message: str
    username: str
    role: str

class BugReportResponse(BaseModel):
    success: bool
    message: str

# Path to store bug reports (you can change this to database storage later)
REPORTS_FILE = "bug_reports.json"

def load_reports():
    """Load existing bug reports from file"""
    if os.path.exists(REPORTS_FILE):
        try:
            with open(REPORTS_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []

def save_report(report_data):
    """Save bug report to file"""
    reports = load_reports()
    reports.append(report_data)
    with open(REPORTS_FILE, 'w') as f:
        json.dump(reports, f, indent=2)

@router.post("/api/report-bug", response_model=BugReportResponse)
async def report_bug(report: BugReportRequest):
    """
    Endpoint to receive bug reports from users
    """
    try:
        # Create report data
        report_data = {
            "id": len(load_reports()) + 1,
            "username": report.username,
            "role": report.role,
            "message": report.message,
            "timestamp": datetime.now().isoformat(),
            "status": "pending"
        }
        
        # Save report
        save_report(report_data)
        
        # You can also send email notification here if needed
        # send_email_notification(report_data)
        
        return BugReportResponse(
            success=True,
            message="Bug report submitted successfully"
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit bug report: {str(e)}"
        )

@router.get("/api/bug-reports")
async def get_bug_reports():
    """
    Endpoint to retrieve all bug reports (admin only)
    Note: Add authentication/authorization middleware for production
    """
    try:
        reports = load_reports()
        return {
            "success": True,
            "reports": reports,
            "total": len(reports)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve bug reports: {str(e)}"
        )

@router.get("/api/help-guide")
async def get_help_guide():
    """
    Endpoint to get help guide content
    """
    return {
        "success": True,
        "guide": {
            "title": "System User Guide",
            "sections": [
                {
                    "id": 1,
                    "title": "Adding Supply",
                    "steps": [
                        "Navigate to the Supplies section.",
                        "Scroll down to find and click the 'Add Supply' button.",
                        "Complete the required information fields.",
                        "Click Add to save the new supply item."
                    ]
                },
                {
                    "id": 2,
                    "title": "Adding Equipment",
                    "steps": [
                        "Go to the Equipment section.",
                        "Scroll down to locate and click the 'Add Equipment' button.",
                        "Fill in the necessary details about the equipment.",
                        "Click Add to register the new equipment."
                    ]
                },
                {
                    "id": 3,
                    "title": "Updating Supply Quantity",
                    "steps": [
                        "Go to the Supplies section.",
                        "Click the name of the supply you wish to modify.",
                        "Select the 'Update Supply' button.",
                        "Enter the exact new amount (quantity) for the supply and save the changes."
                    ]
                },
                {
                    "id": 4,
                    "title": "Updating Equipment Details",
                    "steps": [
                        "Go to the Equipment section.",
                        "Click the name of the equipment you want to change.",
                        "Select the 'Update Equipment' button.",
                        "Adjust the details (e.g., RepairDate, RepairDetails) as needed and save the changes."
                    ]
                },
                {
                    "id": 5,
                    "title": "Locating the QR Code Generator",
                    "steps": [
                        "Navigate to either the Supplies or Equipment section.",
                        "Click the item name (supply or equipment) for which you need a QR code.",
                        "You will see and click the 'Generate QR Code' button.",
                        "The system will then display the unique QR code for that specific item."
                    ]
                }
            ]
        }
    }

@router.get("/api/about")
async def get_about_info():
    """
    Endpoint to get system information
    """
    return {
        "success": True,
        "about": {
            "name": "Medical Equipment and Supplies Management System",
            "acronym": "MEAMS",
            "version": "1.0.0",
            "lastUpdated": "October 2025",
            "support": "Available 24/7",
            "description": "The Medical Equipment and Supplies Management System (MEAMS) is designed to streamline the management of medical supplies and equipment in healthcare facilities."
        }
    }
