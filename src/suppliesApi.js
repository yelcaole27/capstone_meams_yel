// src/services/suppliesApi.js
import axios from 'axios';

// Base URL for your Python FastAPI backend
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://meams.onrender.com';

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
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('authToken') ||
    sessionStorage.getItem('access_token')
  );
};

// Create headers with authentication
const createAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found. Please log in.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

// Request interceptor for logging and authentication
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);

    // Add authentication token to requests
    const token = getAuthToken();
    if (token) {
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

    if (error.response?.status === 401) {
      console.error('🔒 Unauthorized - Token may be expired or invalid');
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

  // Add new supply with base64 image support
  async addSupply(supplyData) {
    try {
      // Basic validation
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

      // Prepare data to send
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
        date: supplyData.date || '',
        itemPicture: supplyData.itemPicture || null, // base64 image string or null
        transactionHistory: supplyData.transactionHistory || [],
      };

      // Remove empty strings except date and itemPicture
      Object.keys(processedData).forEach((key) => {
        if (key !== 'date' && key !== 'itemPicture' && key !== 'transactionHistory' && processedData[key] === '') {
          delete processedData[key];
        }
      });

      const response = await apiClient.post('/api/supplies', processedData);
      return response.data.data; // Return saved supply object
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

  // Upload image file for existing supply
  async uploadSupplyImage(supplyId, imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const token = getAuthToken();
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/supplies/${supplyId}/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to upload supply image:', error);
      throw error;
    }
  },

  // Get supply image URL (if needed)
  getSupplyImageUrl(supplyId) {
    const token = getAuthToken();
    return `${API_BASE_URL}/api/supplies/${supplyId}/image?token=${encodeURIComponent(token)}`;
  },

  // Delete supply
  async deleteSupply(supplyId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/supplies/${supplyId}`, {
        method: 'DELETE',
        headers: createAuthHeaders(),
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

  // Check if user is authenticated
  isAuthenticated() {
    return !!getAuthToken();
  },

  // Manually set token (for debugging)
  setAuthToken(token) {
    localStorage.setItem('token', token);
  },

  // ========================================
  // DOCUMENT MANAGEMENT METHODS (NEW)
  // ========================================

  // Upload document to supply
  async uploadSupplyDocument(supplyId, file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      if (!token) throw new Error('No authentication token found.');

      console.log(`📤 Uploading document "${file.name}" to supply ${supplyId}`);

      const response = await fetch(`${API_BASE_URL}/api/supplies/${supplyId}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Document uploaded successfully');
      return result.data;
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  },

  // Get all documents for a supply
  async getSupplyDocuments(supplyId) {
    try {
      console.log(`📥 Fetching documents for supply ${supplyId}`);
      const response = await apiClient.get(`/api/supplies/${supplyId}/documents`);
      console.log(`✅ Found ${response.data.data.length} documents`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      throw error;
    }
  },

  // Get document URL for viewing/downloading
  getDocumentUrl(supplyId, documentIndex) {
    const token = getAuthToken();
    return `${API_BASE_URL}/api/supplies/${supplyId}/documents/${documentIndex}?token=${encodeURIComponent(token)}`;
  },

  // Download specific document
  async downloadSupplyDocument(supplyId, documentIndex, filename) {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('No authentication token found.');

      console.log(`📥 Downloading document: ${filename}`);

      const response = await fetch(
        `${API_BASE_URL}/api/supplies/${supplyId}/documents/${documentIndex}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Document downloaded successfully');
    } catch (error) {
      console.error('Failed to download document:', error);
      throw error;
    }
  },

  // Delete document
  async deleteSupplyDocument(supplyId, documentIndex) {
    try {
      console.log(`🗑️ Deleting document at index ${documentIndex} from supply ${supplyId}`);

      const response = await apiClient.delete(
        `/api/supplies/${supplyId}/documents/${documentIndex}`
      );

      console.log('✅ Document deleted successfully');
      return response.data.data;
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  },
};

export default SuppliesAPI;
