import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';
import SuppliesAPI from './suppliesApi'; 
import DocumentViewer from './DocumentViewer';
import supplyThresholdManager from './SupplyThresholdManager'; 
import { useTheme } from './ThemeContext'; 
import { useAuth } from './AuthContext';
import './SuppliesPage.css';

function SuppliesPage() {
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const { theme } = useTheme(); 
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [newItem, setNewItem] = useState({ 
    itemCode: '', 
    stockNo: '',
    itemName: '', 
    quantity: '', 
    category: '',
    description: '',
    unit: '', 
    location: '', 
    status: 'Normal', 
    date: '',
    itemPicture: null
  });
  const [suppliesData, setSuppliesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isItemOverviewOpen, setIsItemOverviewOpen] = useState(false);
  
  // QR Code states
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [qrCodeItem, setQrCodeItem] = useState(null);
  const [qrScanEvents, setQrScanEvents] = useState([]);
  const [isListeningForScans, setIsListeningForScans] = useState(false);

  // State for Update Quantity Modal
  const [isUpdateQuantityModalOpen, setIsUpdateQuantityModalOpen] = useState(false);
  const [quantityUpdateForm, setQuantityUpdateForm] = useState({
    date: '',
    receipt: '',
    issue: '',
    balance: ''
  });

  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [documentFiles, setDocumentFiles] = useState([]);
  const [docDragActive, setDocDragActive] = useState(false);

  // NEW: State for Edit Item Modal
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editItemForm, setEditItemForm] = useState({
    itemCode: '',
    stockNo: '',
    itemName: '',
    quantity: '',
    category: '',
    description: '',
    unit: '',
    location: '',
    status: '',
    date: ''
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Threshold management states
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholdForm, setThresholdForm] = useState({
    type: 'category',
    category: '',
    itemId: '',
    understock: '',
    overstock: ''
  });
  const [statusStats, setStatusStats] = useState({
    total: 0,
    understock: 0,
    normal: 0,
    overstock: 0
  });
  const [recommendations, setRecommendations] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  const categories = ['Sanitary Supply', 'Office Supply', 'Construction Supply', 'Electrical Supply'];
  
  // Define unit options
  const unitOptions = ['piece', 'pack', 'box', 'bottle', 'gallon', 'set', 'roll', 'bag', 'meter', 'ream'];
  
  // Status options
  const statusOptions = ['Understock', 'Normal', 'Overstock'];

  useEffect(() => {
    loadSupplies();
  }, []);

  // Reset to first page when search term or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  // Listen for status change events with better notifications
  useEffect(() => {
    const handleStatusChange = (event) => {
      const { item, oldStatus, newStatus, quantity, thresholds } = event.detail;
      console.log('📊 Status changed:', event.detail);
      
      const urgency = supplyThresholdManager.calculateUrgency(item);
      const urgencyEmoji = urgency === 'critical' ? '🚨' : urgency === 'high' ? '⚠️' : '📋';
      
      if (window.Notification && Notification.permission === 'granted') {
        new Notification(`${urgencyEmoji} Stock Status Changed`, {
          body: `${item.itemName}: ${oldStatus} → ${newStatus}\nCurrent: ${quantity} ${item.unit || 'units'}\nThresholds: ≤${thresholds.understock} | ≥${thresholds.overstock}`,
          icon: '/favicon.ico'
        });
      }
      
      const updatedRecs = supplyThresholdManager.generateRecommendations(suppliesData);
      setRecommendations(updatedRecs);
    };

    const handleBulkStatusChange = (event) => {
      const { changedItems, totalItems } = event.detail;
      console.log('📊 Bulk status change:', event.detail);
      
      // Show bulk change notification
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('📊 Bulk Status Update', {
          body: `${changedItems.length} out of ${totalItems} items had status changes`,
          icon: '/favicon.ico'
        });
      }
      
      const updatedRecs = supplyThresholdManager.generateRecommendations(suppliesData);
      setRecommendations(updatedRecs);
    };

    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    window.addEventListener('statusChanged', handleStatusChange);
    window.addEventListener('bulkStatusChanged', handleBulkStatusChange);

    return () => {
      window.removeEventListener('statusChanged', handleStatusChange);
      window.removeEventListener('bulkStatusChanged', handleBulkStatusChange);
    };
  }, [suppliesData]);

  // Load supplies from database with real-time status calculation
  const loadSupplies = async () => {
  try {
    setLoading(true);
    const supplies = await SuppliesAPI.getAllSupplies();

    const transformedSupplies = supplies.map(supply => {
      let itemCode = supply.itemCode;
      if (!itemCode) {
        const categoryPrefix = supply.category ? supply.category.substring(0, 3).toUpperCase() : 'SUP';
        const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        itemCode = `${categoryPrefix}-${randomNum}`;
      }

      return {
        _id: supply._id,
        itemCode: itemCode,
        stockNo: supply.supplier || Math.floor(Math.random() * 100).toString(),
        quantity: supply.quantity,
        itemName: supply.name,
        category: supply.category,
        description: supply.description || '',
        unit: supply.unit || 'piece',
        location: supply.location || '',
        status: supply.status || 'Normal',
        date: supply.date || '',
        has_image: supply.image_data ? true : false,
        image_data: supply.image_data || null,
        transactionHistory: supply.transactionHistory || []
      };
    });

    // Apply real-time status calculation
    const suppliesWithUpdatedStatus = supplyThresholdManager.updateMultipleItemsStatus(transformedSupplies);
    
    // Update statistics
    const stats = supplyThresholdManager.getStatusStatistics(suppliesWithUpdatedStatus);
    setStatusStats(stats);
    
    // Generate recommendations
    const recs = supplyThresholdManager.generateRecommendations(suppliesWithUpdatedStatus);
    setRecommendations(recs);

    setSuppliesData(suppliesWithUpdatedStatus);
    setError(null);
    
    console.log('📊 Status Statistics:', stats);
    console.log('💡 Recommendations:', recs.length);
    
  } catch (err) {
    console.error('Failed to load supplies:', err);
    setError('Failed to load supplies. Please try again.');
  } finally {
    setLoading(false);
  }
};

  // Delete supply function
  const handleDeleteSupply = async (supplyId, supplyName) => {
    if (!window.confirm(`Are you sure you want to delete "${supplyName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await SuppliesAPI.deleteSupply(supplyId);
      
      // Remove from local state
      setSuppliesData(prevData => prevData.filter(item => item._id !== supplyId));
      
      // Close overview modal if the deleted item was selected
      if (selectedItem && selectedItem._id === supplyId) {
        handleCloseItemOverview();
      }
      
      alert(`Supply "${supplyName}" deleted successfully!`);
      console.log('✅ Supply deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting supply:', error);
      alert(`Failed to delete supply: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories including database data
  const uniqueCategories = ['All Categories', ...new Set(suppliesData.map(item => item.category))];

  // Filter supplies 
  const filteredSupplies = suppliesData.filter(item => {
    const matchesSearch = item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredSupplies.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSupplies = filteredSupplies.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  const generatePageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  const handleDocDrag = (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.type === "dragenter" || e.type === "dragover") {
    setDocDragActive(true);
  } else if (e.type === "dragleave") {
    setDocDragActive(false);
  }
};

const handleDocDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  setDocDragActive(false);
  
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const files = Array.from(e.dataTransfer.files);
    setDocumentFiles(prev => [...prev, ...files]);
  }
};

const handleDocFileChange = (e) => {
  if (e.target.files && e.target.files.length > 0) {
    const files = Array.from(e.target.files);
    setDocumentFiles(prev => [...prev, ...files]);
  }
};

const removeDocumentFile = (index) => {
  setDocumentFiles(prev => prev.filter((_, i) => i !== index));
};

const handleViewDocuments = () => {
  if (selectedItem) {
    setIsDocumentViewerOpen(true);
  }
};

const handleCloseDocumentViewer = () => {
  setIsDocumentViewerOpen(false);
};

  // QR Code generation function
  const generateQRCode = async (item) => {
  try {
    // Get your backend URL
    const BACKEND_URL = process.env.REACT_APP_API_URL;
    
    // Create a simple URL that contains only the item ID
    // The backend will fetch CURRENT data when scanned
    const scanUrl = `${BACKEND_URL}/api/supplies/scan/${item._id}`;
    
    console.log('📱 Generating QR code with URL:', scanUrl);
    
    // Generate QR code with just the URL
    const qrDataURL = await QRCode.toDataURL(scanUrl, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H'
    });

    // Update state
    setQrCodeDataURL(qrDataURL);
    setQrCodeItem(item);
    setIsQRModalOpen(true);
    
    console.log('✅ QR Code generated successfully');
    
  } catch (error) {
    console.error('❌ QR code generation failed:', error);
    alert('Failed to generate QR code: ' + error.message);
  }
};


const startListeningForScans = (scanId) => {
  const BACKEND_URL = process.env.REACT_APP_API_URL;
  
  // Use Server-Sent Events (SSE) for real-time updates
  const eventSource = new EventSource(`${BACKEND_URL}/api/qr/listen/${scanId}`);
  
  eventSource.onmessage = (event) => {
    const scanData = JSON.parse(event.data);
    console.log('📱 QR Code scanned!', scanData);
    
    // Add to scan events
    setQrScanEvents(prev => [...prev, scanData]);
    
    // Show notification
    if (Notification.permission === 'granted') {
      new Notification('QR Code Scanned!', {
        body: `${scanData.itemName} was scanned at ${new Date(scanData.timestamp).toLocaleTimeString()}`,
        icon: '/favicon.ico'
      });
    }
    
    // Play sound (optional)
    const audio = new Audio('/scan-sound.mp3');
    audio.play().catch(e => console.log('Could not play sound'));
  };
  
  eventSource.onerror = (error) => {
    console.error('❌ SSE connection error:', error);
    eventSource.close();
  };
  
  // Store the eventSource so we can close it later
  window.currentEventSource = eventSource;
  setIsListeningForScans(true);
};

// ===== ADD THIS CLEANUP FUNCTION =====
const stopListeningForScans = () => {
  if (window.currentEventSource) {
    window.currentEventSource.close();
    window.currentEventSource = null;
    setIsListeningForScans(false);
    console.log('🛑 Stopped listening for scans');
  }
};

// ===== ADD THIS useEffect FOR CLEANUP =====
useEffect(() => {

  return () => {
    stopListeningForScans();
  };
}, []);

  // FOR STOCK CARD //
const [isStockCardOpen, setIsStockCardOpen] = useState(false);

  const handleViewStockCard = (item) => {
  setSelectedItem(item);
  setIsStockCardOpen(true);
};

const handleCloseStockCard = () => {
  setIsStockCardOpen(false);
};

  const downloadQRCode = () => {
    if (!qrCodeDataURL || !qrCodeItem) return;
    const link = document.createElement('a');
    link.download = `QR_${qrCodeItem.itemCode}_${qrCodeItem.itemName.replace(/\s+/g, '_')}.png`;
    link.href = qrCodeDataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printQRCode = () => {
    if (!qrCodeDataURL || !qrCodeItem) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${qrCodeItem.itemName}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 20px;
              margin: 0;
            }
            .qr-container {
              display: inline-block;
              border: 2px solid #333;
              padding: 20px;
              margin: 20px;
            }
            .item-info {
              margin-bottom: 20px;
            }
            .item-info h2 {
              margin: 0 0 10px 0;
              color: #333;
            }
            .item-details {
              text-align: left;
              margin: 10px 0;
            }
            .item-details p {
              margin: 5px 0;
              font-size: 14px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="item-info">
              <h2>${qrCodeItem.itemName}</h2>
              <div class="item-details">
                <p><strong>Item Code:</strong> ${qrCodeItem.itemCode}</p>
                <p><strong>Stock No:</strong> ${qrCodeItem.stockNo}</p>
                <p><strong>Category:</strong> ${qrCodeItem.category}</p>
                <p><strong>Unit:</strong> ${qrCodeItem.unit}</p>
                <p><strong>Location:</strong> ${qrCodeItem.location}</p>
                <p><strong>Status:</strong> ${qrCodeItem.status}</p>
                <p><strong>Date:</strong> ${qrCodeItem.date || 'Not specified'}</p>
                <p><strong>Description:</strong> ${qrCodeItem.description || 'N/A'}</p>
              </div>
            </div>
            <img src="${qrCodeDataURL}" alt="QR Code for ${qrCodeItem.itemName}" />
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleOverlayToggle = () => {
    setIsOverlayOpen(!isOverlayOpen);
    if (isOverlayOpen) {
      setNewItem({ 
        itemCode: '', 
        stockNo: '',
        itemName: '', 
        quantity: '', 
        category: '',
        description: '',
        unit: '', 
        location: '', 
        status: 'Normal', 
        date: '',
        itemPicture: null
      });
      setDocumentFiles([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewItem({ ...newItem, itemPicture: file });
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setNewItem({ ...newItem, itemPicture: file });
    }
  };

  const handleImageUpload = async (supplyId, imageFile) => {
  if (!imageFile) return;
  
  try {
    setLoading(true);
    await SuppliesAPI.uploadSupplyImage(supplyId, imageFile);
    
    // Update local state to show image
    setSuppliesData(prevData =>
      prevData.map(item =>
        item._id === supplyId ? { ...item, has_image: true } : item
      )
    );
    
    if (selectedItem && selectedItem._id === supplyId) {
      setSelectedItem(prev => ({ ...prev, has_image: true }));
    }
    
    alert('Image uploaded successfully!');
  } catch (error) {
    console.error('Error uploading image:', error);
    alert(`Failed to upload image: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

  const generateItemCode = () => {
    const categoryPrefix = newItem.category ? newItem.category.substring(0, 3).toUpperCase() : 'GEN';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const generatedCode = `${categoryPrefix}-${randomNum}`;
    setNewItem({ ...newItem, itemCode: generatedCode });
  };

  // Updated handleAddItem to save to database
  const handleAddItem = async () => {
  if (!newItem.itemName || !newItem.quantity || !newItem.category || !newItem.unit) {
    alert('Please fill in all required fields (Item Name, Quantity, Category, Unit)');
    return;
  }

  try {
    setLoading(true);

    let imageBase64 = null;
    if (newItem.itemPicture) {
      imageBase64 = await convertFileToBase64(newItem.itemPicture);
      console.log("Base64 image preview:", imageBase64.substring(0, 100));
    }

    const tempItem = {
      itemName: newItem.itemName,
      category: newItem.category,
      quantity: parseInt(newItem.quantity)
    };

    const calculatedStatus = supplyThresholdManager.calculateStatus(tempItem);

    const initialTransactionHistory = [{
      date: newItem.date || new Date().toISOString().slice(0, 10),
      receipt: parseInt(newItem.quantity),
      issue: null,
      balance: parseInt(newItem.quantity),
      timestamp: new Date().toISOString()
    }];

    const supplyData = {
      name: newItem.itemName,
      category: newItem.category,
      description: newItem.description,
      quantity: parseInt(newItem.quantity),
      unit_price: 0,
      supplier: newItem.stockNo || '',
      location: newItem.location,
      status: calculatedStatus,
      unit: newItem.unit,
      date: newItem.date,
      itemPicture: imageBase64,
      transactionHistory: initialTransactionHistory
    };

    const response = await SuppliesAPI.addSupply(supplyData);
    let savedSupply = response;

    // Upload documents if any were selected
    if (documentFiles.length > 0) {
      console.log(`📤 Uploading ${documentFiles.length} documents...`);
      for (const file of documentFiles) {
        try {
          await SuppliesAPI.uploadSupplyDocument(savedSupply._id, file);
          console.log(`✅ Uploaded: ${file.name}`);
        } catch (err) {
          console.error(`❌ Failed to upload ${file.name}:`, err);
        }
      }
      
      // Reload supply to get documents
      const updatedSupply = await SuppliesAPI.getSupplyById(savedSupply._id);
      savedSupply = updatedSupply;
    }

    const newSupplyItem = {
      _id: savedSupply._id,
      itemCode: savedSupply.itemCode || newItem.itemCode || `GEN-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      stockNo: newItem.stockNo || Math.floor(Math.random() * 100).toString(),
      quantity: parseInt(newItem.quantity),
      itemName: newItem.itemName,
      category: newItem.category,
      description: newItem.description,
      unit: newItem.unit,
      location: newItem.location,
      status: calculatedStatus,
      date: newItem.date,
      has_image: !!savedSupply.image_data,
      image_data: savedSupply.image_data,
      documents: savedSupply.documents || [],
      transactionHistory: savedSupply.transactionHistory || []
    };

    setSuppliesData([...suppliesData, newSupplyItem]);
    
    const updatedSupplies = [...suppliesData, newSupplyItem];
    const stats = supplyThresholdManager.getStatusStatistics(updatedSupplies);
    setStatusStats(stats);
    
    alert(`Supply added successfully!\nStatus: ${calculatedStatus}\nDocuments uploaded: ${documentFiles.length}`);
    
    setDocumentFiles([]);
    handleOverlayToggle();

  } catch (error) {
    console.error('Error adding supply:', error);
    alert(`Failed to add supply: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

// Add this helper function to convert file to base64
const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Helper function to pluralize units
const pluralizeUnit = (quantity, unit) => {
  if (!unit) return quantity === 1 ? 'unit' : 'units';
  if (quantity === 1) return unit;
  
  // Don't add 's' if already plural
  if (unit.endsWith('s')) return unit;
  
  // Handle special cases
  const specialPlurals = {
    'box': 'boxes',
    'piece': 'pieces',
    'pack': 'packs',
    'bottle': 'bottles',
    'gallon': 'gallons',
    'set': 'sets',
    'roll': 'rolls',
    'bag': 'bags',
    'meter': 'meters',
    'ream': 'reams'
  };
  
  return specialPlurals[unit.toLowerCase()] || unit + 's';
};

  // Threshold management functions
  const handleOpenThresholdModal = () => {
    setThresholdForm({
      type: 'category',
      category: categories[0],
      itemId: '',
      understock: '',
      overstock: ''
    });
    setShowThresholdModal(true);
  };

  const handleCloseThresholdModal = () => {
    setShowThresholdModal(false);
  };

  const handleThresholdInputChange = (e) => {
    const { name, value } = e.target;
    setThresholdForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveThresholds = () => {
    const { type, category, itemId, understock, overstock } = thresholdForm;
    
    if (!understock || !overstock) {
      alert('Please enter both understock and overstock thresholds');
      return;
    }
    
    const thresholds = {
      understock: parseInt(understock),
      overstock: parseInt(overstock)
    };
    
    const errors = supplyThresholdManager.validateThresholds(thresholds);
    if (errors.length > 0) {
      alert('Validation errors:\n' + errors.join('\n'));
      return;
    }
    
    if (type === 'category') {
      supplyThresholdManager.setCategoryThresholds(category, thresholds);
      alert(`Thresholds updated for category: ${category}`);
    } else {
      const item = suppliesData.find(item => item._id === itemId);
      if (item) {
        supplyThresholdManager.setItemThresholds(item, thresholds);
        alert(`Thresholds updated for item: ${item.itemName}`);
      }
    }
    
    // Recalculate all statuses with new thresholds
    const updatedSupplies = supplyThresholdManager.updateMultipleItemsStatus(suppliesData);
    setSuppliesData(updatedSupplies);
    
    // Update statistics
    const stats = supplyThresholdManager.getStatusStatistics(updatedSupplies);
    setStatusStats(stats);
    
    handleCloseThresholdModal();
  };

  const handleShowRecommendations = () => {
    setShowRecommendations(true);
  };

  const handleCloseRecommendations = () => {
    setShowRecommendations(false);
  };

  // Status color function (3 levels only)
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'understock': return '#ef4444'; // Red for understock
      case 'normal': return '#10b981'; // Green for normal
      case 'overstock': return '#f59e0b'; // Orange for overstock
      default: return '#6b7280'; // Gray for unknown
    }
  };

  // Get current thresholds for selected item
  const getCurrentThresholds = (item) => {
    if (!item) return null;
    return supplyThresholdManager.getThresholds(item);
  };

  // Get detailed status information with trends and percentages
  const getDetailedStatusInfo = (item) => {
    if (!item) return null;
    return supplyThresholdManager.calculateDetailedStatus(item);
  };

  // Get trend indicator icon
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing':
        return <span style={{ color: '#10b981', fontSize: '12px' }}>📈 Increasing</span>;
      case 'decreasing':
        return <span style={{ color: '#ef4444', fontSize: '12px' }}>📉 Decreasing</span>;
      case 'stable':
      default:
        return <span style={{ color: '#6b7280', fontSize: '12px' }}>➡️ Stable</span>;
    }
  };

  // Get urgency indicator
  const getUrgencyIndicator = (urgency) => {
    switch (urgency) {
      case 'critical':
        return <span style={{ color: '#dc2626', fontSize: '10px', fontWeight: 'bold' }}>🚨 CRITICAL</span>;
      case 'high':
        return <span style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 'bold' }}>⚠️ HIGH</span>;
      case 'medium':
        return <span style={{ color: '#8b5cf6', fontSize: '10px' }}>📋 MEDIUM</span>;
      case 'low':
      default:
        return <span style={{ color: '#10b981', fontSize: '10px' }}>✅ LOW</span>;
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsItemOverviewOpen(true);
  };

  const handleCloseItemOverview = () => {
    setIsItemOverviewOpen(false);
    setSelectedItem(null);
  };

  const handleCloseQRModal = () => {
    setIsQRModalOpen(false);
    setQrCodeDataURL('');
    setQrCodeItem(null);
  };

  // Update Quantity Module Functions
  const handleOpenUpdateQuantity = () => {
    if (selectedItem) {
      setQuantityUpdateForm({
        date: new Date().toISOString().slice(0, 10), 
        receipt: '',
        issue: '',
        balance: selectedItem.quantity 
      });
      setIsUpdateQuantityModalOpen(true);
    }
  };

  const handleCloseUpdateQuantity = () => {
    setIsUpdateQuantityModalOpen(false);
  };

  const handleQuantityInputChange = (e) => {
    const { name, value } = e.target;
    setQuantityUpdateForm(prev => {
      const updatedForm = { ...prev, [name]: value };
      // Calculate balance dynamically
      const currentQuantity = selectedItem ? selectedItem.quantity : 0;
      const receipt = parseInt(updatedForm.receipt) || 0;
      const issue = parseInt(updatedForm.issue) || 0;
      updatedForm.balance = currentQuantity + receipt - issue;
      return updatedForm;
    });
  };

  const handleUpdateQuantity = async () => {
    if (!selectedItem) return;

    const { date, receipt, issue, balance } = quantityUpdateForm;

    if (!date || (receipt === '' && issue === '')) {
      alert('Please enter a date and either a receipt or an issue quantity.');
      return;
    }

    const receiptQty = parseInt(receipt) || 0;
    const issueQty = parseInt(issue) || 0;
    const newQuantity = parseInt(balance);

    if (isNaN(newQuantity) || newQuantity < 0) {
      alert('Invalid quantity. Balance cannot be negative.');
      return;
    }

    try {
      setLoading(true);

      // Initialize transaction history if it doesn't exist
      const currentHistory = selectedItem.transactionHistory || [];

      // Create transaction record
      const transaction = {
        date: date,
        receipt: receiptQty > 0 ? receiptQty : null,
        issue: issueQty > 0 ? issueQty : null,
        balance: newQuantity,
        timestamp: new Date().toISOString()
      };

      // Add transaction to history
      const updatedHistory = [...currentHistory, transaction];

      // Create updated item with new quantity, date, and transaction history
      const updatedItem = {
        ...selectedItem,
        quantity: newQuantity,
        date: date,
        transactionHistory: updatedHistory
      };

      // Calculate new status based on thresholds
      const itemWithNewStatus = supplyThresholdManager.updateItemStatus(updatedItem);

      // Update API with new quantity, date, status, and transaction history
      await SuppliesAPI.updateSupply(selectedItem._id, {
        quantity: newQuantity,
        date: date,
        status: itemWithNewStatus.status,
        transactionHistory: updatedHistory
      });

      // Update local state with new quantity, status, and transaction history
      setSuppliesData(prevData =>
        prevData.map(item =>
          item._id === selectedItem._id
            ? { ...item, quantity: newQuantity, date: date, status: itemWithNewStatus.status, transactionHistory: updatedHistory }
            : item
        )
      );

      // Update selected item in overview
      setSelectedItem(prev => ({
        ...prev,
        quantity: newQuantity,
        date: date,
        status: itemWithNewStatus.status,
        transactionHistory: updatedHistory
      }));

      // Update statistics
      const updatedSupplies = suppliesData.map(item =>
        item._id === selectedItem._id
          ? { ...item, quantity: newQuantity, date: date, status: itemWithNewStatus.status, transactionHistory: updatedHistory }
          : item
      );
      const stats = supplyThresholdManager.getStatusStatistics(updatedSupplies);
      setStatusStats(stats);

      // Show status change notification if status changed
      if (itemWithNewStatus.statusChanged) {
        alert(`Quantity updated successfully!\nStatus changed to: ${itemWithNewStatus.status}`);
      } else {
        alert('Quantity updated successfully!');
      }

      handleCloseUpdateQuantity();
    } catch (err) {
      console.error('Error updating quantity:', err);
      alert('Failed to update quantity. Please try again.');
    } finally {
      setLoading(false);
    }
  };

const handleRemoveImage = async (supplyId) => {
  if (!window.confirm('Are you sure you want to remove this image?')) return;

  try {
    setLoading(true);

    // Update the supply to remove image data on backend
    await SuppliesAPI.updateSupply(supplyId, { 
      image_data: null,
      image_filename: null,
      image_content_type: null
    });

    // Update local state to reflect image removal
    setSuppliesData(prevData =>
      prevData.map(item =>
        item._id === supplyId ? { 
          ...item, 
          has_image: false, 
          image_data: null 
        } : item
      )
    );

    if (selectedItem && selectedItem._id === supplyId) {
      setSelectedItem(prev => ({ 
        ...prev, 
        has_image: false, 
        image_data: null 
      }));
    }

    alert('Image removed successfully!');
  } catch (error) {
    console.error('Error removing image:', error);
    alert(`Failed to remove image: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

  // Edit Item Module Functions
  const handleOpenEditItem = () => {
    if (selectedItem) {
      setEditItemForm({
        itemCode: selectedItem.itemCode || '',
        stockNo: selectedItem.stockNo || '',
        itemName: selectedItem.itemName || '',
        quantity: selectedItem.quantity || '',
        category: selectedItem.category || '',
        description: selectedItem.description || '',
        unit: selectedItem.unit || '',
        location: selectedItem.location || '',
        status: selectedItem.status || 'Normal',
        date: selectedItem.date || ''
      });
      setIsEditItemModalOpen(true);
    }
  };

  const handleCloseEditItem = () => {
    setIsEditItemModalOpen(false);
  };

  const handleEditItemInputChange = (e) => {
    const { name, value } = e.target;
    setEditItemForm(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;

    try {
      setLoading(true);
      
      // Create updated item object
      const updatedItem = {
        ...selectedItem,
        itemCode: editItemForm.itemCode,
        stockNo: editItemForm.stockNo,
        itemName: editItemForm.itemName,
        quantity: parseInt(editItemForm.quantity),
        category: editItemForm.category,
        description: editItemForm.description,
        unit: editItemForm.unit,
        location: editItemForm.location,
        date: editItemForm.date
      };
      
      // Calculate new status based on thresholds
      const itemWithNewStatus = supplyThresholdManager.updateItemStatus(updatedItem);
      
      // Prepare data for API
      const updatedData = {
        name: editItemForm.itemName,
        category: editItemForm.category,
        description: editItemForm.description,
        quantity: parseInt(editItemForm.quantity),
        supplier: editItemForm.stockNo,
        location: editItemForm.location,
        status: itemWithNewStatus.status, 
        unit: editItemForm.unit,
        date: editItemForm.date,
        itemCode: editItemForm.itemCode
      };

      await SuppliesAPI.updateSupply(selectedItem._id, updatedData);

      // Update local state
      setSuppliesData(prevData =>
        prevData.map(item =>
          item._id === selectedItem._id ? itemWithNewStatus : item
        )
      );
      
      setSelectedItem(itemWithNewStatus);
      
      // Update statistics
      const updatedSupplies = suppliesData.map(item => 
        item._id === selectedItem._id ? itemWithNewStatus : item
      );
      const stats = supplyThresholdManager.getStatusStatistics(updatedSupplies);
      setStatusStats(stats);
      
      // Show status change notification if status changed
      if (itemWithNewStatus.statusChanged) {
        alert(`Item updated successfully!\nStatus changed to: ${itemWithNewStatus.status}`);
      } else {
      alert('Item updated successfully!');
      }
      
      handleCloseEditItem();
    } catch (err) {
      console.error('Error updating item:', err);
      alert('Failed to update item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (loading && suppliesData.length === 0) {
    return (
      <div className="supplies-page-container">
        <div className="loading-state">
          <h2>Loading supplies...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="supplies-page-container">
      {error && (
        <div className="error-banner" style={{
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          padding: '10px',
          marginBottom: '20px',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          {error}
          <button 
            onClick={loadSupplies}
            style={{
              marginLeft: '10px',
              padding: '5px 10px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Real-time Status Dashboard */}
      {statusStats.total > 0 && (
        <div className="status-dashboard" style={{
          background: theme === 'light' ? '#ffffff' : '#1a1a1a',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div className="status-stats" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6366f1' }}>{statusStats.total}</div>
              <div style={{ fontSize: '12px', color: '#888888' }}>Total Items</div>
            </div>
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{statusStats.normal}</div>
              <div style={{ fontSize: '12px', color: '#888888' }}>Normal</div>
            </div>
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{statusStats.understock}</div>
              <div style={{ fontSize: '12px', color: '#888888' }}>Understock</div>
            </div>
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>{statusStats.overstock}</div>
              <div style={{ fontSize: '12px', color: '#888888' }}>Overstock</div>
            </div>
          </div>
          
          <div className="dashboard-actions" style={{ display: 'flex', gap: '10px' }}>
            {currentUser?.role === 'admin' && (
            <button 
              className="action-btn"
              onClick={handleOpenThresholdModal}
              style={{ background: '#6366f1', fontSize: '12px', padding: '8px 16px' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Set Thresholds
            </button>
            )}

            {recommendations.length > 0 && (
              <button 
                className="action-btn"
                onClick={handleShowRecommendations}
                style={{ background: '#f59e0b', fontSize: '12px', padding: '8px 16px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Recommendations ({recommendations.length})
              </button>
            )}
          </div>
        </div>
      )}

      <div className="supplies-header">
        <h2 className="page-title">Supply Inventory</h2>
        <div className="table-controls">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search supplies..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 15L21 21M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="dropdown-container">
            <button 
              className="dropdown-toggle"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {selectedCategory}
              <svg className="dropdown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            {isDropdownOpen && (
              <div className="dropdown-menu">
                {uniqueCategories.map(category => (
                  <div 
                    key={category}
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedCategory(category);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {category}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items per page selector */}
          <div className="items-per-page-container">
            <span>Show:</span>
            <select 
              className="items-per-page-select" 
              value={itemsPerPage} 
              onChange={handleItemsPerPageChange}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>per page</span>
          </div>
        </div>
      </div>

      <table className="supplies-table">
        <thead>
          <tr>
            <th>ITEM CODE</th>
            <th>STOCK NO.</th>
            <th>QUANTITY</th>
            <th>STATUS</th>
            <th>ITEM NAME</th>
            <th>CATEGORY</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {paginatedSupplies.map((supply, index) => (
            <tr key={supply._id || index}>
              <td>{supply.itemCode}</td>
              <td>{supply.stockNo}</td>
              <td>{supply.quantity}</td>
              <td>
                <span 
                  style={{ 
                    color: getStatusColor(supply.status),
                    fontWeight: 'bold',
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: `${getStatusColor(supply.status)}20`
                  }}
                >
                  {supply.status}
                </span>
              </td>
              <td>
                <span 
                  className="item-name-clickable"
                  onClick={() => handleItemClick(supply)}
                >
                  {supply.itemName}
                </span>
              </td>
              <td>{supply.category}</td>
              <td>
  <div className="action-buttons-container" style={{ justifyContent: 'center' }}>
    <button 
      className="view-icon-btn"
      onClick={() => handleItemClick(supply)}
      title="View item details"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
    {currentUser?.role === 'admin' && (
      <button 
        className="delete-icon-btn"
        onClick={() => handleDeleteSupply(supply._id, supply.itemName)}
        title="Delete item"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    )}
  </div>
</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination Controls */}
      {filteredSupplies.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredSupplies.length)} of {filteredSupplies.length} entries
          </div>
          
          <div className="pagination-controls">
            <button 
              className="pagination-btn" 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            {generatePageNumbers().map((page, index) => (
              page === '...' ? (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
              ) : (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              )
            ))}
            
            <button 
              className="pagination-btn" 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <button className="add-item-button" onClick={handleOverlayToggle}>
        {loading ? 'Loading...' : 'Add Item Supply'}
      </button>

      {/* Enhanced Overlay For */}
      {isOverlayOpen && (
        <div className="overlay" onClick={handleOverlayToggle}>
          <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
            <h3>INPUT ITEM/SUPPLY DETAILS</h3>
            
            <div className="form-section">
              <div className="form-group">
                <label>ITEM CODE:</label>
                <div className="item-code-container">
                  <input 
                    type="text" 
                    name="itemCode" 
                    value={newItem.itemCode} 
                    onChange={handleInputChange}
                    placeholder="System Generated"
                    className="item-code-input"
                  />
                  <button 
                    type="button" 
                    className="generate-btn"
                    onClick={generateItemCode}
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>STOCK NO.:</label>
                <input 
                  type="text" 
                  name="stockNo" 
                  value={newItem.stockNo} 
                  onChange={handleInputChange}
                  placeholder="Input text"
                />
              </div>

              <div className="form-group">
                <label>ITEM NAME:</label>
                <input 
                  type="text" 
                  name="itemName" 
                  value={newItem.itemName} 
                  onChange={handleInputChange}
                  placeholder="Input text"
                  required
                />
              </div>

              <div className="form-group">
                <label>QUANTITY:</label>
                <input 
                  type="number" 
                  name="quantity" 
                  value={newItem.quantity} 
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  required
                />
              </div>

              {/* NEW FIELD: UNIT */}
              <div className="form-group">
                <label>UNIT: <span style={{color: 'red'}}>*</span></label>
                <div className="category-dropdown">
                  <select 
                    name="unit" 
                    value={newItem.unit} 
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Unit</option>
                    {unitOptions.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>CATEGORY:</label>
                <div className="category-dropdown">
                  <select 
                    name="category" 
                    value={newItem.category} 
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>DESCRIPTION: <span style={{color: 'red'}}>*</span></label>
                <textarea 
                  name="description" 
                  value={newItem.description || ''} 
                  onChange={handleInputChange}
                  placeholder="Enter detailed description (e.g., 'Broken display, needs repair')"
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              {/* NEW FIELD: LOCATION */}
              <div className="form-group">
                <label>LOCATION:</label>
                <input 
                  type="text" 
                  name="location" 
                  value={newItem.location} 
                  onChange={handleInputChange}
                  placeholder="Enter location (optional)"
                />
              </div>

              {/* NEW FIELD: STATUS */}
              <div className="form-group">
                <label>STATUS: <span style={{color: 'red'}}>*</span></label>
                <div className="category-dropdown">
                  <select 
                    name="status" 
                    value={newItem.status} 
                    onChange={handleInputChange}
                    required
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>DATE:</label>
                <input
                type="date"
                name="date"
                value={newItem.date}
                onChange={handleInputChange}
                className="date-input"
              />
            </div>

              <div className="form-group">
                <label>ITEM PICTURE:</label>
                <div className="file-input-container">
                  <input 
                    type="file" 
                    id="fileInput"
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.doc,.docx"
                    style={{ display: 'none' }}
                  />
                  <button 
                    type="button" 
                    className="file-input-btn"
                    onClick={() => document.getElementById('fileInput').click()}
                  >
                    Choose File
                  </button>
                  <span className="file-name">
                    {newItem.itemPicture ? newItem.itemPicture.name : 'No file chosen'}
                  </span>
                </div>
              </div>
            </div>

            <div className="upload-section">
  <h4>UPLOAD FILES (DOCUMENTS)</h4>
  <div 
    className={`file-drop-zone ${docDragActive ? 'drag-active' : ''}`}
    onDragEnter={handleDocDrag}
    onDragLeave={handleDocDrag}
    onDragOver={handleDocDrag}
    onDrop={handleDocDrop}
    onClick={() => document.getElementById('docFileInput').click()}
  >
    <input 
      type="file" 
      id="docFileInput"
      onChange={handleDocFileChange}
      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
      multiple
      style={{ display: 'none' }}
    />
    <div className="upload-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <p>Drag and Drop files here or <span className="choose-file-link">Choose file</span></p>
    <small>Supported formats: PDF, DOCX, JPEG, PNG</small>
    <small>Maximum size: 25MB</small>
  </div>
  
  {documentFiles.length > 0 && (
    <div className="selected-docs-list" style={{ marginTop: '15px' }}>
      <h5 style={{ fontSize: '14px', color: '#fff', marginBottom: '10px' }}>Selected Documents ({documentFiles.length}):</h5>
      {documentFiles.map((file, index) => (
        <div key={index} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: '#2a2a2a',
          marginBottom: '8px',
          borderRadius: '4px',
          border: '1px solid #444'
        }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '12px', color: '#fff', display: 'block' }}>{file.name}</span>
            <span style={{ fontSize: '10px', color: '#888' }}>
              {(file.size / 1024).toFixed(2)} KB
            </span>
          </div>
          <button
            type="button"
            onClick={() => removeDocumentFile(index)}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500'
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )}
</div>

            <div className="form-actions">
              <button 
                className="add-btn" 
                onClick={handleAddItem}
                disabled={loading}
              >
                {loading ? 'ADDING...' : 'ADD ITEM/SUPPLY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Overview Overlay */}
      {isItemOverviewOpen && selectedItem && (
        <div className="overlay" onClick={handleCloseItemOverview}>
          <div className="item-overview-content" onClick={(e) => e.stopPropagation()}>
            <h3>Item Overview</h3>
            
            <div className="item-overview-layout">
              <div className="item-image-section">
  {selectedItem.has_image && selectedItem.image_data ? (
  <div className="item-image-container">
    <img 
      src={selectedItem.image_data.startsWith('data:') ? selectedItem.image_data : `data:image/jpeg;base64,${selectedItem.image_data}`}
      alt={selectedItem.itemName}
      className="item-image"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'block';
      }}
    />
    <div className="image-error-fallback" style={{display: 'none'}}>
      <div className="placeholder-box">Image Error</div>
    </div>
  </div>
) : (
  <div className="no-image-container">
    <div className="placeholder-box">No Image</div>
  </div>
)}
  </div>
              
              <div className="item-details">
                <div className="detail-row">
                  <span className="detail-label">Item Name:</span>
                  <span className="detail-value">{selectedItem.itemName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Item Code:</span>
                  <span className="detail-value">{selectedItem.itemCode}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Stock No.:</span>
                  <span className="detail-value">{selectedItem.stockNo}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">{selectedItem.category}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Quantity:</span>
                  <span className="detail-value">{selectedItem.quantity}</span>
                </div>
                {/* NEW FIELD DISPLAY: UNIT */}
                <div className="detail-row">
                  <span className="detail-label">Unit:</span>
                  <span className="detail-value">{selectedItem.unit || 'N/A'}</span>
                </div>
                {/* NEW FIELD DISPLAY: LOCATION */}
                <div className="detail-row">
                  <span className="detail-label">Location:</span>
                  <span className="detail-value">{selectedItem.location || 'N/A'}</span>
                </div>
                {/* STATUS with detailed information */}
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <div className="detail-value" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: getStatusColor(selectedItem.status), fontWeight: 'bold' }}>
                      {selectedItem.status || 'N/A'}
                    </span>
                    {(() => {
                      const detailedStatus = getDetailedStatusInfo(selectedItem);
                      return detailedStatus ? (
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <span>Stock Level: {detailedStatus.percentage}%</span>
                            {getTrendIcon(detailedStatus.trend)}
                            {getUrgencyIndicator(detailedStatus.urgency)}
                </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                
                {/* Show current thresholds */}
                {(() => {
                  const thresholds = getCurrentThresholds(selectedItem);
                  return thresholds ? (
                    <div className="detail-row">
                      <span className="detail-label">Thresholds:</span>
                      <span className="detail-value" style={{ fontSize: '12px', color: '#888' }}>
                        Understock: ≤{thresholds.understock} | Overstock: ≥{thresholds.overstock}
                      </span>
                    </div>
                  ) : null;
                })()}
                <div className="detail-row">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">{selectedItem.date || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{selectedItem.description || '500ml'}</span>
                </div>
              </div>
            </div>
            
            <div className="item-overview-actions">
              <button 
                className="action-btn view-stock-btn"
                onClick={() => handleViewStockCard(selectedItem)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                View Stock Card ▦
              </button>
              
              <button 
  className="action-btn view-docs-btn"
  onClick={handleViewDocuments}
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
  Documents ⌕
</button>
              
              <button 
                className="action-btn qr-code-btn"
                onClick={() => generateQRCode(selectedItem)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                  <rect x="7" y="7" width="3" height="3" fill="currentColor"/>
                  <rect x="14" y="7" width="3" height="3" fill="currentColor"/>
                  <rect x="7" y="14" width="3" height="3" fill="currentColor"/>
                  <rect x="14" y="14" width="3" height="3" fill="currentColor"/>
                  <rect x="11" y="11" width="2" height="2" fill="currentColor"/>
                </svg>
                Generate QR-code ⚏
              </button>

              {/* Update Quantity Button */}
              <button 
                className="action-btn update-quantity-btn"
                onClick={handleOpenUpdateQuantity}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Update Quantity
              </button>

              {/* Edit Item Button */}
              <button 
                className="action-btn edit-item-btn"
                onClick={handleOpenEditItem}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit Item
              </button>
              
            </div>
            
            <button className="close-overview-btn" onClick={handleCloseItemOverview}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* Update Quantity Modal */}
      {isUpdateQuantityModalOpen && selectedItem && (
        <div className="overlay" onClick={handleCloseUpdateQuantity}>
          <div className="small-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="small-modal-close-btn" onClick={handleCloseUpdateQuantity}>×</button>
            <h4>Update Quantity for {selectedItem.itemName}</h4>
            <div className="form-section">
              <div className="form-group">
                <label>Date:</label>
                <input
                  type="date"
                  name="date"
                  value={quantityUpdateForm.date}
                  onChange={handleQuantityInputChange}
                  className="date-input"
                  required
                />
              </div>
              <div className="form-group">
                <label>Receipt (Add):</label>
                <input
                  type="number"
                  name="receipt"
                  value={quantityUpdateForm.receipt}
                  onChange={handleQuantityInputChange}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Issue (Subtract):</label>
                <input
                  type="number"
                  name="issue"
                  value={quantityUpdateForm.issue}
                  onChange={handleQuantityInputChange}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Balance:</label>
                <input
                  type="number"
                  name="balance"
                  value={quantityUpdateForm.balance}
                  readOnly
                  className="item-code-input"
                />
              </div>
            </div>
            <div className="small-modal-actions">
              <button className="action-btn cancel-btn" onClick={handleCloseUpdateQuantity}>
                Cancel
              </button>
              <button className="action-btn update-btn" onClick={handleUpdateQuantity}>
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditItemModalOpen && selectedItem && (
        <div className="overlay" onClick={handleCloseEditItem}>
          <div className="overlay-content" onClick={(e) => e.stopPropagation()}> {/* Reusing overlay-content for consistency */}
            <button className="close-overview-btn" onClick={handleCloseEditItem}>×</button>
            <h3>Edit Item: {selectedItem.itemName}</h3>
            <div className="form-section">
              <div className="form-group">
                <label>ITEM CODE:</label>
                <input
                  type="text"
                  name="itemCode"
                  value={editItemForm.itemCode}
                  onChange={handleEditItemInputChange}
                  placeholder="Item Code"
                />
              </div>
              <div className="form-group">
                <label>STOCK NO.:</label>
                <input
                  type="text"
                  name="stockNo"
                  value={editItemForm.stockNo}
                  onChange={handleEditItemInputChange}
                  placeholder="Stock No."
                />
              </div>
              <div className="form-group">
                <label>ITEM NAME:</label>
                <input
                  type="text"
                  name="itemName"
                  value={editItemForm.itemName}
                  onChange={handleEditItemInputChange}
                  placeholder="Item Name"
                />
              </div>
              <div className="form-group">
                <label>QUANTITY:</label>
                <input
                  type="number"
                  name="quantity"
                  value={editItemForm.quantity}
                  onChange={handleEditItemInputChange}
                  placeholder="Quantity"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>UNIT:</label>
                <div className="category-dropdown">
                  <select
                    name="unit"
                    value={editItemForm.unit}
                    onChange={handleEditItemInputChange}
                  >
                    <option value="">Select Unit</option>
                    {unitOptions.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>CATEGORY:</label>
                <div className="category-dropdown">
                  <select
                    name="category"
                    value={editItemForm.category}
                    onChange={handleEditItemInputChange}
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>DESCRIPTION:</label>
                <textarea
                  name="description"
                  value={editItemForm.description}
                  onChange={handleEditItemInputChange}
                  placeholder="Description"
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    resize: 'vertical'
                  }}
                />
              </div>
              <div className="form-group">
                <label>LOCATION:</label>
                <input
                  type="text"
                  name="location"
                  value={editItemForm.location}
                  onChange={handleEditItemInputChange}
                  placeholder="Location"
                />
              </div>
              <div className="form-group">
                <label>STATUS:</label>
                <div className="category-dropdown">
                  <select
                    name="status"
                    value={editItemForm.status}
                    onChange={handleEditItemInputChange}
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>DATE:</label>
                <input
                  type="date"
                  name="date"
                  value={editItemForm.date}
                  onChange={handleEditItemInputChange}
                  className="date-input"
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="action-btn cancel-btn" onClick={handleCloseEditItem}>
                Cancel
              </button>
              <button className="action-btn update-btn" onClick={handleUpdateItem}>
                Update Item
              </button>
            </div>
          </div>
        </div>
      )}

{/* Compact QR Code Modal */}
{isQRModalOpen && qrCodeItem && (
  <div className="overlay" onClick={handleCloseQRModal}>
    <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="qr-status">Generated</div>
      <h3>QR Code - {qrCodeItem.itemName}</h3>
      
      <div className="qr-display-section">
        {/* Compact QR Code Display */}
        <div className="qr-code-container">
          <div className="qr-code-wrapper">
            <div className="qr-code-display">
              <img src={qrCodeDataURL} alt={`QR Code for ${qrCodeItem.itemName}`} />
            </div>
          </div>
          <div className="qr-brand-text">Supply Inventory</div>
          <div className="qr-timestamp">
            Generated: {new Date().toLocaleDateString()}
          </div>
        </div>
        
        {/* Item Information */}
        <div className="qr-item-info">
          <div className="qr-detail-row">
            <span className="qr-detail-label">Item Code:</span>
            <span className="qr-detail-value highlight">{qrCodeItem.itemCode}</span>
          </div>
          
          <div className="qr-detail-row">
            <span className="qr-detail-label">Stock No.:</span>
            <span className="qr-detail-value">{qrCodeItem.stockNo}</span>
          </div>
          
          <div className="qr-detail-row">
            <span className="qr-detail-label">Category:</span>
            <span className="qr-detail-value">{qrCodeItem.category}</span>
          </div>
          
          <div className="qr-detail-row">
            <span className="qr-detail-label">Quantity:</span>
            <span className="qr-detail-value">{qrCodeItem.quantity} {qrCodeItem.unit || 'units'}</span>
          </div>
          
          {/* NEW FIELD DISPLAY: UNIT */}
          <div className="qr-detail-row">
            <span className="qr-detail-label">Unit:</span>
            <span className="qr-detail-value">{qrCodeItem.unit || 'N/A'}</span>
          </div>
          
          {/* NEW FIELD DISPLAY: LOCATION */}
          <div className="qr-detail-row">
            <span className="qr-detail-label">Location:</span>
            <span className="qr-detail-value">{qrCodeItem.location || 'N/A'}</span>
          </div>
          
          {/* NEW FIELD DISPLAY: STATUS */}
          <div className="qr-detail-row">
            <span className="qr-detail-label">Status:</span>
            <span className="qr-detail-value">{qrCodeItem.status || 'N/A'}</span>
          </div>

          <div className="qr-detail-row">
            <span className="qr-detail-label">Date:</span>
            <span className="qr-detail-value">{qrCodeItem.date || 'N/A'}</span>
          </div>
          
          <div className="qr-detail-row">
            <span className="qr-detail-label">Description:</span>
            <span className="qr-detail-value">{qrCodeItem.description || 'No description'}</span>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="qr-actions">
        <button className="qr-action-btn download-btn" onClick={downloadQRCode}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download
        </button>
        
        <button className="qr-action-btn print-btn" onClick={printQRCode}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="6,9 6,2 18,2 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 18H4C3.46957 18 2.96086 17.7893 2.58579 17.4142C2.21071 17.0391 2 16.5304 2 16V11C2 10.4696 2.21071 9.96086 2.58579 9.58579C2.96086 9.21071 3.46957 9 4 9H20C20.5304 9 21.0391 9.21071 21.4142 9.58579C21.7893 9.96086 22 10.4696 22 11V16C22 16.5304 21.7893 17.0391 21.4142 17.4142C21.0391 17.7893 20.5304 18 20 18H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="6,14 18,14 18,22 6,22 6,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Print
        </button>
        
        <button className="qr-action-btn" onClick={() => {
          // Copy QR data to clipboard - UPDATED TO INCLUDE NEW FIELDS
          const qrData = JSON.stringify({
            itemCode: qrCodeItem.itemCode,
            itemName: qrCodeItem.itemName,
            stockNo: qrCodeItem.stockNo,
            category: qrCodeItem.category,
            quantity: qrCodeItem.quantity,
            unit: qrCodeItem.unit,
            location: qrCodeItem.location,
            status: qrCodeItem.status,
            date: qrCodeItem.date,
            description: qrCodeItem.description
          });
          navigator.clipboard.writeText(qrData);
          alert('QR data copied to clipboard!');
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 15H4C3.46957 15 2.96086 14.7893 2.58579 14.4142C2.21071 14.0391 2 13.5304 2 13V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H13C13.5304 2 14.0391 2.21071 14.4142 2.58579C14.7893 2.96086 15 3.46957 15 4V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copy Data
        </button>
      </div>
      
      
      <button className="close-qr-btn" onClick={handleCloseQRModal}>
        ×
      </button>
    </div>
    
  </div>
)}

{/* Threshold Configuration Modal */}
{showThresholdModal && (
  <div className="overlay" onClick={handleCloseThresholdModal}>
    <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
      <button className="close-overview-btn" onClick={handleCloseThresholdModal}>×</button>
      <h3>Configure Stock Thresholds</h3>
      
      <div className="form-section">
        <div className="form-group">
          <label>Configuration Type:</label>
          <div className="category-dropdown">
            <select
              name="type"
              value={thresholdForm.type}
              onChange={handleThresholdInputChange}
            >
              <option value="category">Category-wide</option>
              <option value="item">Specific Item</option>
            </select>
          </div>
        </div>

        {thresholdForm.type === 'category' ? (
          <div className="form-group">
            <label>Category:</label>
            <div className="category-dropdown">
              <select
                name="category"
                value={thresholdForm.category}
                onChange={handleThresholdInputChange}
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label>Select Item:</label>
            <div className="category-dropdown">
              <select
                name="itemId"
                value={thresholdForm.itemId}
                onChange={handleThresholdInputChange}
              >
                <option value="">Choose an item</option>
                {suppliesData.map(item => (
                  <option key={item._id} value={item._id}>
                    {item.itemName} ({item.itemCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Understock Threshold:</label>
          <input
            type="number"
            name="understock"
            value={thresholdForm.understock}
            onChange={handleThresholdInputChange}
            placeholder="e.g., 10"
            min="0"
          />
          <small style={{ color: '#666', fontSize: '12px' }}>
            Items with quantity ≤ this value will be marked as Understock
          </small>
        </div>

        <div className="form-group">
          <label>Overstock Threshold:</label>
          <input
            type="number"
            name="overstock"
            value={thresholdForm.overstock}
            onChange={handleThresholdInputChange}
            placeholder="e.g., 100"
            min="1"
          />
          <small style={{ color: '#666', fontSize: '12px' }}>
            Items with quantity ≥ this value will be marked as Overstock
          </small>
        </div>

        {/* Show current thresholds */}
        {(() => {
          let currentThresholds = null;
          if (thresholdForm.type === 'category' && thresholdForm.category) {
            currentThresholds = supplyThresholdManager.categoryThresholds[thresholdForm.category];
          } else if (thresholdForm.type === 'item' && thresholdForm.itemId) {
            const item = suppliesData.find(i => i._id === thresholdForm.itemId);
            if (item) {
              currentThresholds = supplyThresholdManager.getThresholds(item);
            }
          }
          
          return currentThresholds ? (
            <div style={{ 
              background: '#f8f9fa', 
              padding: '15px', 
              borderRadius: '8px', 
              marginTop: '15px',
              border: '1px solid #ddd'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>
                Current Thresholds:
              </h4>
              <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>
                Understock: ≤{currentThresholds.understock} | Overstock: ≥{currentThresholds.overstock}
              </p>
              {currentThresholds.critical && (
                <p style={{ margin: '5px 0', fontSize: '12px', color: '#dc2626' }}>
                  Critical: ≤{currentThresholds.critical}
                </p>
              )}
              {currentThresholds.optimal && (
                <p style={{ margin: '5px 0', fontSize: '12px', color: '#059669' }}>
                  Optimal: ~{currentThresholds.optimal}
                </p>
              )}
            </div>
          ) : null;
        })()}
      </div>

      <div className="form-actions">
        <button className="action-btn cancel-btn" onClick={handleCloseThresholdModal}>
          Cancel
        </button>
        <button className="action-btn update-btn" onClick={handleSaveThresholds}>
          Save Thresholds
        </button>
      </div>
    </div>
  </div>
)}

{/* Recommendations Modal */}
{showRecommendations && (
  <div className="overlay" onClick={handleCloseRecommendations}>
    <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
      <button className="close-overview-btn" onClick={handleCloseRecommendations}>×</button>
      <h3>Stock Management Recommendations</h3>
      
      <div className="recommendations-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {recommendations.length > 0 ? (
          recommendations.map((rec, index) => (
            <div 
              key={index} 
              className="recommendation-item"
              style={{
                background: rec.priority === 'critical' ? '#fee2e2' : 
                           rec.priority === 'high' ? '#fef3c7' : '#f3f4f6',
                border: `1px solid ${rec.priority === 'critical' ? '#fca5a5' : 
                                   rec.priority === 'high' ? '#fcd34d' : '#d1d5db'}`,
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '10px'
              }}
            >
              <div className="rec-header" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="rec-type" style={{
                    background: rec.priority === 'critical' ? '#dc2626' : 
                               rec.priority === 'high' ? '#d97706' : '#6b7280',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    {rec.priority} - {rec.type}
                  </span>
                  {rec.action && (
                    <span style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                      {rec.action}
                    </span>
                  )}
                </div>
                <span className="rec-item" style={{ fontSize: '12px', color: '#666' }}>
                  {rec.item.itemName}
                </span>
              </div>
              
              <p className="rec-message" style={{ 
                margin: '0 0 10px 0', 
                fontSize: '14px', 
                color: '#333' 
              }}>
                {rec.message}
              </p>
              
              {/* Enhanced recommendation details */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  <strong>Current:</strong> {rec.item.quantity} {rec.item.unit || 'units'}
                </div>
                {rec.suggestedQuantity && (
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>
                    <strong>Suggested:</strong> {rec.suggestedQuantity} {rec.item.unit || 'units'}
                  </div>
                )}
                {rec.excessQuantity && (
                  <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>
                    <strong>Excess:</strong> {rec.excessQuantity} {rec.item.unit || 'units'}
                  </div>
                )}
              </div>
              
              {/* Action buttons for recommendations */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button 
                  style={{
                    fontSize: '10px',
                    padding: '4px 8px',
                    background: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setSelectedItem(rec.item);
                    setIsItemOverviewOpen(true);
                    setShowRecommendations(false);
                  }}
                >
                  View Item
                </button>
                
                {rec.type === 'reorder' && (
                  <button 
                    style={{
                      fontSize: '10px',
                      padding: '4px 8px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setSelectedItem(rec.item);
                      setShowRecommendations(false);
                      handleOpenUpdateQuantity();
                    }}
                  >
                    Update Stock
                  </button>
                )}
                
                <button 
                  style={{
                    fontSize: '10px',
                    padding: '4px 8px',
                    background: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setSelectedItem(rec.item);
                    setShowRecommendations(false);
                    handleOpenThresholdModal();
                  }}
                >
                  Set Thresholds
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666' 
          }}>
            <p>No recommendations at this time.</p>
            <p style={{ fontSize: '12px' }}>All items are within normal stock levels.</p>
          </div>
        )}
      </div>
      
      {/* Summary section */}
      {recommendations.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#f8f9fa', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>
            Summary
          </h4>
          <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
            <span>
              <strong>Critical:</strong> {recommendations.filter(r => r.priority === 'critical').length}
            </span>
            <span>
              <strong>High:</strong> {recommendations.filter(r => r.priority === 'high').length}
            </span>
            <span>
              <strong>Medium:</strong> {recommendations.filter(r => r.priority === 'medium').length}
            </span>
            <span>
              <strong>Low:</strong> {recommendations.filter(r => r.priority === 'low').length}
            </span>
          </div>
        </div>
      )}
    </div>
  </div>
)}

{isStockCardOpen && selectedItem && (
  <div className="modal-overlay" onClick={handleCloseStockCard}>
    <div className="repair-card-modal" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close-btn" onClick={handleCloseStockCard}>
        ×
      </button>

      <div className="modal-header">
        <img src="/UDMLOGO.png" alt="University Logo" className="modal-logo" />
        <div className="modal-title-section">
          <h3 className="modal-university-name">Universidad De Manila</h3>
          <p className="modal-document-type">Stock Card</p>
        </div>
      </div>

      <div className="modal-divider"></div>

      <div className="modal-info-table">
        <table className="info-details-table">
          <tbody>
            <tr>
              <td className="info-label-cell">Item:</td>
              <td className="info-value-cell">{selectedItem.itemName || 'N/A'}</td>
              <td className="info-label-cell">Stock No.:</td>
              <td className="info-value-cell">{selectedItem.stockNo || 'N/A'}</td>
            </tr>
            <tr>
              <td className="info-label-cell">Category:</td>
              <td className="info-value-cell">{selectedItem.category || 'N/A'}</td>
              <td className="info-label-cell">Description:</td>
              <td className="info-value-cell">{selectedItem.description || 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="modal-table-container">
        <table className="modal-repair-table">
          <thead>
            <tr>
              <th rowSpan="2" className="date-column">Date</th>
              <th colSpan="3" className="quantity-header">Quantity</th>
            </tr>
            <tr>
              <th className="receipt-column">Receipt</th>
              <th className="quantity-issue-column">Issue</th>
              <th className="balance-column">Balance</th>
            </tr>
          </thead>
          <tbody>
  {selectedItem.transactionHistory && selectedItem.transactionHistory.length > 0 ? (
    [...selectedItem.transactionHistory]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((transaction, index) => (
                <tr key={index} className="stock-row">
                  <td className="date-cell">{transaction.date || ''}</td>
                  <td className="receipt-cell">{transaction.receipt !== null && transaction.receipt !== undefined ? transaction.receipt : ''}</td>
                  <td className="quantity-issue-cell">{transaction.issue !== null && transaction.issue !== undefined ? transaction.issue : ''}</td>
                  <td className="balance-cell">{transaction.balance !== null && transaction.balance !== undefined ? transaction.balance : ''}</td>
                </tr>
              ))
            ) : (
              <>
                <tr className="stock-row">
                  <td className="date-cell">{selectedItem.date}</td>
                  <td className="receipt-cell">{selectedItem.quantity}</td>
                  <td className="quantity-issue-cell"></td>
                  <td className="balance-cell">{selectedItem.quantity}</td>
                </tr>
                {Array.from({ length: 9 }, (_, index) => (
                  <tr key={index} className="stock-row">
                    <td className="date-cell"></td>
                    <td className="receipt-cell"></td>
                    <td className="quantity-issue-cell"></td>
                    <td className="balance-column"></td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="modal-print-section" style={{ 
  display: 'flex', 
  gap: '8px', 
  justifyContent: 'flex-end',
  marginTop: '20px',
  padding: '0'
}}>
  <button
    className="modal-print-btn"
    style={{
      padding: '8px 16px',
      fontSize: '14px',
      minWidth: 'auto',
      position: 'static'
    }}
    onClick={() => {
            const element = document.createElement('div');
            element.innerHTML = `
              <div style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: white;">
                <div style="max-width: 800px; margin: 0 auto; border: 2px solid #333; border-radius: 8px; padding: 30px;">
                  <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px; gap: 15px;">
                    <img src="/UDMLOGO.png" alt="University Logo" style="width: 50px; height: 50px;" />
                    <div style="text-align: center;">
                      <h3 style="font-size: 16px; font-weight: bold; margin: 0; color: #333;">Universidad De Manila</h3>
                      <p style="font-size: 12px; margin: 2px 0 0 0; color: #666;">Stock Card</p>
                    </div>
                  </div>

                  <div style="border-top: 1px solid #333; margin: 20px 0;"></div>

                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #333;">
                    <tr>
                      <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; background: #f8f9fa; font-weight: bold; width: 15%; color: #333;">Item:</td>
                      <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; width: 35%; text-decoration: underline;">${selectedItem.itemName || 'N/A'}</td>
                      <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; background: #f8f9fa; font-weight: bold; width: 15%; color: #333;">Stock No.:</td>
                      <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; width: 35%; text-decoration: underline;">${selectedItem.stockNo || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; background: #f8f9fa; font-weight: bold; color: #333;">Category:</td>
                      <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; text-decoration: underline;">${selectedItem.category || 'N/A'}</td>
                      <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; background: #f8f9fa; font-weight: bold; color: #333;">Description:</td>
                      <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; text-decoration: underline;">${selectedItem.description || 'N/A'}</td>
                    </tr>
                  </table>

                  <table style="width: 100%; border-collapse: collapse; border: 2px solid #333; margin-top: 10px;">
                    <thead>
                      <tr>
                        <th rowspan="2" style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; font-weight: bold; background: #e9ecef; width: 25%;">Date</th>
                        <th colspan="3" style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; font-weight: bold; background: #e9ecef;">Quantity</th>
                      </tr>
                      <tr>
                        <th style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; font-weight: bold; background: #e9ecef; width: 25%;">Receipt</th>
                        <th style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; font-weight: bold; background: #e9ecef; width: 25%;">Issue</th>
                        <th style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; font-weight: bold; background: #e9ecef; width: 25%;">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${selectedItem.transactionHistory && selectedItem.transactionHistory.length > 0
  ? [...selectedItem.transactionHistory]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(transaction => `
                          <tr>
                            <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${transaction.date || ''}</td>
                            <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${transaction.receipt !== null && transaction.receipt !== undefined ? transaction.receipt : ''}</td>
                            <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${transaction.issue !== null && transaction.issue !== undefined ? transaction.issue : ''}</td>
                            <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${transaction.balance !== null && transaction.balance !== undefined ? transaction.balance : ''}</td>
                          </tr>
                        `).join('')
                        : `
                          <tr>
                            <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${selectedItem.date}</td>
                            <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${selectedItem.quantity}</td>
                            <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;"></td>
                            <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${selectedItem.quantity}</td>
                          </tr>
                          ${Array.from({ length: 20 }, () => `
                            <tr>
                              <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                              <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                              <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                              <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                            </tr>
                          `).join('')}
                        `
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            `;

            const opt = {
              margin: 0.5,
              filename: `Stock_Card_${selectedItem.itemName || 'Item'}_${selectedItem.itemCode || ''}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(element).save();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download PDF
        </button>

         <button
    className="modal-print-btn"
    style={{
      padding: '8px 16px',
      fontSize: '14px',
      minWidth: 'auto',
      position: 'static'
    }}
    onClick={() => {
            const printWindow = window.open('', '_blank');
            const printContent = `
              <html>
                <head>
                  <title>Stock Card - ${selectedItem.itemName || 'Item'}</title>
                  <style>
                    body {
                      font-family: Arial, sans-serif;
                      margin: 0;
                      padding: 20px;
                      background: white;
                      color: #333;
                    }
                    .print-container {
                      max-width: 800px;
                      margin: 0 auto;
                      border: 2px solid #333;
                      border-radius: 8px;
                      padding: 30px;
                    }
                    .header {
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      text-align: center;
                      margin-bottom: 20px;
                      gap: 15px;
                    }
                    .logo {
                      width: 50px;
                      height: 50px;
                    }
                    .title-section {
                      text-align: center;
                    }
                    .university-name {
                      font-size: 18px;
                      font-weight: bold;
                      color: #2c5530;
                      margin: 0;
                    }
                    .document-type {
                      font-size: 16px;
                      font-weight: bold;
                      color: #333;
                      margin: 5px 0 0 0;
                    }
                    .divider {
                      border-top: 2px solid #333;
                      margin: 20px 0;
                    }
                    .info-table {
                      width: 100%;
                      margin-bottom: 20px;
                      border: 1px solid #333;
                      border-collapse: collapse;
                    }
                    .info-table td {
                      padding: 8px 12px;
                      border: 1px solid #333;
                      font-size: 14px;
                    }
                    .label-cell {
                      font-weight: bold;
                      background-color: #f5f5f5;
                      color: #333;
                      text-align: right;
                      width: 150px;
                    }
                    .value-cell {
                      color: #333;
                    }
                    .transaction-table {
                      width: 100%;
                      border-collapse: collapse;
                      border: 2px solid #333;
                    }
                    .transaction-table th,
                    .transaction-table td {
                      border: 1px solid #333;
                      padding: 8px;
                      text-align: center;
                      font-size: 12px;
                    }
                    .transaction-table th {
                      background-color: #f5f5f5;
                      font-weight: bold;
                    }
                  </style>
                </head>
                <body>
                  <div class="print-container">
                    <div class="header">
                      <img src="/UDMLOGO.png" alt="University Logo" class="logo" />
                      <div class="title-section">
                        <h3 class="university-name">Universidad De Manila</h3>
                        <p class="document-type">Stock Card</p>
                      </div>
                    </div>
                    <div class="divider"></div>
                    <table class="info-table">
                      <tr>
                        <td class="label-cell">Item:</td>
                        <td class="value-cell">${selectedItem.itemName || 'N/A'}</td>
                        <td class="label-cell">Stock No.:</td>
                        <td class="value-cell">${selectedItem.stockNo || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td class="label-cell">Category:</td>
                        <td class="value-cell">${selectedItem.category || 'N/A'}</td>
                        <td class="label-cell">Description:</td>
                        <td class="value-cell">${selectedItem.description || 'N/A'}</td>
                      </tr>
                    </table>
                    <table class="transaction-table">
                      <thead>
                        <tr>
                          <th rowspan="2">Date</th>
                          <th colspan="3">Quantity</th>
                        </tr>
                        <tr>
                          <th>Receipt</th>
                          <th>Issue</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${selectedItem.transactionHistory && selectedItem.transactionHistory.length > 0
  ? [...selectedItem.transactionHistory]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(transaction => `
                            <tr>
                              <td>${transaction.date || ''}</td>
                              <td>${transaction.receipt !== null && transaction.receipt !== undefined ? transaction.receipt : ''}</td>
                              <td>${transaction.issue !== null && transaction.issue !== undefined ? transaction.issue : ''}</td>
                              <td>${transaction.balance !== null && transaction.balance !== undefined ? transaction.balance : ''}</td>
                            </tr>
                          `).join('')
                          : `
                            <tr>
                              <td>${selectedItem.date}</td>
                              <td>${selectedItem.quantity}</td>
                              <td></td>
                              <td>${selectedItem.quantity}</td>
                            </tr>
                            ${Array.from({ length: 20 }, () => `
                              <tr>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                              </tr>
                            `).join('')}
                          `
                        }
                      </tbody>
                    </table>
                  </div>
                </body>
              </html>
            `;
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
              printWindow.print();
              printWindow.close();
            }, 250);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Print Stock Card
        </button>
      </div>
    </div>
  </div>
)}

<DocumentViewer 
  item={selectedItem}
  isOpen={isDocumentViewerOpen}
  onClose={handleCloseDocumentViewer}
/>

    </div>
  );
}

export default SuppliesPage;
