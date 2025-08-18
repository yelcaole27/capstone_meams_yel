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

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
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
    if (error.response?.status === 404) {
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
      // Validate required fields
      if (!supplyData.name || !supplyData.category || !supplyData.quantity) {
        throw new Error('Name, category, and quantity are required fields');
      }

      // Ensure quantity is a number
      const processedData = {
        ...supplyData,
        quantity: parseInt(supplyData.quantity) || 0,
        unit_price: parseFloat(supplyData.unit_price) || 0,
      };

      console.log('📤 Sending supply data:', processedData);
      
      const response = await apiClient.post('/api/supplies', processedData);
      console.log('✅ Supply added successfully:', response.data);
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to add supply:', error);
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

  // Delete supply
  async deleteSupply(id) {
    try {
      const response = await apiClient.delete(`/api/supplies/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete supply ${id}:`, error);
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
  }
};

export default SuppliesAPI;