from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import client, DATABASE_NAME
from services.email_service import send_bug_report_notification
import os

router = APIRouter()

# Get bug reports collection
def get_bug_reports_collection():
    """Get bug reports collection from database"""
    db = client[DATABASE_NAME]
    return db['bug_reports']

# Pydantic models
class BugReportRequest(BaseModel):
    message: str
    username: str
    role: str

class BugReportResponse(BaseModel):
    success: bool
    message: str

@router.post("/api/report-bug", response_model=BugReportResponse)
async def report_bug(report: BugReportRequest):
    """
    Endpoint to receive bug reports from users
    Saves to MongoDB database instead of local file
    """
    try:
        collection = get_bug_reports_collection()
        
        # Create report data
        report_data = {
            "username": report.username,
            "role": report.role,
            "message": report.message,
            "timestamp": datetime.utcnow().isoformat(),
            "formatted_timestamp": datetime.utcnow().strftime("%m/%d/%Y - %H:%M:%S"),
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        
        # Save to database
        result = collection.insert_one(report_data)
        report_data['_id'] = str(result.inserted_id)
        
        print(f"✅ Bug report saved to database: {report.username} - {report.message[:50]}...")
        
        # Optional: Send email notification to admin
        admin_email = os.getenv("ADMIN_EMAIL", "meamsds42@gmail.com")
        try:
            await send_bug_report_notification(admin_email, report_data)
            print(f"✅ Admin notification email sent to {admin_email}")
        except Exception as email_error:
            print(f"⚠️ Failed to send admin notification email: {email_error}")
            # Don't fail the whole request if email fails
        
        return BugReportResponse(
            success=True,
            message="Bug report submitted successfully! Our team will review it soon."
        )
    
    except Exception as e:
        print(f"❌ Failed to submit bug report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit bug report: {str(e)}"
        )

@router.get("/api/bug-reports")
async def get_bug_reports(status: Optional[str] = None):
    """
    Endpoint to retrieve bug reports from database
    Optional status filter: 'pending', 'reviewed', 'resolved'
    """
    try:
        collection = get_bug_reports_collection()
        
        # Build query
        query = {}
        if status:
            query["status"] = status
        
        # Get reports sorted by most recent first
        reports = list(collection.find(query).sort("created_at", -1).limit(100))
        
        # Convert ObjectId to string
        for report in reports:
            report['_id'] = str(report['_id'])
        
        return {
            "success": True,
            "reports": reports,
            "total": len(reports),
            "filter": status or "all"
        }
    except Exception as e:
        print(f"❌ Failed to retrieve bug reports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve bug reports: {str(e)}"
        )

@router.patch("/api/bug-reports/{report_id}/status")
async def update_bug_report_status(report_id: str, status: str):
    """
    Update bug report status
    Status options: 'pending', 'reviewed', 'resolved'
    """
    try:
        from bson import ObjectId
        collection = get_bug_reports_collection()
        
        valid_statuses = ['pending', 'reviewed', 'resolved']
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        result = collection.update_one(
            {"_id": ObjectId(report_id)},
            {
                "$set": {
                    "status": status,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Bug report not found")
        
        return {
            "success": True,
            "message": f"Bug report status updated to '{status}'"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
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
            "lastUpdated": "November 2024",
            "support": "Available 24/7",
            "description": "The Medical Equipment and Supplies Management System (MEAMS) is designed to streamline the management of medical supplies and equipment in healthcare facilities."
        }
    }
