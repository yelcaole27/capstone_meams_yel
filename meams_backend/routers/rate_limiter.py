"""
RATE LIMITING IMPLEMENTATION
Protects against brute force attacks and API abuse
"""

# ============================================
# FILE 1: rate_limiter.py (CREATE NEW FILE)
# ============================================
"""
Simple in-memory rate limiter
For production, consider using Redis for distributed rate limiting
"""
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, Tuple
import asyncio

class RateLimiter:
    def __init__(self):
        # Store: {ip_address: [(timestamp, endpoint), ...]}
        self.requests: Dict[str, list] = defaultdict(list)
        self.cleanup_task = None
    
    def _cleanup_old_requests(self):
        """Remove requests older than 1 hour"""
        cutoff_time = datetime.utcnow() - timedelta(hours=1)
        for ip in list(self.requests.keys()):
            self.requests[ip] = [
                (ts, endpoint) for ts, endpoint in self.requests[ip]
                if ts > cutoff_time
            ]
            # Remove empty entries
            if not self.requests[ip]:
                del self.requests[ip]
    
    def check_rate_limit(
        self, 
        ip: str, 
        endpoint: str,
        max_requests: int,
        time_window_minutes: int
    ) -> Tuple[bool, int, int]:
        """
        Check if request should be allowed
        
        Returns: (is_allowed, requests_made, requests_remaining)
        """
        # Cleanup old requests periodically
        if len(self.requests) > 100:  # Arbitrary threshold
            self._cleanup_old_requests()
        
        now = datetime.utcnow()
        cutoff_time = now - timedelta(minutes=time_window_minutes)
        
        # Get recent requests from this IP for this endpoint
        recent_requests = [
            ts for ts, ep in self.requests[ip]
            if ts > cutoff_time and ep == endpoint
        ]
        
        requests_made = len(recent_requests)
        requests_remaining = max(0, max_requests - requests_made)
        
        if requests_made >= max_requests:
            return False, requests_made, requests_remaining
        
        # Record this request
        self.requests[ip].append((now, endpoint))
        
        return True, requests_made + 1, requests_remaining - 1

# Global rate limiter instance
rate_limiter = RateLimiter()


# ============================================
# FILE 2: Update auth.py - Add Rate Limiting
# ============================================

# ADD THIS AT THE TOP OF auth.py:
from rate_limiter import rate_limiter

# THEN UPDATE THE LOGIN ENDPOINT:

@router.post("/login")
async def login(credentials: LoginRequest, request: Request):
    """Login endpoint with rate limiting and account status check"""
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    # ===== RATE LIMITING =====
    # Allow 5 login attempts per 15 minutes per IP
    is_allowed, attempts_made, attempts_remaining = rate_limiter.check_rate_limit(
        ip=client_ip,
        endpoint="login",
        max_requests=5,
        time_window_minutes=15
    )
    
    if not is_allowed:
        await create_log_entry(
            credentials.username,
            "Login rate limit exceeded.",
            f"Too many login attempts from IP: {client_ip}",
            client_ip
        )
        raise HTTPException(
            status_code=429,  # Too Many Requests
            detail=f"Too many login attempts. Please try again in 15 minutes. Attempts made: {attempts_made}",
            headers={"Retry-After": "900"}  # 15 minutes in seconds
        )
    
    # ===== EXISTING LOGIN LOGIC =====
    user = authenticate_user(credentials.username, credentials.password)
    
    if not user:
        await create_log_entry(
            credentials.username,
            "Failed login attempt.",
            f"Invalid credentials. Attempts remaining: {attempts_remaining}",
            client_ip
        )
        raise HTTPException(
            status_code=401,
            detail=f"Invalid username or password. Attempts remaining: {attempts_remaining}"
        )
    
    # Check if account is active
    if user.get("status") == False:
        await create_log_entry(
            credentials.username,
            "Failed login attempt.",
            "Account is deactivated",
            client_ip
        )
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Please contact an administrator."
        )
    
    update_last_login(credentials.username)
    
    await create_log_entry(
        credentials.username,
        "Logged in.",
        f"Role: {user['role']} - Attempts used: {attempts_made}/5",
        client_ip
    )
    
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "userId": str(user["_id"])
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "first_login": user.get("first_login", False)
    }


# ============================================
# ALSO UPDATE FORGOT PASSWORD ENDPOINT:
# ============================================

@router.post("/api/auth/forgot-password")
async def forgot_password(request_data: ForgotPasswordRequest, request: Request):
    """Send password reset email with rate limiting"""
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    # ===== RATE LIMITING =====
    # Allow 3 password reset requests per 30 minutes per IP
    is_allowed, attempts_made, attempts_remaining = rate_limiter.check_rate_limit(
        ip=client_ip,
        endpoint="forgot_password",
        max_requests=3,
        time_window_minutes=30
    )
    
    if not is_allowed:
        await create_log_entry(
            "System",
            "Password reset rate limit exceeded.",
            f"Too many reset attempts from IP: {client_ip}",
            client_ip
        )
        raise HTTPException(
            status_code=429,
            detail=f"Too many password reset attempts. Please try again in 30 minutes.",
            headers={"Retry-After": "1800"}  # 30 minutes
        )
    
    # ===== EXISTING FORGOT PASSWORD LOGIC =====
    accounts_collection = get_accounts_collection()
    
    user = accounts_collection.find_one({"email": request_data.email})
    
    if not user:
        # Don't reveal if email doesn't exist
        return {
            "success": True,
            "message": "If an account with that email exists, we've sent a password reset link."
        }
    
    # ... rest of your existing forgot password code ...


# ============================================
# FILE 3: Update main.py - Add Rate Limit Headers
# ============================================

# ADD AFTER THE EXISTING MIDDLEWARE:

@app.middleware("http")
async def add_rate_limit_headers(request: Request, call_next):
    """Add rate limit information to response headers"""
    from rate_limiter import rate_limiter
    
    response = await call_next(request)
    
    # Add rate limit headers for monitoring
    client_ip = request.client.host if hasattr(request, 'client') else "unknown"
    
    # Check current rate limit status (without counting this request)
    if request.url.path == "/login":
        _, attempts_made, attempts_remaining = rate_limiter.check_rate_limit(
            ip=client_ip,
            endpoint="login",
            max_requests=5,
            time_window_minutes=15
        )
        response.headers["X-RateLimit-Limit"] = "5"
        response.headers["X-RateLimit-Remaining"] = str(max(0, attempts_remaining))
    
    return response