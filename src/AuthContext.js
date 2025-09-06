// AuthContext.js - Updated with first login support
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
  const [adminToken, setAdminToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing tokens on app start
    const savedAuthToken = localStorage.getItem('authToken');
    const savedAdminToken = localStorage.getItem('adminToken');
    
    // Validate tokens (you can add more sophisticated validation here)
    if (savedAuthToken && savedAuthToken.trim().length > 0) {
      setAuthToken(savedAuthToken);
    } else {
      localStorage.removeItem('authToken');
    }
    
    if (savedAdminToken && savedAdminToken.trim().length > 0) {
      setAdminToken(savedAdminToken);
    } else {
      localStorage.removeItem('adminToken');
    }
    
    setLoading(false);
  }, []);

  const login = (token) => {
    setAuthToken(token);
    localStorage.setItem('authToken', token);
  };

  const adminLogin = (token) => {
    setAdminToken(token);
    setAuthToken(token); // Admin token is also stored as auth token
    localStorage.setItem('adminToken', token);
    localStorage.setItem('authToken', token);
  };

  const logout = () => {
    setAuthToken(null);
    setAdminToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('adminToken');
  };

  // Helper function to get current user info from token
  const getCurrentUser = () => {
    const token = authToken || adminToken;
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
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
    adminToken,
    login,
    adminLogin,
    logout,
    getCurrentUser,
    isAuthenticated: !!authToken,
    isAdmin: !!adminToken,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};