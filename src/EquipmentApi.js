// src/services/equipmentApi.js
import axios from 'axios';

// Base URL for your Python FastAPI backend
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // Increased to 15 seconds for better reliability
});

// Function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken') || 
         localStorage.getItem('adminToken') || 
         localStorage.getItem('token') ||
         sessionStorage.getItem('authToken') ||
         sessionStorage.getItem('token');
};

// Request interceptor for logging and authentication
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 Equipment API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add authentication token to requests
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔐 Added auth token to equipment request');
    } else {
      console.warn('⚠️ No auth token found for equipment API request');
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Equipment API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ Equipment API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error('❌ Equipment API Response Error:', error);
    
    // Handle common error scenarios
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your internet connection and try again.');
    } else if (error.response?.status === 401) {
      console.error('🔒 Equipment API Unauthorized - Token may be expired or invalid');
      throw new Error('Authentication failed. Please log in again.');
    } else if (error.response?.status === 404) {
      throw new Error('Equipment resource not found');
    } else if (error.response?.status === 422) {
      throw new Error('Invalid data provided. Please check your input and try again.');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later.');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Cannot connect to server. Please check if the backend is running.');
    }
    
    throw new Error(error.response?.data?.detail || error.response?.data?.message || error.message || 'An unexpected error occurred');
  }
);

const EquipmentAPI = {
  // Get all equipment
  async getAllEquipment() {
    try {
      const response = await apiClient.get('/api/equipment');
      
      // Handle different response structures
      const data = response.data.data || response.data.equipment || response.data;
      
      if (!Array.isArray(data)) {
        console.warn('Expected array from API, got:', typeof data);
        return [];
      }
      
      console.log(`📦 Retrieved ${data.length} equipment items`);
      return data;
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
      throw error;
    }
  },

  // Get equipment by ID
  async getEquipmentById(id) {
    try {
      if (!id) {
        throw new Error('Equipment ID is required');
      }
      
      const response = await apiClient.get(`/api/equipment/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error(`Failed to fetch equipment ${id}:`, error);
      throw error;
    }
  },

  // Add new equipment - ENHANCED WITH DEBUG LOGGING
  async addEquipment(equipmentData) {
  try {
    // Enhanced validation - check for both name and description
    if (!equipmentData.name?.trim()) {
      throw new Error('Equipment name is required');
    }
    if (!equipmentData.description?.trim()) {
      throw new Error('Equipment description is required');
    }
    if (!equipmentData.category?.trim()) {
      throw new Error('Equipment category is required');
    }
    if (!equipmentData.quantity || equipmentData.quantity <= 0) {
      throw new Error('Equipment quantity must be greater than 0');
    }

    // 🔍 DEBUG: Log the incoming data
    console.log('🔍 DEBUG - Raw incoming equipmentData:', equipmentData);
    console.log('🔍 DEBUG - Date field:', equipmentData.date);
    console.log('🔍 DEBUG - Date field type:', typeof equipmentData.date);
    console.log('🔍 DEBUG - Date field value:', JSON.stringify(equipmentData.date));

    // FIXED: Process and clean data with correct field mapping
    const processedData = {
      name: equipmentData.name.trim(),
      description: equipmentData.description.trim(),
      category: equipmentData.category.trim(),
      quantity: parseInt(equipmentData.quantity) || 0,
      unit: equipmentData.unit || 'UNIT',
      location: equipmentData.location?.trim() || '',
      status: equipmentData.status || 'Operational',
      serialNo: equipmentData.serialNo?.trim() || '',
      itemCode: equipmentData.itemCode?.trim() || '',
      unit_price: parseFloat(equipmentData.unit_price) || 0,
      supplier: equipmentData.supplier?.trim() || '',
      date: equipmentData.date || ''  // 🔥 EXPLICITLY INCLUDE DATE
    };

      // 🔍 DEBUG: Log the processed data that will be sent
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
    
    const response = await apiClient.post('/api/equipment', fieldsToSend);
    const savedEquipment = response.data.data || response.data;
    
    // 🔍 DEBUG: Log what the backend returned
    console.log('🔍 DEBUG - Backend response:', savedEquipment);
    console.log('🔍 DEBUG - Backend returned date field:', savedEquipment.date);
    console.log('🔍 DEBUG - Backend date type:', typeof savedEquipment.date);
    
    console.log('✅ Equipment added successfully:', savedEquipment);
    return savedEquipment;
  } catch (error) {
    console.error('❌ Failed to add equipment:', error);
    throw error;
  }
},

  // Update equipment
  async updateEquipment(id, updateData) {
    try {
      if (!id) {
        throw new Error('Equipment ID is required for update');
      }

      // Clean update data
      const processedData = { ...updateData };
      Object.keys(processedData).forEach(key => {
        if (processedData[key] === '' || processedData[key] === null || processedData[key] === undefined) {
          delete processedData[key];
        }
      });

      console.log(`📝 Updating equipment ${id}:`, processedData);
      
      const response = await apiClient.put(`/api/equipment/${id}`, processedData);
      const updatedEquipment = response.data.data || response.data;
      
      console.log('✅ Equipment updated successfully');
      return updatedEquipment;
    } catch (error) {
      console.error(`Failed to update equipment ${id}:`, error);
      throw error;
    }
  },

  // Delete equipment
  async deleteEquipment(id) {
    try {
      if (!id) {
        throw new Error('Equipment ID is required for deletion');
      }
      
      console.log(`🗑️ Deleting equipment ${id}`);
      
      const response = await apiClient.delete(`/api/equipment/${id}`);
      
      console.log('✅ Equipment deleted successfully');
      return response.data;
    } catch (error) {
      console.error(`Failed to delete equipment ${id}:`, error);
      throw error;
    }
  },

  // Get equipment by category
  async getEquipmentByCategory(category) {
    try {
      if (!category?.trim()) {
        throw new Error('Category is required');
      }
      
      const response = await apiClient.get(`/api/equipment/category/${encodeURIComponent(category)}`);
      const data = response.data.data || response.data;
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Failed to fetch equipment for category ${category}:`, error);
      throw error;
    }
  },

  // Get equipment by status
  async getEquipmentByStatus(status) {
    try {
      if (!status?.trim()) {
        throw new Error('Status is required');
      }
      
      const response = await apiClient.get(`/api/equipment/status/${encodeURIComponent(status)}`);
      const data = response.data.data || response.data;
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Failed to fetch equipment with status ${status}:`, error);
      throw error;
    }
  },

  // Get equipment by location
  async getEquipmentByLocation(location) {
    try {
      if (!location?.trim()) {
        throw new Error('Location is required');
      }
      
      const response = await apiClient.get(`/api/equipment/location/${encodeURIComponent(location)}`);
      const data = response.data.data || response.data;
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Failed to fetch equipment at location ${location}:`, error);
      throw error;
    }
  },

  // Search equipment
  async searchEquipment(query) {
    try {
      if (!query || query.trim() === '') {
        return this.getAllEquipment();
      }
      
      const response = await apiClient.get(`/api/equipment/search/${encodeURIComponent(query.trim())}`);
      const data = response.data.data || response.data;
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Failed to search equipment with query "${query}":`, error);
      throw error;
    }
  },

  // Get all categories
  async getEquipmentCategories() {
    try {
      const response = await apiClient.get('/api/equipment/categories');
      const data = response.data.data || response.data;
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch equipment categories:', error);
      // Return default categories as fallback
      return ['Mechanical', 'Electrical', 'Medical', 'IT Equipment', 'Laboratory', 'HVAC', 'Safety'];
    }
  },

  // Get all statuses
  async getEquipmentStatuses() {
    try {
      const response = await apiClient.get('/api/equipment/statuses');
      const data = response.data.data || response.data;
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch equipment statuses:', error);
      // Return default statuses as fallback
      return ['Operational', 'Maintenance', 'Out of Service', 'Under Repair'];
    }
  },

  // Get all locations
  async getEquipmentLocations() {
    try {
      const response = await apiClient.get('/api/equipment/locations');
      const data = response.data.data || response.data;
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch equipment locations:', error);
      return [];
    }
  },

  // Health check
  async checkHealth() {
    try {
      const response = await apiClient.get('/health');
      console.log('💚 Backend health check passed');
      return response.data;
    } catch (error) {
      console.error('💔 Backend health check failed:', error);
      throw error;
    }
  },

  // Batch operations
  async addMultipleEquipment(equipmentArray) {
    try {
      if (!Array.isArray(equipmentArray) || equipmentArray.length === 0) {
        throw new Error('Equipment array is required and must not be empty');
      }

      const response = await apiClient.post('/api/equipment/batch', {
        equipment: equipmentArray
      });
      
      return response.data.data || response.data;
    } catch (error) {
      console.error('Failed to add multiple equipment:', error);
      throw error;
    }
  },

  // Export equipment data
  async exportEquipment(format = 'json') {
    try {
      const response = await apiClient.get(`/api/equipment/export?format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to export equipment:', error);
      throw error;
    }
  },

  // Method to check if user is authenticated
  isAuthenticated() {
    return !!getAuthToken();
  },

  // Method to manually set token (useful for debugging)
  setAuthToken(token) {
    localStorage.setItem('authToken', token);
    console.log('🔑 Auth token set manually');
  },

  // Get current API configuration
  getApiConfig() {
    return {
      baseURL: API_BASE_URL,
      timeout: apiClient.defaults.timeout,
      authenticated: this.isAuthenticated()
    };
  }
};

export default EquipmentAPI;