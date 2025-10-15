import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const idleTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const tokenRefreshTimerRef = useRef(null);

  // Idle timeout duration in milliseconds (3 minutes)
  const IDLE_TIMEOUT = 3 * 60 * 1000;
  // Refresh token 5 minutes before expiration
  const REFRESH_BUFFER = 5 * 60 * 1000;

  const isTokenValid = (token) => {
    if (!token || token.trim().length === 0) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < currentTime) {
        console.log('Token has expired');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  };

  const getUserFromToken = (token) => {
    if (!token || !isTokenValid(token)) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        username: payload.sub,
        role: payload.role || 'user',
        exp: payload.exp
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const checkAccountStatus = async (token) => {
    if (!token) return false;
    try {
      const response = await fetch('http://localhost:8000/api/accounts/check-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn('Failed to check account status, assuming active');
        return true;
      }
      
      const data = await response.json();
      console.log('Account status check:', data);
      
      return data.active !== false;
    } catch (error) {
      console.error('Error checking account status:', error);
      return true;
    }
  };

  // Token refresh function
  const refreshToken = async (currentToken) => {
    try {
      console.log('Attempting to refresh token...');
      const response = await fetch('http://localhost:8000/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Token refresh failed');
        return null;
      }

      const data = await response.json();
      if (data.access_token || data.token) {
        const newToken = data.access_token || data.token;
        console.log('Token refreshed successfully');
        return newToken;
      }

      return null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  };

  // Setup automatic token refresh
  const setupTokenRefresh = (token) => {
    // Clear existing timer
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
    }

    const user = getUserFromToken(token);
    if (!user || !user.exp) return;

    const expirationTime = user.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime - currentTime;
    const timeUntilRefresh = timeUntilExpiration - REFRESH_BUFFER;

    // Only setup refresh if token has enough time left
    if (timeUntilRefresh > 0) {
      console.log(`Token will be refreshed in ${Math.floor(timeUntilRefresh / 1000 / 60)} minutes`);
      
      tokenRefreshTimerRef.current = setTimeout(async () => {
        console.log('Refreshing token...');
        const newToken = await refreshToken(token);
        
        if (newToken && isTokenValid(newToken)) {
          const newUser = getUserFromToken(newToken);
          setAuthToken(newToken);
          setUserInfo(newUser);
          localStorage.setItem('authToken', newToken);
          console.log('Token updated successfully');
          
          // Setup next refresh
          setupTokenRefresh(newToken);
        } else {
          console.log('Token refresh failed, user will be logged out on expiration');
        }
      }, timeUntilRefresh);
    } else {
      console.log('Token expires soon, no refresh scheduled');
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUserInfo(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('adminToken');
    console.log('User logged out');
    
    // Clear all timers on logout
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
  };

  // Reset idle timer
  const resetIdleTimer = () => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    
    // Set new timer only if user is authenticated
    if (authToken && isTokenValid(authToken)) {
      idleTimerRef.current = setTimeout(() => {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= IDLE_TIMEOUT) {
          console.log('User idle for 3 minutes, logging out...');
          alert('You have been logged out due to inactivity.');
          logout();
          window.location.href = '/login';
        }
      }, IDLE_TIMEOUT);
    }
  };

  // Setup idle detection
  useEffect(() => {
    if (!authToken) return;

    // Events to track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Throttle the reset function to avoid too many calls
    let throttleTimer = null;
    const throttledReset = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          resetIdleTimer();
          throttleTimer = null;
        }, 1000); // Throttle to once per second
      }
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, throttledReset);
    });

    // Initialize the timer
    resetIdleTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledReset);
      });
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [authToken]);

  // Setup token refresh when token changes
  useEffect(() => {
    if (authToken && isTokenValid(authToken)) {
      setupTokenRefresh(authToken);
    }

    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }
    };
  }, [authToken]);

  useEffect(() => {
    const savedAuthToken = localStorage.getItem('authToken');
    if (savedAuthToken && isTokenValid(savedAuthToken)) {
      setAuthToken(savedAuthToken);
      setUserInfo(getUserFromToken(savedAuthToken));
      console.log('Valid token found, user logged in');
    } else {
      localStorage.removeItem('authToken');
      console.log('No valid token found');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authToken || !userInfo) return;

    const checkStatus = async () => {
      try {
        const isActive = await checkAccountStatus(authToken);
        
        if (isActive === false) {
          console.log('Account deactivated, logging out...');
          alert('Your account has been deactivated by an administrator. You will be logged out.');
          logout();
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Error in status check interval:', error);
      }
    };

    const initialTimeout = setTimeout(checkStatus, 5000);
    const intervalId = setInterval(checkStatus, 30000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [authToken, userInfo]);

  useEffect(() => {
    if (authToken && userInfo?.exp) {
      const expirationTime = userInfo.exp * 1000;
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;
      
      if (timeUntilExpiration > 0) {
        const timeoutId = setTimeout(() => {
          console.log('Token expired, logging out automatically');
          alert('Your session has expired. Please log in again.');
          logout();
          window.location.href = '/login';
        }, timeUntilExpiration);
        return () => clearTimeout(timeoutId);
      } else {
        logout();
      }
    }
  }, [authToken, userInfo]);

  const login = (token) => {
    if (isTokenValid(token)) {
      const user = getUserFromToken(token);
      setAuthToken(token);
      setUserInfo(user);
      localStorage.setItem('authToken', token);
      console.log('User logged in:', user);
    } else {
      throw new Error('Invalid token provided');
    }
  };

  const adminLogin = (token) => {
    if (isTokenValid(token)) {
      const user = getUserFromToken(token);
      if (user && user.role === 'admin') {
        setAuthToken(token);
        setUserInfo(user);
        localStorage.setItem('authToken', token);
        console.log('Admin logged in:', user);
      } else {
        throw new Error('Admin privileges required');
      }
    } else {
      throw new Error('Invalid token provided');
    }
  };

  const getCurrentUser = () => userInfo;

  const isAuthenticated = useMemo(() => 
    authToken && isTokenValid(authToken), 
    [authToken]
  );

  const isAdmin = useMemo(() => 
    userInfo?.role === 'admin',
    [userInfo]
  );

  const isStaff = useMemo(() => 
    userInfo && (userInfo.role === 'staff' || userInfo.role === 'user'),
    [userInfo]
  );

  const value = useMemo(() => ({
    authToken,
    login,
    adminLogin,
    logout,
    getCurrentUser,
    currentUser: userInfo,
    isAuthenticated,
    isAdmin,
    isStaff,
    loading,
    adminToken: isAdmin ? authToken : null
  }), [authToken, userInfo, isAuthenticated, isAdmin, isStaff, loading]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};