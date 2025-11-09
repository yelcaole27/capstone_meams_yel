"""
Configuration settings for MEAMS API
Centralized configuration management
"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Settings
API_TITLE = "MEAMS API"
API_VERSION = "1.0.0"
API_HOST = "0.0.0.0"
API_PORT = 8000

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_change_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# CORS Settings
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://meams.onrender.com",
    "https://meams-udm.onrender.com",  
]

# Frontend URL (for email links)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://meams-udm.onrender.com")

# MongoDB
MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb+srv://etil:MEAMSDS42@cluster0.xl6k426.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
)
DATABASE_NAME = os.getenv("DATABASE_NAME", "MEAMS")

# ============================================================================
# EMAIL CONFIGURATION - RESEND (UPDATED)
# ============================================================================
# New: Resend API Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

# Email "From" address
# For testing: use "MEAMS System <onboarding@resend.dev>"
# For production: use your own domain like "MEAMS System <noreply@yourdomain.com>"
EMAIL_FROM = os.getenv("EMAIL_FROM", "MEAMS System <onboarding@resend.dev>")

# ============================================================================
# OLD EMAIL CONFIGURATION - GMAIL SMTP (DEPRECATED - NO LONGER USED)
# ============================================================================
# These are kept for reference but NOT used anymore
# You can delete these lines after confirming Resend works
EMAIL_HOST = "smtp.gmail.com"  # Not needed for Resend
EMAIL_PORT = 587  # Not needed for Resend
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", "meamsds42@gmail.com")  # Not needed for Resend
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")  # Not needed for Resend

# ============================================================================

# File Upload Settings
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif']

# Hardcoded Users (for backward compatibility)
HARDCODED_USERS = {
    "admin": {"password": "password123", "role": "admin"},
    "staff": {"password": "staff123", "role": "staff"},
}

# ============================================================================
# EMAIL SERVICE STATUS
# ============================================================================
def get_email_service_status():
    """Check which email service is configured"""
    if RESEND_API_KEY:
        return {
            "service": "Resend",
            "status": "active",
            "api_key_set": True,
            "from_email": EMAIL_FROM
        }
    elif EMAIL_PASSWORD:
        return {
            "service": "Gmail SMTP (Deprecated)",
            "status": "legacy",
            "warning": "Consider switching to Resend",
            "from_email": EMAIL_FROM
        }
    else:
        return {
            "service": "None",
            "status": "not_configured",
            "error": "No email service configured"
        }