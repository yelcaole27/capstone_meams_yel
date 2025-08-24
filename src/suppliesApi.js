// src/services/suppliesApi.js
import axios from 'axios';

// Base URL for your Python FastAPI backend
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Function to get auth token (adjust based on where you store it)
const getAuthToken = () => {
  // Check different storage options - adjust based on your login implementation
  return localStorage.getItem('token') || 
         localStorage.getItem('authToken') || 
         localStorage.getItem('access_token') ||
         sessionStorage.getItem('token') ||
         sessionStorage.getItem('authToken') ||
         sessionStorage.getItem('access_token');
};

// Create headers with authentication (from first file)
const createAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found. Please log in.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Request interceptor for logging and authentication
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add authentication token to requests
    const token = getAuthToken();
    if (token) {
      // FastAPI typically uses Bearer token format
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔐 Added auth token to request:', token.substring(0, 20) + '...');
    } else {
      console.warn('⚠️ No auth token found for API request');
      console.log('Available localStorage keys:', Object.keys(localStorage));
    }
    
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);
    
    // Handle common error scenarios
    if (error.response?.status === 401) {
      console.error('🔒 Unauthorized - Token may be expired or invalid');
      // Optionally redirect to login or clear invalid token
      // localStorage.removeItem('token');
      // window.location.href = '/login';
      throw new Error('Authentication failed. Please log in again.');
    } else if (error.response?.status === 404) {
      throw new Error('Resource not found');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later.');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to server. Please check if the backend is running.');
    }
    
    throw new Error(error.response?.data?.detail || error.message || 'An unexpected error occurred');
  }
);

const SuppliesAPI = {
  // Get all supplies
  async getAllSupplies() {
    try {
      const response = await apiClient.get('/api/supplies');
      return response.data.data; // Return the data array from the response
    } catch (error) {
      console.error('Failed to fetch supplies:', error);
      throw error;
    }
  },

  // Get supply by ID
  async getSupplyById(id) {
    try {
      const response = await apiClient.get(`/api/supplies/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch supply ${id}:`, error);
      throw error;
    }
  },

  // Add new supply
  async addSupply(supplyData) {
  try {
    // Enhanced validation - check for both name and description
    if (!supplyData.name?.trim()) {
      throw new Error('Supply name is required');
    }
    if (!supplyData.description?.trim()) {
      throw new Error('Supply description is required');
    }
    if (!supplyData.category?.trim()) {
      throw new Error('Supply category is required');
    }
    if (!supplyData.quantity || supplyData.quantity <= 0) {
      throw new Error('Supply quantity must be greater than 0');
    }

    // 🔍 DEBUG: Log the incoming data
    console.log('🔍 DEBUG - Raw incoming supplyData:', supplyData);
    console.log('🔍 DEBUG - Date field:', supplyData.date);
    console.log('🔍 DEBUG - Date field type:', typeof supplyData.date);
    console.log('🔍 DEBUG - Date field value:', JSON.stringify(supplyData.date));

    // FIXED: Process and clean data with correct field mapping
    const processedData = {
      name: supplyData.name.trim(),
      description: supplyData.description.trim(),
      category: supplyData.category.trim(),
      quantity: parseInt(supplyData.quantity) || 0,
      unit: supplyData.unit || 'UNIT',
      location: supplyData.location?.trim() || '',
      status: supplyData.status || 'Available',
      serialNo: supplyData.serialNo?.trim() || '',
      itemCode: supplyData.itemCode?.trim() || '',
      unit_price: parseFloat(supplyData.unit_price) || 0,
      supplier: supplyData.supplier?.trim() || '',
      date: supplyData.date || '' // 🔥 EXPLICITLY INCLUDE DATE
    };

    // 🔍 DEBUG: Log the processed data
    console.log('🔍 DEBUG - Processed data being sent to backend:', processedData);
    console.log('🔍 DEBUG - Processed date field:', processedData.date);
    console.log('🔍 DEBUG - Processed date type:', typeof processedData.date);

    // Don't remove empty string fields for date - we want to preserve it
    const fieldsToSend = { ...processedData };
    Object.keys(fieldsToSend).forEach(key => {
      if (key !== 'date' && fieldsToSend[key] === '') {
        delete fieldsToSend[key];
      }
    });

    console.log('📤 Final data being sent to backend:', fieldsToSend);
    console.log('📤 Final date field:', fieldsToSend.date);

    const response = await apiClient.post('/api/supplies', fieldsToSend);
    const savedSupply = response.data.data || response.data;

    // 🔍 DEBUG: Log what the backend returned
    console.log('🔍 DEBUG - Backend response:', savedSupply);
    console.log('🔍 DEBUG - Backend returned date field:', savedSupply.date);
    console.log('🔍 DEBUG - Backend date type:', typeof savedSupply.date);

    console.log('✅ Supply added successfully:', savedSupply);
    return savedSupply;

  } catch (error) {
    console.error('❌ Failed to add supply:', error);
    throw error;
  }
},

  // Update supply
  async updateSupply(id, updateData) {
    try {
      const response = await apiClient.put(`/api/supplies/${id}`, updateData);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to update supply ${id}:`, error);
      throw error;
    }
  },

  // DELETE FUNCTION - From first file (fetch-based implementation)
  deleteSupply: async (supplyId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/supplies/${supplyId}`, {
        method: 'DELETE',
        headers: createAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        if (response.status === 404) {
          throw new Error('Supply not found.');
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error deleting supply:', error);
      throw error;
    }
  },

  // Get supplies by category
  async getSuppliesByCategory(category) {
    try {
      const response = await apiClient.get(`/api/supplies/category/${category}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch supplies for category ${category}:`, error);
      throw error;
    }
  },

  // Get all categories
  async getCategories() {
    try {
      const response = await apiClient.get('/api/categories');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error;
    }
  },

  // Search supplies
  async searchSupplies(query) {
    try {
      if (!query || query.trim() === '') {
        return this.getAllSupplies();
      }
      
      const response = await apiClient.get(`/api/supplies/search/${encodeURIComponent(query)}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to search supplies with query "${query}":`, error);
      throw error;
    }
  },

  // Health check
  async checkHealth() {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  // Method to check if user is authenticated
  isAuthenticated() {
    return !!getAuthToken();
  },

  // Method to manually set token (useful for debugging)
  setAuthToken(token) {
    localStorage.setItem('token', token);
  }
};

export default SuppliesAPI;