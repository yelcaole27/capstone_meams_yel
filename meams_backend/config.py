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
SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key")
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

# Brevo Configuration
BREVO_API_KEY = os.getenv("BREVO_API_KEY")
# FIXED: Email must be just the address, not in "Name <email>" format
EMAIL_FROM = os.getenv("EMAIL_FROM", "meamsds42@gmail.com")
EMAIL_FROM_NAME = "MEAMS"  # Separate name field for Brevo API

# File Upload Settings
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif']

# Hardcoded Users (for backward compatibility)
HARDCODED_USERS = {
    "admin": {"password": "password123", "role": "admin"},
    "staff": {"password": "staff123", "role": "staff"},
}
