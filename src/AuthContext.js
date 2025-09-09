// AuthContext.js - Updated with role-based authentication
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
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on app start
    const savedAuthToken = localStorage.getItem('authToken');
    
    if (savedAuthToken && savedAuthToken.trim().length > 0) {
      try {
        // Decode the JWT token to get user role
        const payload = JSON.parse(atob(savedAuthToken.split('.')[1]));
        const role = payload.role;
        
        setAuthToken(savedAuthToken);
        setUserRole(role);
      } catch (error) {
        console.error('Error decoding token:', error);
        localStorage.removeItem('authToken');
      }
    }
    
    setLoading(false);
  }, []);

  const login = (token) => {
    try {
      // Decode the JWT token to get user role
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload.role;
      
      setAuthToken(token);
      setUserRole(role);
      localStorage.setItem('authToken', token);
      
      // For backward compatibility, also set adminToken if user is admin
      if (role === 'admin') {
        localStorage.setItem('adminToken', token);
      }
    } catch (error) {
      console.error('Error decoding token during login:', error);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUserRole(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('adminToken');
  };

  // Helper function to get current user info from token
  const getCurrentUser = () => {
    if (!authToken) return null;
    
    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      return {
        username: payload.sub,
        role: payload.role
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const value = {
    authToken,
    userRole,
    login,
    logout,
    getCurrentUser,
    isAuthenticated: !!authToken,
    isAdmin: userRole === 'admin',
    isStaff: userRole === 'staff',
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};