// src/services/equipmentApi.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://meams.onrender.com';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

const getAuthToken = () => {
  return localStorage.getItem('authToken') || 
         localStorage.getItem('adminToken') || 
         localStorage.getItem('token') ||
         sessionStorage.getItem('authToken') ||
         sessionStorage.getItem('token');
};

apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 Equipment API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
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

apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ Equipment API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error('❌ Equipment API Response Error:', error);
    
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
  async getAllEquipment() {
    try {
      const response = await apiClient.get('/api/equipment');
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

  async addEquipment(equipmentData) {
    try {
      if (!equipmentData.name?.trim()) {
        throw new Error('Equipment name is required');
      }
      if (!equipmentData.description?.trim()) {
        throw new Error('Equipment description is required');
      }
      if (!equipmentData.category?.trim()) {
        throw new Error('Equipment category is required');
      }

      const processedData = {
        name: equipmentData.name.trim(),
        description: equipmentData.description.trim(),
        category: equipmentData.category.trim(),
        usefulLife: parseInt(equipmentData.usefulLife) || 0,
        amount: parseFloat(equipmentData.amount) || 0,
        location: equipmentData.location?.trim() || '',
        status: equipmentData.status || 'Operational',
        itemCode: equipmentData.itemCode?.trim() || '',
        unit_price: parseFloat(equipmentData.unit_price) || 0,
        supplier: equipmentData.supplier?.trim() || '',
        date: equipmentData.date || '',
        image_data: equipmentData.image_data || null,
        image_filename: equipmentData.image_filename || null,
        image_content_type: equipmentData.image_content_type || null,
      };

      Object.keys(processedData).forEach(key => {
        if (key !== 'date' && key !== 'image_data' && processedData[key] === '') {
          delete processedData[key];
        }
      });

      const response = await apiClient.post('/api/equipment', processedData);
      return response.data.data || response.data;

    } catch (error) {
      console.error('Failed to add equipment:', error);
      throw error;
    }
  },

  async uploadEquipmentImage(equipmentId, imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const token = getAuthToken();
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/equipment/${equipmentId}/image`, {
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
      console.error('Failed to upload equipment image:', error);
      throw error;
    }
  },

  async updateEquipmentRepair(equipmentId, repairData) {
    try {
      if (!equipmentId) {
        throw new Error('Equipment ID is required');
      }
      
      if (!repairData.repairDate) {
        throw new Error('Repair date is required');
      }
      
      if (!repairData.repairDetails?.trim()) {
        throw new Error('Repair details are required');
      }

      console.log(`Updating equipment repair ${equipmentId}:`, repairData);
      
      const response = await apiClient.put(`/api/equipment/${equipmentId}/repair`, repairData);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Failed to update equipment repair:', error);
      throw error;
    }
  },

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

  async addEquipmentReport(equipmentId, reportData) {
    try {
      if (!equipmentId) {
        throw new Error('Equipment ID is required');
      }
      
      if (!reportData.reportDetails?.trim()) {
        throw new Error('Report details are required');
      }
      
      if (!reportData.reportDate) {
        throw new Error('Report date is required');
      }

      console.log(`Adding report to equipment ${equipmentId}:`, reportData);
      
      const response = await apiClient.put(`/api/equipment/${equipmentId}/report`, reportData);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Failed to add equipment report:', error);
      throw error;
    }
  },

  // ========================================
  // DOCUMENT MANAGEMENT METHODS
  // ========================================

  async uploadEquipmentDocument(equipmentId, file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      if (!token) throw new Error('No authentication token found.');

      console.log(`📤 Uploading document "${file.name}" to equipment ${equipmentId}`);

      const response = await fetch(`${API_BASE_URL}/api/equipment/${equipmentId}/documents`, {
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

  async getEquipmentDocuments(equipmentId) {
    try {
      console.log(`📥 Fetching documents for equipment ${equipmentId}`);
      const response = await apiClient.get(`/api/equipment/${equipmentId}/documents`);
      console.log(`✅ Found ${response.data.data.length} documents`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      throw error;
    }
  },

  getEquipmentDocumentUrl(equipmentId, documentIndex) {
    const token = getAuthToken();
    return `${API_BASE_URL}/api/equipment/${equipmentId}/documents/${documentIndex}?token=${encodeURIComponent(token)}`;
  },

  async downloadEquipmentDocument(equipmentId, documentIndex, filename) {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('No authentication token found.');

      console.log(`📥 Downloading document: ${filename}`);

      const response = await fetch(
        `${API_BASE_URL}/api/equipment/${equipmentId}/documents/${documentIndex}`,
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

  async deleteEquipmentDocument(equipmentId, documentIndex) {
    try {
      console.log(`🗑️ Deleting document at index ${documentIndex} from equipment ${equipmentId}`);

      const response = await apiClient.delete(
        `/api/equipment/${equipmentId}/documents/${documentIndex}`
      );

      console.log('✅ Document deleted successfully');
      return response.data.data;
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  },

  // ========================================
  // QR CODE REAL-TIME SCANNING METHODS
  // ========================================

  /**
   * Trigger a scan event for an equipment item
   * This simulates scanning a QR code and returns current equipment data
   */
  async scanEquipment(equipmentId) {
    try {
      console.log(`📱 Scanning equipment QR code: ${equipmentId}`);
      
      const response = await fetch(`${API_BASE_URL}/api/equipment/scan/${equipmentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to scan equipment');
      }

      const result = await response.json();
      console.log('✅ Equipment scanned successfully:', result.data);
      return result.data;
    } catch (error) {
      console.error('Failed to scan equipment:', error);
      throw error;
    }
  },

  /**
   * Start listening for real-time scan events using Server-Sent Events
   * Returns an EventSource object that emits 'message' events
   */
  createScanListener(equipmentId, onScan, onError) {
    console.log(`👂 Starting scan listener for equipment ${equipmentId}`);
    
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/equipment/listen/${equipmentId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('✅ Connected to scan listener');
          return;
        }
        
        console.log('📱 Equipment scanned:', data);
        if (onScan) {
          onScan(data);
        }
      } catch (error) {
        console.error('Error parsing scan event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ Scan listener error:', error);
      if (onError) {
        onError(error);
      }
    };

    return eventSource;
  },

  /**
   * Stop listening for scan events
   */
  closeScanListener(eventSource) {
    if (eventSource) {
      eventSource.close();
      console.log('🛑 Scan listener closed');
    }
  },

  isAuthenticated() {
    return !!getAuthToken();
  },

  setAuthToken(token) {
    localStorage.setItem('authToken', token);
    console.log('🔑 Auth token set manually');
  },

  getApiConfig() {
    return {
      baseURL: API_BASE_URL,
      timeout: apiClient.defaults.timeout,
      authenticated: this.isAuthenticated()
    };
  }
};

export default EquipmentAPI;