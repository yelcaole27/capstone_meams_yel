// AuthContext.js - Fixed with proper staff/admin authentication
import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Helper function to check if token is valid and not expired
  const isTokenValid = (token) => {
    if (!token || token.trim().length === 0) {
      return false;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check if token has expired
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

  // Helper function to get user info from token
  const getUserFromToken = (token) => {
    if (!token || !isTokenValid(token)) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        username: payload.sub,
        role: payload.role || 'user', // Default to 'user' if no role specified
        exp: payload.exp
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  useEffect(() => {
    // Check for existing token on app start
    const savedAuthToken = localStorage.getItem('authToken');
    
    // Validate token and check expiration
    if (savedAuthToken && isTokenValid(savedAuthToken)) {
      setAuthToken(savedAuthToken);
      console.log('Valid token found, user logged in');
    } else {
      // Remove invalid token
      localStorage.removeItem('authToken');
      console.log('No valid token found');
    }
    
    setLoading(false);
  }, []);

  // Auto-logout when token expires
  useEffect(() => {
    if (authToken) {
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        
        if (payload.exp) {
          const expirationTime = payload.exp * 1000; // Convert to milliseconds
          const currentTime = Date.now();
          const timeUntilExpiration = expirationTime - currentTime;
          
          if (timeUntilExpiration > 0) {
            // Set timeout to auto-logout when token expires
            const timeoutId = setTimeout(() => {
              console.log('Token expired, logging out automatically');
              logout();
            }, timeUntilExpiration);
            
            return () => clearTimeout(timeoutId);
          } else {
            // Token already expired
            logout();
          }
        }
      } catch (error) {
        console.error('Error setting up auto-logout:', error);
      }
    }
  }, [authToken]);

  // Universal login function - handles both staff and admin
  const login = (token) => {
    if (isTokenValid(token)) {
      setAuthToken(token);
      localStorage.setItem('authToken', token);
      
      const user = getUserFromToken(token);
      console.log('User logged in:', user);
    } else {
      console.error('Invalid token provided to login');
      throw new Error('Invalid token provided');
    }
  };

  // Admin login function - same as regular login but with role verification
  const adminLogin = (token) => {
    if (isTokenValid(token)) {
      const user = getUserFromToken(token);
      
      // Verify admin role
      if (user && user.role === 'admin') {
        setAuthToken(token);
        localStorage.setItem('authToken', token);
        console.log('Admin logged in:', user);
      } else {
        console.error('Token does not have admin privileges');
        throw new Error('Admin privileges required');
      }
    } else {
      console.error('Invalid token provided to adminLogin');
      throw new Error('Invalid token provided');
    }
  };

  const logout = () => {
    setAuthToken(null);
    localStorage.removeItem('authToken');
    console.log('User logged out');
  };

  // Helper function to get current user info from token
  const getCurrentUser = () => {
    return getUserFromToken(authToken);
  };

  // Check if user is authenticated
  const isAuthenticated = authToken && isTokenValid(authToken);

  // Check if user is admin
  const isAdmin = (() => {
    const user = getCurrentUser();
    return user && user.role === 'admin';
  })();

  // Check if user is staff
  const isStaff = (() => {
    const user = getCurrentUser();
    return user && (user.role === 'staff' || user.role === 'user');
  })();

  const value = {
    authToken,
    login,
    adminLogin,
    logout,
    getCurrentUser,
    isAuthenticated,
    isAdmin,
    isStaff,
    loading,
    // Legacy support - keep these for backward compatibility
    adminToken: isAdmin ? authToken : null
  };

  if (loading) {
    return <div>Loading...</div>; // Or your loading component
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

