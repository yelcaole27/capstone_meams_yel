"""
Miscellaneous router - bug reports, health checks, etc.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime

from models.user import BugReport
from services.auth_service import verify_token
from services.log_service import create_log_entry
from services.email_service import send_email
from dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["miscellaneous"])

@router.post("/report-bug")
async def report_bug(
    report: BugReport,
    request: Request,
    token: str = Depends(get_current_user)
):
    """Submit a bug report or question"""
    try:
        payload = verify_token(token)
        username = payload.get("username", "unknown_user")
        client_ip = request.client.host if hasattr(request, 'client') else "unknown"
        
        if not report.message or not report.message.strip():
            raise HTTPException(status_code=400, detail="Bug report message cannot be empty")
        
        subject = f"Bug Report from {report.username} ({report.role})"
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
                    Bug Report / Question
                </h2>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>User:</strong> {report.username}</p>
                    <p><strong>Role:</strong> {report.role}</p>
                    <p><strong>Submitted:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
                    <p><strong>IP Address:</strong> {client_ip}</p>
                </div>
                
                <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <h3 style="color: #2c3e50; margin-top: 0;">Message:</h3>
                    <div style="white-space: pre-wrap; background-color: #f8f9fa; padding: 15px; border-radius: 3px; border-left: 4px solid #3498db;">
{report.message}
                    </div>
                </div>
                
                <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
                    <p>This is an automated message from MEAMS Inventory Management System</p>
                </footer>
            </div>
        </body>
        </html>
        """
        
        success = await send_email("meamsds42@gmail.com", subject, body)
        
        if not success:
            await create_log_entry(
                username,
                "Submitted bug report (email failed)",
                report.message[:100] + "..." if len(report.message) > 100 else report.message,
                client_ip
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to send bug report email. Please try again or contact support directly."
            )
        
        await create_log_entry(
            username,
            "Submitted bug report",
            report.message[:100] + "..." if len(report.message) > 100 else report.message,
            client_ip
        )
        
        return {
            "success": True,
            "message": "Bug report sent successfully",
            "email_sent": True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    
@router.post("/clear-cache")
async def clear_cache(token: str = Depends(get_current_user)):
    """Clear forecast cache - admin only"""
    payload = verify_token(token)
    
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from services.forecast_service import clear_forecast_cache
    clear_forecast_cache()
    
    return {"success": True, "message": "Cache cleared successfully"}

@router.get("/test-email")
async def test_email_config():
    """Test email configuration"""
    try:
        test_subject = "Test Email from MEAMS Inventory System"
        test_body = f"""
        <html>
        <body>
            <h2>Test Email</h2>
            <p>This is a test email to verify the email configuration is working properly.</p>
            <p>Sent at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        </body>
        </html>
        """
        
        success = await send_email("meamsds42@gmail.com", test_subject, test_body)
        
        from config import EMAIL_HOST, EMAIL_PASSWORD
        return {
            "success": success,
            "message": "Test email sent successfully" if success else "Failed to send test email",
            "email_configured": bool(EMAIL_PASSWORD),
            "smtp_server": EMAIL_HOST
        }
    except Exception as e:
        from config import EMAIL_HOST, EMAIL_PASSWORD
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "email_configured": bool(EMAIL_PASSWORD),
            "smtp_server": EMAIL_HOST
        }