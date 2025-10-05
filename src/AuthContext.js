import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

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
      
      // If response is not ok, don't treat it as deactivation - could be network error
      if (!response.ok) {
        console.warn('Failed to check account status, assuming active');
        return true; // Changed: assume active on error
      }
      
      const data = await response.json();
      console.log('Account status check:', data);
      
      // Explicitly check for false, not just falsy values
      return data.active !== false;
    } catch (error) {
      console.error('Error checking account status:', error);
      // On network error, assume account is active to prevent false logouts
      return true;
    }
  };

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
        
        // Only logout if explicitly deactivated
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

    // Initial check after 5 seconds (give app time to load)
    const initialTimeout = setTimeout(checkStatus, 5000);
    
    // Then check every 30 seconds
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
          logout();
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

  const logout = () => {
    setAuthToken(null);
    setUserInfo(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('adminToken');
    console.log('User logged out');
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