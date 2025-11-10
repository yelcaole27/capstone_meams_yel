import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import QRCode from 'qrcode';
import EquipmentAPI from './EquipmentApi';
import EquipmentDocumentViewer from './EquipmentDocumentViewer';
import html2pdf from 'html2pdf.js';
import './EquipmentPage.css';
import QRAuthModal from './QRAuthModal';

function EquipmentPage() {
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isEquipmentOverviewOpen, setIsEquipmentOverviewOpen] = useState(false);
  const [equipmentData, setEquipmentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEquipmentDocumentViewerOpen, setIsEquipmentDocumentViewerOpen] = useState(false);
  const [equipmentDocumentFiles, setEquipmentDocumentFiles] = useState([]);
  const [equipmentDocDragActive, setEquipmentDocDragActive] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const uniqueCategories = ['All Categories', ...new Set(equipmentData.map(item => item.category))];
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState(null);

  // LCC Analysis State
  const [showLCCAnalysis, setShowLCCAnalysis] = useState(false);
  const [lccData, setLccData] = useState(null);


  // LCC Analysis Function
  const calculateLCCAnalysis = (equipment) => {
    const repairHistory = equipment.repairHistory || [];
    const usefulLife = equipment.usefulLife || 5;
    const purchasePrice = equipment.amount || 0;
    const currentDate = new Date();
    const purchaseDate = equipment.date ? new Date(equipment.date) : currentDate;
    const ageInYears = (currentDate - purchaseDate) / (1000 * 60 * 60 * 24 * 365);

    // Calculate repair metrics
    const totalRepairs = repairHistory.length;
    const totalRepairCost = repairHistory.reduce((sum, repair) => sum + (parseFloat(repair.amountUsed) || 0), 0);
    const averageRepairCost = totalRepairs > 0 ? totalRepairCost / totalRepairs : 0;
    
    // Calculate repair frequency (repairs per year)
    const repairFrequency = ageInYears > 0 ? totalRepairs / ageInYears : 0;

    // QRCODE
    const [showQRAuthModal, setShowQRAuthModal] = useState(false);
const [pendingQRData, setPendingQRData] = useState(null);
const [qrAccessToken, setQrAccessToken] = useState(null);

    // Calculate cost thresholds
    const costThreshold = purchasePrice * 0.5; // 50% of purchase price
    const totalCostOfOwnership = purchasePrice + totalRepairCost;
    const costRatio = purchasePrice > 0 ? totalRepairCost / purchasePrice : 0;

    // Determine LCC remarks based on analysis
    let lccRemarks = [];
    let riskLevel = 'Low';
    let recommendReplacement = false;

    // Check for costly repairs (total repair cost exceeds 50% of purchase price)
    if (totalRepairCost >= costThreshold) {
      lccRemarks.push('Costly Repair');
      riskLevel = 'High';
      recommendReplacement = true;
    }

    // Check for frequent repairs (more than 2 repairs per year)
    if (repairFrequency > 2) {
      lccRemarks.push('Frequent Repair');
      riskLevel = riskLevel === 'High' ? 'High' : 'Medium';
      if (repairFrequency > 3) recommendReplacement = true;
    }

    // Check if beyond useful life
    if (ageInYears >= usefulLife) {
      lccRemarks.push('Beyond Useful Life');
      riskLevel = 'High';
      recommendReplacement = true; // Flag for replacement if beyond useful life
    }

    // Check if approaching useful life (within 1 year)
    if (ageInYears >= usefulLife - 1 && ageInYears < usefulLife) {
      lccRemarks.push('Approaching End of Life');
      riskLevel = riskLevel === 'High' ? 'High' : 'Medium';
    }

    // Check for multiple recent repairs (3+ repairs in last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentRepairs = repairHistory.filter(repair => {
      const repairDate = new Date(repair.repairDate);
      return repairDate >= sixMonthsAgo;
    }).length;

    if (recentRepairs >= 3) {
      lccRemarks.push('High Recent Repair Activity');
      riskLevel = 'High';
      recommendReplacement = true;
    }

    // If no issues, set as operational
    if (lccRemarks.length === 0) {
      lccRemarks.push('Operational - Within Parameters');
      riskLevel = 'Low';
    }

    return {
      equipment: equipment,
      totalRepairs,
      totalRepairCost,
      averageRepairCost,
      repairFrequency: repairFrequency.toFixed(2),
      ageInYears: ageInYears.toFixed(1),
      usefulLife,
      purchasePrice,
      totalCostOfOwnership,
      costRatio: (costRatio * 100).toFixed(1),
      lccRemarks,
      riskLevel,
      recommendReplacement,
      analysisDate: new Date().toISOString()
    };
  };

  // Handler to show LCC analysis
  const handleShowLCCAnalysis = () => {
    if (selectedEquipment) {
      const analysis = calculateLCCAnalysis(selectedEquipment);
      setLccData(analysis);
      setShowLCCAnalysis(true);
    }
  };

  // Close LCC Analysis modal
  const handleCloseLCCAnalysis = () => {
    setShowLCCAnalysis(false);
    setLccData(null);
  };

  // Get LCC badge for equipment list
  const getLCCBadge = (equipment) => {
    const analysis = calculateLCCAnalysis(equipment);
    if (analysis.recommendReplacement) {
      return {
        text: 'REPLACE',
        color: '#dc3545',
        bgColor: 'rgba(220, 53, 69, 0.1)'
      };
    } else if (analysis.riskLevel === 'High') {
      return {
        text: 'HIGH RISK',
        color: '#fd7e14',
        bgColor: 'rgba(253, 126, 20, 0.1)'
      };
    } else if (analysis.riskLevel === 'Medium') {
      return {
        text: 'MONITOR',
        color: '#ffc107',
        bgColor: 'rgba(255, 193, 7, 0.1)'
      };
    }
    return null;
  };

  const handleEquipmentDocDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setEquipmentDocDragActive(true);
    } else if (e.type === "dragleave") {
      setEquipmentDocDragActive(false);
    }
  };

  const handleEquipmentDocDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEquipmentDocDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setEquipmentDocumentFiles(prev => [...prev, ...files]);
    }
  };

  const handleEquipmentDocFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setEquipmentDocumentFiles(prev => [...prev, ...files]);
    }
  };

  const removeEquipmentDocumentFile = (index) => {
    setEquipmentDocumentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleViewEquipmentDocuments = () => {
    if (selectedEquipment) {
      setIsEquipmentDocumentViewerOpen(true);
    }
  };

  const handleCloseEquipmentDocumentViewer = () => {
    setIsEquipmentDocumentViewerOpen(false);
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Add Equipment Overlay states
  const [isAddEquipmentOverlayOpen, setIsAddEquipmentOverlayOpen] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    itemCode: '',
    name: '',        
    description: '', 
    category: '',
    location: '',
    status: '',
    usefulLife: '',
    amount: '',
    date: '',
    itemPicture: null
  });
  const [dragActive, setDragActive] = useState(false);
  const [addingEquipment, setAddingEquipment] = useState(false);

  // NEW: Report Repair and Update Equipment states
  const [showReportRepairModal, setShowReportRepairModal] = useState(false);
  const [showUpdateEquipmentModal, setShowUpdateEquipmentModal] = useState(false);
  const [repairData, setRepairData] = useState({
    reportDate: '',      
    reportDetails: ''    
  });
  const [updateData, setUpdateData] = useState({
    name: '',
    description: '',
    category: '',
    location: '',
    status: '',
    usefulLife: '',
    amount: ''
  });

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // QR Code states
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [qrCodeEquipment, setQrCodeEquipment] = useState(null);

  // Maintenance
  const [showRepairDocument, setShowRepairDocument] = useState(false);

  const handleViewMaintenanceLog = () => {
    setShowRepairDocument(true);
  };

  const closeRepairDocument = () => {
    setShowRepairDocument(false);
  };

  const handlePrintStockCard = () => {
    window.print();
  };

  const handleReportRepair = () => {
    setShowReportRepairModal(true);
    setRepairData({
      reportDate: new Date().toISOString().split('T')[0],
      reportDetails: ''
    });
  };

  const handleUpdateEquipment = () => {
    setShowUpdateEquipmentModal(true);
    setUpdateData({
      itemCode: selectedEquipment.itemCode || '',
      description: selectedEquipment.description || '',
      repairDate: '',
      repairDetails: '',
      amountUsed: ''
    });
  };

  const handleRepairDataChange = (e) => {
    const { name, value } = e.target;
    setRepairData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateDataChange = (e) => {
    const { name, value } = e.target;
    setUpdateData(prev => ({ ...prev, [name]: value }));
  };

  const submitRepairReport = async () => {
    try {
      if (!repairData.reportDetails || !repairData.reportDetails.trim()) {
        alert('Please enter report details');
        return;
      }
      
      if (!repairData.reportDate) {
        alert('Please enter report date');
        return;
      }

      console.log('=== SUBMITTING REPAIR REPORT ===');
      console.log('Equipment ID:', selectedEquipment._id);
      console.log('Report Date:', repairData.reportDate);
      console.log('Report Details:', repairData.reportDetails);

      const updatedEquipment = await EquipmentAPI.addEquipmentReport(
        selectedEquipment._id,
        {
          reportDate: repairData.reportDate,
          reportDetails: repairData.reportDetails,
          // Set status to 'Maintenance' when a repair is reported
          status: 'Maintenance' 
        }
      );

      console.log('=== REPORT SUBMITTED SUCCESSFULLY ===');
      console.log('Updated Equipment:', updatedEquipment);

      // The warning about report data not found in response is still valid if backend doesn't return it.
      // For now, we assume updatedEquipment contains the latest state including the new report.
      if (!updatedEquipment.reportDate || !updatedEquipment.reportDetails) {
        console.warn('Warning: Report data might not be fully reflected in the response. Frontend state might be slightly out of sync until refresh.');
      }

      alert('Repair report submitted successfully! The equipment status has been set to Maintenance.');
      
      setShowReportRepairModal(false);
      setSelectedEquipment(updatedEquipment);

      setEquipmentData(prevData =>
        prevData.map(item =>
          item._id === selectedEquipment._id ? updatedEquipment : item
        )
      );

      setRepairData({
        reportDate: '',
        reportDetails: ''
      });
      
      console.log('=== STATE UPDATED ===');
      
    } catch (error) {
      console.error('=== ERROR SUBMITTING REPAIR REPORT ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      
      alert(`Failed to submit repair report: ${error.message}`);
    }
  };

  const submitEquipmentUpdate = async () => {
    try {
      if (!updateData.repairDate) {
        alert('Repair date is required');
        return;
      }
      
      if (!updateData.repairDetails.trim()) {
        alert('Repair details are required');
        return;
      }
      
      if (!updateData.amountUsed || parseFloat(updateData.amountUsed) < 0) {
        alert('Amount used must be a valid non-negative number');
        return;
      }

      console.log('Submitting repair update:', {
        repairDate: updateData.repairDate,
        repairDetails: updateData.repairDetails,
        amountUsed: parseFloat(updateData.amountUsed)
      });

      // Determine new status after repair completion
      let newStatus = 'Within-Useful-Life';
      if (selectedEquipment.date && selectedEquipment.usefulLife) {
        const purchaseDate = new Date(selectedEquipment.date);
        const usefulLifeEndDate = new Date(purchaseDate.getFullYear() + selectedEquipment.usefulLife, purchaseDate.getMonth(), purchaseDate.getDate());
        if (new Date() > usefulLifeEndDate) {
          newStatus = 'Beyond-Useful-Life';
        }
      }

      const response = await EquipmentAPI.updateEquipmentRepair(selectedEquipment._id, {
        repairDate: updateData.repairDate,
        repairDetails: updateData.repairDetails,
        amountUsed: parseFloat(updateData.amountUsed),
        status: newStatus 
      });
      
      console.log('Equipment repair updated:', response);
      
      setSelectedEquipment(response);
      
      setEquipmentData(prevData => 
        prevData.map(item => 
          item._id === selectedEquipment._id 
            ? response
            : item
        )
      );
      
      alert('Equipment repair completed successfully!');
      setShowUpdateEquipmentModal(false);
      
      setUpdateData({
        itemCode: '',
        description: '',
        repairDate: '',
        repairDetails: '',
        amountUsed: ''
      });
      
    } catch (error) {
      console.error('Error updating equipment repair:', error);
      alert('Failed to update equipment repair. Please try again.');
    }
  };

  const equipmentCategories = ['HVAC Carpentry', 'Carpentry Equipment', 'Office Equipment', 'Electrical Equipment', 'Audio/Visual Equipment'];

  const equipmentStatuses = ['Within-Useful-Life', 'Beyond-Useful-Life']; 

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadEquipment = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const equipment = await EquipmentAPI.getAllEquipment();
    
    const transformedEquipment = equipment.map(item => ({
      _id: item._id || item.id,
      itemCode: item.itemCode || item.item_code || `MED-E-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      usefulLife: item.usefulLife || 1,
      amount: item.amount || 0.0,
      name: item.name || 'Unknown Equipment',
      description: item.description || 'No description available',
      category: item.category || 'General',
      location: item.location || 'Unknown',
      status: item.status || 'Within-Useful-Life',
      supplier: item.supplier || '',
      unit_price: item.unit_price || 0,
      date: item.date || '',
      has_image: item.image_data ? true : false,
      image_data: item.image_data || null,
      image_filename: item.image_filename || null,
      image_content_type: item.image_content_type || null,
      repairHistory: item.repairHistory || [],
    }));
    setEquipmentData(transformedEquipment);
    console.log(`✅ Loaded ${transformedEquipment.length} equipment items from database`);
    
  } catch (err) {
    console.error('Failed to load equipment:', err);
    setError(`Failed to load equipment: ${err.message}`);
    setEquipmentData([]);
  } finally {
    setLoading(false);
  }
};

  const filteredEquipment = equipmentData.filter(item => {
  const matchesSearch = searchTerm === '' || 
    item.itemCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase());
  
  const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
  
  return matchesSearch && matchesCategory;
});

  const totalPages = Math.ceil(filteredEquipment.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEquipment = filteredEquipment.slice(startIndex, endIndex);

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

  const handleAddEquipmentToggle = () => {
    setIsAddEquipmentOverlayOpen(!isAddEquipmentOverlayOpen);
    if (isAddEquipmentOverlayOpen) {
      setNewEquipment({
        itemCode: '',
        name: '',          
        description: '',   
        category: '',
        location: '',
        status: '',
        usefulLife: '',
        amount: '',
        date: '',
        itemPicture: null
      });
      setError(null);
    }
    setEquipmentDocumentFiles([]);
  };

  const handleEquipmentInputChange = (e) => {
    const { name, value } = e.target;
    setNewEquipment((prev) => ({ ...prev, [name]: value }));
  };

  const handleEquipmentFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        alert('File size must be less than 25MB');
        return;
      }
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid file type (JPEG, PNG, PDF, DOC, DOCX)');
        return;
      }
      
      setNewEquipment({ ...newEquipment, itemPicture: file });
    }
  };


  const [imageDragActive, setImageDragActive] = useState(false);

const handleImageDrag = (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.type === "dragenter" || e.type === "dragover") {
    setImageDragActive(true);
  } else if (e.type === "dragleave") {
    setImageDragActive(false);
  }
};

const handleImageDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  setImageDragActive(false);
  
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0];
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setImageUploadError('Please select a valid image file (JPEG, PNG)');
      return;
    }
    
    // Validate file size
    if (file.size > 25 * 1024 * 1024) {
      setImageUploadError('File size must be less than 25MB');
      return;
    }
    
    // Upload the file
    handleImageUploadForSelectedEquipment(file);
  }
};

  const handleEquipmentDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleEquipmentDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      if (file.size > 25 * 1024 * 1024) {
        alert('File size must be less than 25MB');
        return;
      }
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid file type (JPEG, PNG, PDF, DOC, DOCX)');
        return;
      }
      
      setNewEquipment({ ...newEquipment, itemPicture: file });
    }
  };
   

  const handleImageUploadForSelectedEquipment = async (file) => {
  try {
    if (!file) return;
    
    if (file.size > 25 * 1024 * 1024) {
      setImageUploadError('File size must be less than 25MB');
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setImageUploadError('Please select a valid image file (JPEG, PNG)');
      return;
    }
    
    setIsUploadingImage(true);
    setImageUploadError(null);
    
    console.log('📤 Uploading image:', file.name);
    
    // Upload via API
    const response = await EquipmentAPI.uploadEquipmentImage(selectedEquipment._id, file);
    
    console.log('✅ Image uploaded, response:', response);
    
    // Update local state with response from server
    const updatedEquipment = {
      ...selectedEquipment,
      image_data: response.image_data || null,
      image_filename: response.image_filename || file.name,
      image_content_type: response.image_content_type || file.type,
      has_image: true
    };
    
    setSelectedEquipment(updatedEquipment);
    
    // Update equipmentData array
    setEquipmentData(prevData =>
      prevData.map(item =>
        item._id === selectedEquipment._id ? updatedEquipment : item
      )
    );
    
    alert('Image uploaded successfully!');
    
  } catch (error) {
    console.error('Error uploading image:', error);
    setImageUploadError(`Failed to upload image: ${error.message}`);
  } finally {
    setIsUploadingImage(false);
  }
};

const getImageUrl = (equipment) => {
  if (!equipment || !equipment.image_data) return null;
  
  const imageData = equipment.image_data;
  const contentType = equipment.image_content_type || 'image/jpeg';
  
  // If it already starts with 'data:', return as is
  if (imageData.startsWith('data:')) {
    return imageData;
  }
  
  // If it's plain base64 (check for common JPEG/PNG signatures)
  if (imageData.startsWith('/9j/') || imageData.startsWith('iVBORw0KGgo')) {
    return `data:${contentType};base64,${imageData}`;
  }
  

  if (/^[A-Za-z0-9+/=]+$/.test(imageData)) {
    return `data:${contentType};base64,${imageData}`;
  }
  
  // Default: assume it's base64 and add prefix
  return `data:${contentType};base64,${imageData}`;
};
  const generateEquipmentCode = () => {
    const categoryPrefix = newEquipment.category ? newEquipment.category.substring(0, 3).toUpperCase() : 'EQP';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const generatedCode = `${categoryPrefix}-E-${randomNum}`;
    setNewEquipment({ ...newEquipment, itemCode: generatedCode });
  };

  const validateEquipmentForm = () => {
    const errors = [];
    
    if (!newEquipment.name.trim()) {
      errors.push('Equipment name is required.');
    }
    
    if (!newEquipment.description.trim()) {
      errors.push('Description is required.');
    }
    
    
    const usefulLifeNum = parseInt(newEquipment.usefulLife);
    if (isNaN(usefulLifeNum) || usefulLifeNum <= 0) {
      errors.push('Useful life must be a positive number.');
    }


    const amountNum = parseFloat(newEquipment.amount);
    if (isNaN(amountNum) || amountNum < 0) {
      errors.push('Amount must be a non-negative number.');
    }
    
    if (!newEquipment.category) {
      errors.push('Category is required.');
    }
    
    // Status is now calculated, so no direct validation needed here
    // if (!newEquipment.status) {
    //   errors.push('Status is required.');
    // }
    
    return errors;
  };

  const handleAddEquipment = async () => {
    try {
      // --- Start of added validation ---
      const validationErrors = validateEquipmentForm();
      if (validationErrors.length > 0) {
        alert('Please correct the following issues:\n' + validationErrors.join('\n'));
        return;
      }
      // --- End of added validation ---

      setAddingEquipment(true);
      setError(null);

      let imageBase64 = null;
      if (newEquipment.itemPicture) {
        imageBase64 = await convertFileToBase64(newEquipment.itemPicture);
      }

      // Determine initial status based on date and useful life
      let initialStatus = 'Within-Useful-Life';
      if (newEquipment.date && newEquipment.usefulLife) {
        const purchaseDate = new Date(newEquipment.date);
        const usefulLifeEndDate = new Date(purchaseDate.getFullYear() + parseInt(newEquipment.usefulLife), purchaseDate.getMonth(), purchaseDate.getDate());
        if (new Date() > usefulLifeEndDate) {
          initialStatus = 'Beyond-Useful-Life';
        }
      }

      const equipmentData = {
        name: newEquipment.name.trim(),
        description: newEquipment.description.trim(),
        category: newEquipment.category,
        usefulLife: parseInt(newEquipment.usefulLife), 
        amount: parseFloat(newEquipment.amount),       
        location: newEquipment.location.trim() || '',
        status: initialStatus, // Set calculated initial status
        itemCode: newEquipment.itemCode.trim() || `MED-E-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
        unit_price: parseFloat(newEquipment.amount), 
        supplier: '',
        date: newEquipment.date || null, // Send null if date is empty string
        image_data: imageBase64 ? (imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64) : null,
        image_filename: newEquipment.itemPicture?.name || null,
        image_content_type: newEquipment.itemPicture?.type || null,
      };

      console.log('📤 Adding new equipment:', equipmentData);

      const savedEquipment = await EquipmentAPI.addEquipment(equipmentData);

      if (equipmentDocumentFiles.length > 0) {
        console.log(`📤 Uploading ${equipmentDocumentFiles.length} documents...`);
        for (const file of equipmentDocumentFiles) {
          try {
            await EquipmentAPI.uploadEquipmentDocument(savedEquipment._id || savedEquipment.id, file);
            console.log(`✅ Uploaded: ${file.name}`);
          } catch (err) {
            console.error(`❌ Failed to upload ${file.name}:`, err);
          }
        }
        
        // Fetch the updated equipment to get the documents array
        const updatedEquipmentWithDocs = await EquipmentAPI.getEquipmentById(savedEquipment._id || savedEquipment.id);
        savedEquipment.documents = updatedEquipmentWithDocs.documents;
      }

      const newEquipmentItem = {
        _id: savedEquipment._id || savedEquipment.id,
        itemCode: equipmentData.itemCode,
        name: newEquipment.name.trim(),
        usefulLife: parseInt(newEquipment.usefulLife), 
        amount: parseFloat(newEquipment.amount),       
        description: newEquipment.description.trim(),
        category: newEquipment.category,
        location: newEquipment.location.trim(),
        status: initialStatus,
        itemPicture: savedEquipment.image_data,  
        image_data: savedEquipment.image_data,
        image_filename: savedEquipment.image_filename,
        documents: savedEquipment.documents || [],
        image_content_type: savedEquipment.image_content_type,
        supplier: '',
        unit_price: parseFloat(newEquipment.amount), 
        date: newEquipment.date
      };
      setEquipmentData(prevData => [...prevData, newEquipmentItem]);

      alert(`Equipment "${newEquipment.name}" added successfully!\nDocuments uploaded: ${equipmentDocumentFiles.length}`);
      setEquipmentDocumentFiles([]);
      handleAddEquipmentToggle();
      
    } catch (error) {
      console.error('❌ Error adding equipment:', error);
      setError(`Failed to add equipment: ${error.message}`);
      alert(`Failed to add equipment: ${error.message}`);
    } finally {
      setAddingEquipment(false);
    }
  };


  const handleQRAuthenticated = async (accessToken, user) => {
  console.log('✅ Authenticated:', user);
  setQrAccessToken(accessToken);
  
  if (pendingQRData) {
    // Now generate the actual QR code
    const BACKEND_URL = process.env.REACT_APP_API_URL || 'https://meams.onrender.com';
    
    // Create authenticated scan URL
    const scanUrl = `${BACKEND_URL}/api/equipment/view/${pendingQRData.id}`;
    
    const qrDataURL = await QRCode.toDataURL(scanUrl, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H',
    });

    setQrCodeDataURL(qrDataURL);
    setQrCodeEquipment(pendingQRData.data);
    setIsQRModalOpen(true);
    setPendingQRData(null);
  }
};
  const handleDeleteEquipment = async (equipmentId, equipmentName) => {
    if (!window.confirm(`Are you sure you want to delete "${equipmentName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await EquipmentAPI.deleteEquipment(equipmentId);
      
      setEquipmentData(prevData => prevData.filter(item => item._id !== equipmentId));
      
      if (selectedEquipment && selectedEquipment._id === equipmentId) {
        handleCloseEquipmentOverview();
      }
      
      alert(`Equipment "${equipmentName}" deleted successfully!`);
      console.log('✅ Equipment deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting equipment:', error);
      alert(`Failed to delete equipment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (equipment) => {
  try {
    const BACKEND_URL = process.env.REACT_APP_API_URL || 'https://meams.onrender.com';
    
    // Store equipment data for after authentication
    setPendingQRData({
      type: 'equipment',
      id: equipment._id,
      data: equipment
    });
    
    // Show authentication modal
    setShowQRAuthModal(true);
    
  } catch (error) {
    console.error('❌ QR code generation failed:', error);
    alert('Failed to generate QR code: ' + error.message);
  }
};

    setQrCodeDataURL(qrDataURL);
    setQrCodeEquipment(equipment);
    setIsQRModalOpen(true);
    
    console.log('✅ QR Code generated successfully');
    
  } catch (error) {
    console.error('❌ QR code generation failed:', error);
    alert('Failed to generate QR code: ' + error.message);
  }
};

  const downloadQRCode = () => {
  if (!qrCodeDataURL || !qrCodeEquipment) return;

  const link = document.createElement('a');
  const fileName = `QR_${qrCodeEquipment.itemCode}_${qrCodeEquipment.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
  link.download = fileName;
  link.href = qrCodeDataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log(`📥 QR Code downloaded: ${fileName}`);
};

const printQRCode = () => {
  if (!qrCodeDataURL || !qrCodeEquipment) return;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Equipment QR Code - ${qrCodeEquipment.name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 20px;
            margin: 0;
            background: white;
          }
          .qr-container {
            display: inline-block;
            border: 2px solid #333;
            padding: 20px;
            margin: 20px;
            background: white;
          }
          .item-info {
            margin-bottom: 20px;
          }
          .item-info h2 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 20px;
          }
          .item-details {
            text-align: left;
            margin: 10px 0;
          }
          .item-details p {
            margin: 5px 0;
            font-size: 14px;
            color: #333;
          }
          .item-details strong {
            color: #000;
          }
          img {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
          }
          .footer {
            margin-top: 15px;
            font-size: 12px;
            color: #666;
          }
          .scan-instruction {
            background: #f0f9ff;
            padding: 10px;
            border-radius: 8px;
            margin-top: 15px;
            color: #1e40af;
            font-size: 13px;
          }
          @media print {
            body { margin: 0; }
            .qr-container { border: 2px solid #333; }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <div class="item-info">
            <h2>⚙️ ${qrCodeEquipment.name}</h2>
            <div class="item-details">
              <p><strong>Item Code:</strong> ${qrCodeEquipment.itemCode}</p>
              <p><strong>Category:</strong> ${qrCodeEquipment.category}</p>
              <p><strong>Location:</strong> ${qrCodeEquipment.location || 'Not specified'}</p>
              <p><strong>Status:</strong> ${qrCodeEquipment.status}</p>
              <p><strong>Useful Life:</strong> ${qrCodeEquipment.usefulLife} years</p>
              <p><strong>Amount:</strong> ₱${qrCodeEquipment.amount ? parseFloat(qrCodeEquipment.amount).toFixed(2) : '0.00'}</p>
            </div>
          </div>
          <img src="${qrCodeDataURL}" alt="QR Code for ${qrCodeEquipment.name}" />
          <div class="scan-instruction">
            📱 Scan this QR code to view equipment details and repair history
          </div>
          <div class="footer">
            <p>Universidad De Manila - Equipment Management System</p>
            <p>Generated: ${new Date().toLocaleDateString()}</p>
          </div>
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

  const handleEquipmentClick = (equipment) => {
    setSelectedEquipment(equipment);
    setIsEquipmentOverviewOpen(true);
  };

  const handleCloseEquipmentOverview = () => {
    setIsEquipmentOverviewOpen(false);
    setSelectedEquipment(null);
  };

  const handleCloseQRModal = () => {
    setIsQRModalOpen(false);
    setQrCodeDataURL('');
    setQrCodeEquipment(null);
  };

  const handleRefreshEquipment = () => {
    loadEquipment();
  };

  if (loading && equipmentData.length === 0) {
    return (
      <div className="equipment-page-container">
        <div className="loading-state">
          <h2>Loading equipment...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="equipment-page-container">
      {error && (
        <div className="error-banner" style={{
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          padding: '10px',
          marginBottom: '20px',
          borderRadius: '4px',
          textAlign: 'center',
          border: '1px solid #fecaca'
        }}>
          <strong>Error:</strong> {error}
          <button 
            onClick={handleRefreshEquipment}
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
      
        <div className="equipment-header">
    <h2 className="page-title">Equipment Inventory</h2>
    <div className="table-controls">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search by code, name, description..."
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

      {equipmentData.length === 0 && !loading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#888',
          background: '#1a1a1a',
          borderRadius: '8px',
          margin: '20px 0'
        }}>
          <h3>No Equipment Found</h3>
          <p>{searchTerm ? `No equipment matches your search "${searchTerm}".` : 'No equipment has been added yet.'}</p>
          {!searchTerm && (
            <button 
              className="add-equipment-button" 
              onClick={handleAddEquipmentToggle}
              style={{ marginTop: '15px' }}
            >
              Add Your First Equipment
            </button>
          )}
        </div>
      ) : (
        <table className="equipment-table">
          <thead>
            <tr>
              <th style={{ width: '20%' }}>ITEM CODE</th>
              <th style={{ width: '25%' }}>EQUIPMENT NAME</th>
              <th style={{ width: '15%' }}>STATUS</th>
              <th style={{ width: '15%' }}>REMARKS</th>
              <th style={{ width: '15%' }}>AMOUNT</th>
              <th style={{ width: '10%' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEquipment.map((equipment, index) => {
              const lccBadge = getLCCBadge(equipment);
              return (
                <tr key={equipment._id || index}>
                  <td style={{ width: '20%' }}>{equipment.itemCode}</td>
                  <td style={{ width: '25%' }}>
                    <span 
                      className="description-clickable"
                      onClick={() => handleEquipmentClick(equipment)}
                      title="Click to view details"
                    >
                      {equipment.name}
                    </span>
                  </td>
                  <td style={{ width: '15%' }}>
                    <span style={{
                      color: equipment.status === 'Within-Useful-Life' ? '#10b981' : 
                             equipment.status === 'Maintenance' ? '#f59e0b' :
                             equipment.status === 'Beyond-Useful-Life' ? '#ef4444' : '#ef4444',
                      fontWeight: '500'
                    }}>
                      {equipment.status}
                    </span>
                  </td>
                  <td style={{ width: '15%' }}>
                    {lccBadge && (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: lccBadge.color,
                        backgroundColor: lccBadge.bgColor,
                        border: `1px solid ${lccBadge.color}`
                      }}>
                        {lccBadge.text}
                      </span>
                    )}
                  </td>
                  <td style={{ width: '15%' }}>₱{equipment.amount ? parseFloat(equipment.amount).toFixed(2) : '0.00'}</td>
                  <td style={{ width: '10%', padding: '12px 30px 12px 20px' }}>
                    <div className="action-buttons-container" style={{ display: 'flex', gap: '8px', justifyContent: 'center', width: '100%' }}>
                      <button 
                        className="view-icon-btn"
                        onClick={() => handleEquipmentClick(equipment)}
                        title="View equipment details"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {currentUser?.role === 'admin' && (
                        <button 
                          className="delete-icon-btn"
                          onClick={() => handleDeleteEquipment(equipment._id, equipment.name)}
                          title="Delete equipment"
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
              );
            })}
          </tbody>
        </table>
      )}

      {filteredEquipment.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredEquipment.length)} of {filteredEquipment.length} entries
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

      {equipmentData.length > 0 && (
        <button 
          className="add-equipment-button" 
          onClick={handleAddEquipmentToggle}
          disabled={loading || addingEquipment}
        >
          {addingEquipment ? 'Adding Equipment...' : 'Add New Equipment'}
        </button>
      )}

      {/* Add Equipment Overlay */}
      {isAddEquipmentOverlayOpen && (
        <div className="overlay" onClick={handleAddEquipmentToggle}>
          <div className="add-equipment-content" onClick={(e) => e.stopPropagation()}>
            <h3>INPUT EQUIPMENT DETAILS</h3>
            
            <div className="form-section">
              <div className="form-group">
                <label>ITEM CODE:</label>
                <div className="item-code-container">
                  <input 
                    type="text" 
                    name="itemCode" 
                    value={newEquipment.itemCode} 
                    onChange={handleEquipmentInputChange}
                    placeholder="System Generated"
                    className="item-code-input"
                  />
                  <button 
                    type="button" 
                    className="generate-btn"
                    onClick={generateEquipmentCode}
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>EQUIPMENT NAME: *</label>
                <input 
                  type="text" 
                  name="name" 
                  value={newEquipment.name} 
                  onChange={handleEquipmentInputChange}
                  placeholder="Enter equipment name (e.g., 'PC', 'Microscope')"
                  required
                />
              </div>

              <div className="form-group">
  <label>USEFUL LIFE: *</label>
  <div className="useful-life-container">
    <input 
      type="number" 
      name="usefulLife" 
      value={newEquipment.usefulLife} 
      onChange={handleEquipmentInputChange}
      placeholder="Enter years"
      min="1"
      max="50"
      required
    />
    <span className="useful-life-unit">years</span>
  </div>
</div>

<div className="form-group">
  <label>AMOUNT: *</label>
  <div className="amount-container">
    <span className="currency-symbol">₱</span>
    <input 
      type="number" 
      name="amount" 
      value={newEquipment.amount} 
      onChange={handleEquipmentInputChange}
      placeholder="0.00"
      min="0"
      step="0.01"
      required
    />
  </div>
</div>

              <div className="form-group">
                <label>DESCRIPTION: *</label>
                <textarea 
                  name="description" 
                  value={newEquipment.description} 
                  onChange={handleEquipmentInputChange}
                  placeholder="Enter detailed description (e.g., 'Broken display, needs repair')"
                  rows="3"
                  required
                />
              </div>

              <div className="form-group">
                <label>CATEGORY: *</label>
                <select 
                  name="category" 
                  value={newEquipment.category} 
                  onChange={handleEquipmentInputChange}
                  required
                >
                  <option value="">Select Category</option>
                  {equipmentCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>LOCATION:</label>
                <input 
                  type="text" 
                  name="location" 
                  value={newEquipment.location} 
                  onChange={handleEquipmentInputChange}
                  placeholder="Enter location (optional)"
                />
              </div>

              {/* Removed direct status input as it's now calculated */}
              {/* <div className="form-group">
                <label>STATUS: *</label>
                <select 
                  name="status" 
                  value={newEquipment.status} 
                  onChange={handleEquipmentInputChange}
                  required
                >
                  {equipmentStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div> */}



              <div className="form-group">
                 <label>DATE OF RECEIPT:</label>
                 <input
                  type="date"
                  name="date"
                  value={newEquipment.date}
                  onChange={handleEquipmentInputChange}
                  className="date-input"
                />
              </div>

              <div className="form-group">
                <label>ITEM PICTURE:</label>
                <div className="file-input-container">
                  <input 
                    type="file" 
                    id="equipmentFileInput"
                    onChange={handleEquipmentFileChange}
                    accept="image/*,.pdf,.doc,.docx"
                    style={{ display: 'none' }}
                  />
                  <button 
                    type="button" 
                    className="file-input-btn"
                    onClick={() => document.getElementById('equipmentFileInput').click()}
                  >
                    Choose File
                  </button>
                  <span className="file-name">
                    {newEquipment.itemPicture ? newEquipment.itemPicture.name : 'No file chosen'}
                  </span>
                </div>
              </div>
            </div>

            <div className="upload-section">
  <h4>UPLOAD FILES (DOCUMENTS)</h4>
  <div 
    className={`file-drop-zone ${equipmentDocDragActive ? 'drag-active' : ''}`}
    onDragEnter={handleEquipmentDocDrag}
    onDragLeave={handleEquipmentDocDrag}
    onDragOver={handleEquipmentDocDrag}
    onDrop={handleEquipmentDocDrop}
    onClick={() => document.getElementById('equipmentDocFileInput').click()}
  >
    <input 
      type="file" 
      id="equipmentDocFileInput"
      onChange={handleEquipmentDocFileChange}
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
  
  {equipmentDocumentFiles.length > 0 && (
    <div className="selected-docs-list" style={{ marginTop: '15px' }}>
      <h5 style={{ fontSize: '14px', color: '#fff', marginBottom: '10px' }}>Selected Documents ({equipmentDocumentFiles.length}):</h5>
      {equipmentDocumentFiles.map((file, index) => (
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
            onClick={() => removeEquipmentDocumentFile(index)}
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
                onClick={handleAddEquipment}
                disabled={addingEquipment}
              >
                {addingEquipment ? 'ADDING...' : 'ADD EQUIPMENT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Overview Overlay */}
      {isEquipmentOverviewOpen && selectedEquipment && (
        <div className="overlay" onClick={handleCloseEquipmentOverview}>
          <div className="item-overview-content" onClick={(e) => e.stopPropagation()}>
            <h3>Equipment Overview</h3>
            
            <div className="item-overview-layout">
               {/* IMAGE SECTION - START */}
        <div className="item-image-placeholder">
          {/* If image exists, display it */}
          {selectedEquipment.has_image && selectedEquipment.image_data ? (
            <div style={{ 
              position: 'relative', 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: '30px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Actual Image */}
              <img
                key={`${selectedEquipment._id}-${selectedEquipment.image_filename}`}
                src={getImageUrl(selectedEquipment)}
                alt={selectedEquipment.name || "Equipment image"}
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  objectFit: 'contain',
                  objectPosition: 'center'
                }}
                onLoad={(e) => {
                  console.log('✅ Image loaded successfully:', selectedEquipment.image_filename);
                }}
                onError={(e) => {
                  console.error('❌ Image failed to load:', e);
                  e.target.style.display = 'none';
                  const errorDiv = document.createElement('div');
                  errorDiv.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 300px;
                    background-color: #f0f0f0;
                    border-radius: 8px;
                    color: #999;
                  `;
                  errorDiv.innerHTML = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.5; margin-bottom: 10px;">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                      <path d="M21 15L16 10M3 20L8 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <p style="margin: 0; font-size: 14px;">Failed to load image</p>
                  `;
                  e.target.parentElement.appendChild(errorDiv);
                }}
              />
              
              {/* Change Image Button Overlay */}
              <button
                onClick={() => document.getElementById('overviewImageInput').click()}
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(0, 0, 0, 0)',
                  padding: '3px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  border: 'none',
                  height: '100%',
                  width: '100%'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.9)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(0, 0, 0, 0)'}
              >
              </button>
            </div>
          ) : (

            <div 
              className="placeholder-box" 
              onClick={() => document.getElementById('overviewImageInput').click()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '30px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                color: '#999',
                cursor: 'pointer',
                border: '2px dashed #ddd',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.backgroundColor = 'rgba(102, 126, 234, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#ddd';
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
            >
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.3, marginBottom: '10px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                <path d="M21 15L16 10M3 20L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p style={{ margin: '10px 0 5px 0', fontSize: '16px', fontWeight: '600' }}>No Image</p>
              <small style={{ color: '#bbb' }}>Click to upload</small>
            </div>
          )}
          
          {/* Hidden File Input */}
          <input
            type="file"
            id="overviewImageInput"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                console.log('📁 File selected:', file.name, file.size, file.type);
                handleImageUploadForSelectedEquipment(file);
              }
              e.target.value = '';
            }}
            accept="image/jpeg,image/png,image/jpg"
            style={{ display: 'none' }}
          />
      </div>
        
              <div className="item-details">
                <div className="detail-row">
                  <span className="detail-label">Equipment Name:</span>
                  <span className="detail-value">{selectedEquipment.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Item Code:</span>
                  <span className="detail-value">{selectedEquipment.itemCode}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Useful Life (Years):</span>
                  <span className="detail-value">{selectedEquipment.usefulLife}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Amount:</span>
                  <span className="detail-value">{selectedEquipment.amount}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">{selectedEquipment.category}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Location:</span>
                  <span className="detail-value">{selectedEquipment.location || 'Not specified'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value" style={{
                    color: selectedEquipment.status === 'Within-Useful-Life' ? '#28a745' : 
                           selectedEquipment.status === 'Maintenance' ? '#ffc107' :
                           selectedEquipment.status === 'Beyond-Useful-Life' ? '#ef4444' : '#ef4444'
                  }}>
                    {selectedEquipment.status}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">{selectedEquipment.date || 'Not specified'}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{selectedEquipment.description}</span>
                </div>
              </div>
            </div>


            
            <div className="item-overview-actions">
  <button className="action-btn repair-btn" onClick={handleReportRepair}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 12L11 15L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    Report Repair
  </button>
  
  <button className="action-btn update-btn" onClick={handleUpdateEquipment}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    Update Equipment
  </button>

  <button className="action-btn view-stock-btn" onClick={handleViewMaintenanceLog}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    View Maintenance Log ▪
  </button>
  
  <button 
  className="action-btn view-docs-btn"
  onClick={handleViewEquipmentDocuments}
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
    onClick={() => generateQRCode(selectedEquipment)}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="7" y="7" width="3" height="3" fill="currentColor"/>
      <rect x="14" y="7" width="3" height="3" fill="currentColor"/>
      <rect x="7" y="14" width="3" height="3" fill="currentColor"/>
      <rect x="14" y="14" width="3" height="3" fill="currentColor"/>
      <rect x="11" y="11" width="2" height="2" fill="currentColor"/>
    </svg>
    Generate QR-code ⚙
  </button>
</div>
            
            <button className="close-overview-btn" onClick={handleCloseEquipmentOverview}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal for Equipment */}
      // Replace your existing QR Modal in EquipmentPage.js with this version

{isQRModalOpen && qrCodeEquipment && (
  <div className="overlay" onClick={handleCloseQRModal}>
    <div className="qr-modal-content" onClick={(e) => e.stopPropagation()} style={{
      maxWidth: '600px',
      maxHeight: '90vh',
      overflowY: 'auto'
    }}>
      <div className="qr-status">Generated</div>
      <h3>Equipment QR Code - {qrCodeEquipment.name}</h3>
      
      <div className="qr-display-section">
        {/* QR Code Display */}
        <div className="qr-code-container">
          <div className="qr-code-wrapper">
            <div className="qr-code-display">
              <img src={qrCodeDataURL} alt={`QR Code for ${qrCodeEquipment.name}`} />
            </div>
          </div>
          <div className="qr-brand-text">Equipment Inventory</div>
          <div className="qr-timestamp">
            Generated: {new Date().toLocaleDateString()}
          </div>
        </div>
        
        {/* Equipment Information */}
        <div className="qr-item-info">
          <div className="qr-detail-row">
            <span className="qr-detail-label">Item Code:</span>
            <span className="qr-detail-value highlight">{qrCodeEquipment.itemCode}</span>
          </div>
          
          <div className="qr-detail-row">
            <span className="qr-detail-label">Equipment Name:</span>
            <span className="qr-detail-value">{qrCodeEquipment.name}</span>
          </div>
          
          <div className="qr-detail-row">
            <span className="qr-detail-label">Category:</span>
            <span className="qr-detail-value">{qrCodeEquipment.category}</span>
          </div>
          
          <div className="qr-detail-row">
            <span className="qr-detail-label">Location:</span>
            <span className="qr-detail-value">{qrCodeEquipment.location || 'Not specified'}</span>
          </div>
          
          <div className="qr-detail-row">
            <span className="qr-detail-label">Status:</span>
            <span className="qr-detail-value" style={{
              color: qrCodeEquipment.status === 'Within-Useful-Life' ? '#10b981' : 
                     qrCodeEquipment.status === 'Maintenance' ? '#f59e0b' :
                     qrCodeEquipment.status === 'Beyond-Useful-Life' ? '#ef4444' : '#ef4444'
            }}>
              {qrCodeEquipment.status}
            </span>
          </div>

          <div className="qr-detail-row">
            <span className="qr-detail-label">Amount:</span>
            <span className="qr-detail-value">₱{qrCodeEquipment.amount ? parseFloat(qrCodeEquipment.amount).toFixed(2) : '0.00'}</span>
          </div>

          <div className="qr-detail-row">
            <span className="qr-detail-label">Useful Life:</span>
            <span className="qr-detail-value">{qrCodeEquipment.usefulLife} years</span>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="qr-actions" style={{ marginTop: '20px' }}>
        <button className="qr-action-btn download-btn" onClick={downloadQRCode}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download QR
        </button>
        
        <button className="qr-action-btn print-btn" onClick={printQRCode}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="6,9 6,2 18,2 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 18H4C3.46957 18 2.96086 17.7893 2.58579 17.4142C2.21071 17.0391 2 16.5304 2 16V11C2 10.4696 2.21071 9.96086 2.58579 9.58579C2.96086 9.21071 3.46957 9 4 9H20C20.5304 9 21.0391 9.21071 21.4142 9.58579C21.7893 9.96086 22 10.4696 22 11V16C22 16.5304 21.7893 17.0391 21.4142 17.4142C21.0391 17.7893 20.5304 18 20 18H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="6,14 18,14 18,22 6,22 6,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Print QR
        </button>
        
        <button 
          className="qr-action-btn" 
          onClick={() => {
            const qrData = {
              type: 'equipment',
              itemCode: qrCodeEquipment.itemCode,
              name: qrCodeEquipment.name,
              description: qrCodeEquipment.description,
              usefulLife: qrCodeEquipment.usefulLife,
              amount: qrCodeEquipment.amount,
              category: qrCodeEquipment.category,
              location: qrCodeEquipment.location,
              status: qrCodeEquipment.status,
              date: qrCodeEquipment.date,
              id: qrCodeEquipment._id,
              repairHistoryCount: qrCodeEquipment.repairHistory?.length || 0,
              timestamp: new Date().toISOString(),
              scanUrl: `${process.env.REACT_APP_API_URL}/api/equipment/scan/${qrCodeEquipment._id}`
            };
            navigator.clipboard.writeText(JSON.stringify(qrData, null, 2));
            alert('Equipment data and scan URL copied to clipboard!');
          }}
        >
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

      {/* Report Repair Modal */}
{showReportRepairModal && selectedEquipment && (
  <div className="overlay" onClick={() => setShowReportRepairModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <h3>Report Repair - {selectedEquipment.name}</h3>

      <div className="repair-form">
        <div className="form-group">
          <label>Equipment Code:</label>
          <input
            type="text"
            value={selectedEquipment.itemCode}
            disabled
            className="disabled-input"
          />
        </div>

        <div className="form-group">
          <label>Report Date: *</label>
          <input
            type="date"
            name="reportDate"
            value={repairData.reportDate}
            onChange={handleRepairDataChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Report Details: *</label>
          <textarea
            name="reportDetails"
            value={repairData.reportDetails}
            onChange={handleRepairDataChange}
            placeholder="Describe the issue or repair needed..."
            rows="4"
            required
          />
        </div>
      </div>

      <div className="modal-actions">
        <button
          className="submit-btn"
          onClick={submitRepairReport}
        >
          Submit Repair Report
        </button>
        <button
          className="cancel-btn"
          onClick={() => setShowReportRepairModal(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

{/* Update Equipment Modal */}
{showUpdateEquipmentModal && selectedEquipment && (
  <div className="overlay" onClick={() => setShowUpdateEquipmentModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <h3>Update Equipment Repair - {selectedEquipment.name}</h3>
      
      <div className="update-form">
        <div className="form-group">
          <label>Item Code:</label>
          <input 
            type="text" 
            value={selectedEquipment.itemCode}
            disabled
            className="disabled-input"
          />
        </div>

        <div className="form-group">
          <label>Description:</label>
          <textarea 
            value={selectedEquipment.description}
            disabled
            className="disabled-input"
            rows="2"
          />
        </div>

        <div className="form-group">
          <label>Repair Date: *</label>
          <input 
            type="date" 
            name="repairDate"
            value={updateData.repairDate}
            onChange={handleUpdateDataChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Repair Details: *</label>
          <textarea 
            name="repairDetails"
            value={updateData.repairDetails}
            onChange={handleUpdateDataChange}
            placeholder="Describe what was repaired..."
            rows="3"
            required
          />
        </div>

        <div className="form-group">
          <label>Amount Used: *</label>
          <div className="amount-container">
            <span className="currency-symbol">₱</span>
            <input 
              type="number" 
              name="amountUsed"
              value={updateData.amountUsed}
              onChange={handleUpdateDataChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>
      </div>

      <div className="modal-actions">
        <button 
          className="submit-btn" 
          onClick={submitEquipmentUpdate}
        >
          Complete Repair
        </button>
        <button 
          className="cancel-btn" 
          onClick={() => setShowUpdateEquipmentModal(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

    {showRepairDocument && selectedEquipment && (
  <div className="modal-overlay" onClick={closeRepairDocument}>
    <div className="repair-card-modal" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close-btn" onClick={closeRepairDocument}>
        ×
      </button>
      
      <div className="modal-header">
        <img src="/UDMLOGO.png" alt="University Logo" className="modal-logo" />
        <div className="modal-title-section">
          <h3 className="modal-university-name">Universidad De Manila</h3>
          <p className="modal-document-type">Repair History</p>
        </div>
      </div>
      
      <div className="modal-divider"></div>
      
      <div className="modal-info-table">
        <table className="info-details-table">
          <tbody>
            <tr>
              <td className="info-label-cell">Equipment Name:</td>
              <td className="info-value-cell">{selectedEquipment.name || 'N/A'}</td>
              <td className="info-label-cell">Item Code:</td>
              <td className="info-value-cell">{selectedEquipment.itemCode || 'N/A'}</td>
            </tr>
            <tr>
  <td className="info-label-cell">Description:</td>
  <td className="info-value-cell">{selectedEquipment.description || 'N/A'}</td>
  <td className="info-label-cell">Price:</td>
  <td className="info-value-cell">₱{selectedEquipment.amount ? parseFloat(selectedEquipment.amount).toFixed(2) : '0.00'}</td>
</tr>
          </tbody>
        </table>
      </div>
      
      <div className="modal-table-container">
  <table className="modal-repair-table">
    <thead>
      <tr>
        <th className="date-repair-col">Repair Date</th>
        <th className="details-col">Repair Details</th>
        <th className="amount-col">Amount Used</th>
      </tr>
    </thead>
    <tbody>
  {selectedEquipment.repairHistory && selectedEquipment.repairHistory.length > 0 ? (
    <>
      {[...selectedEquipment.repairHistory]
        .sort((a, b) => new Date(a.repairDate) - new Date(b.repairDate))
        .map((repair, index) => (
        <tr key={index}>
          <td className="date-repair-cell">{repair.repairDate}</td>
          <td className="details-cell">{repair.repairDetails}</td>
          <td className="amount-cell">₱{parseFloat(repair.amountUsed || 0).toFixed(2)}</td>
        </tr>
      ))}
      {/* Fill remaining rows */}
      {Array.from({ length: Math.max(0, 11 - selectedEquipment.repairHistory.length) }, (_, index) => (
        <tr key={`empty-${index}`}>
          <td className="date-repair-cell"></td>
          <td className="details-cell"></td>
          <td className="amount-cell"></td>
        </tr>
      ))}
    </>
  ) : (
    /* Show empty rows if no repair history */
    Array.from({ length: 11 }, (_, index) => (
      <tr key={index}>
        <td className="date-repair-cell"></td>
        <td className="details-cell"></td>
        <td className="amount-cell"></td>
      </tr>
    ))
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
                <p style="font-size: 12px; margin: 2px 0 0 0; color: #666;">Repair History</p>
              </div>
            </div>

            <div style="border-top: 1px solid #333; margin: 20px 0;"></div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #333;">
              <tr>
                <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; background: #f8f9fa; font-weight: bold; width: 15%; color: #333;">Equipment Name:</td>
                <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; width: 35%; text-decoration: underline;">${selectedEquipment.name || 'N/A'}</td>
                <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; background: #f8f9fa; font-weight: bold; width: 15%; color: #333;">Item Code:</td>
                <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; width: 35%; text-decoration: underline;">${selectedEquipment.itemCode || 'N/A'}</td>
              </tr>
              <tr>
  <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; background: #f8f9fa; font-weight: bold; color: #333;">Description:</td>
  <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; text-decoration: underline;">${selectedEquipment.description || 'N/A'}</td>
  <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; background: #f8f9fa; font-weight: bold; color: #333;">Price Amount:</td>
  <td style="padding: 8px 12px; border: 1px solid #333; font-size: 12px; text-decoration: underline;">₱${selectedEquipment.amount ? parseFloat(selectedEquipment.amount).toFixed(2) : '0.00'}</td>
</tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; border: 2px solid #333; margin-top: 10px;">
              <thead>
                <tr>
                  <th style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; background: #f8f9fa; font-weight: bold; width: 25%;">Repair Date</th>
                  <th style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; background: #f8f9fa; font-weight: bold; width: 50%;">Repair Details</th>
                  <th style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; background: #f8f9fa; font-weight: bold; width: 25%;">Amount Used</th>
                </tr>
              </thead>
              <tbody>
                ${selectedEquipment.repairHistory && selectedEquipment.repairHistory.length > 0 
                  ? [...selectedEquipment.repairHistory]
                      .sort((a, b) => new Date(a.repairDate) - new Date(b.repairDate))
                      .map(repair => `
                        <tr>
                          <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${repair.repairDate}</td>
                          <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">${repair.repairDetails}</td>
                          <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">₱${parseFloat(repair.amountUsed || 0).toFixed(2)}</td>
                        </tr>
                      `).join('')
                  : ''
                }
                ${Array.from({ length: 20 }, () => `
                  <tr>
                    <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                    <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                    <td style="border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      const opt = {
        margin: 0.5,
        filename: `Repair_History_${selectedEquipment.name || 'Equipment'}_${selectedEquipment.itemCode || ''}.pdf`,
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
      closeRepairDocument();
      printWindow.document.write(`
        <html>
          <head>
            <title>Repair History - ${selectedEquipment.name || 'Equipment'}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background: white;
              }
              .print-container {
                max-width: 800px;
                margin: 0 auto;
                border: 2px solid #333;
                border-radius: 8px;
                padding: 30px;
              }
              .print-header {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 20px;
                gap: 15px;
              }
              .print-logo {
                width: 50px;
                height: 50px;
              }
              .print-title {
                text-align: center;
              }
              .print-university {
                font-size: 16px;
                font-weight: bold;
                margin: 0;
                color: #333;
              }
              .print-document-type {
                font-size: 12px;
                margin: 2px 0 0 0;
                color: #666;
              }
              .print-divider {
                border-top: 1px solid #333;
                margin: 20px 0;
              }
              .print-info-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                border: 1px solid #333;
              }
              .print-info-table td {
                padding: 8px 12px;
                border: 1px solid #333;
                font-size: 12px;
              }
              .print-info-label {
                background: #f8f9fa;
                font-weight: bold;
                width: 15%;
                color: #333;
              }
              .print-info-value {
                width: 35%;
                text-decoration: underline;
              }
              .print-table {
                width: 100%;
                border-collapse: collapse;
                border: 2px solid #333;
                margin-top: 10px;
              }
              .print-table th,
              .print-table td {
                border: 1px solid #333;
                padding: 8px;
                text-align: center;
                font-size: 11px;
              }
              .print-table th {
                background: #f8f9fa;
                font-weight: bold;
              }
              .print-table .details-col {
                width: 50%;
                text-align: center;
              }
              .print-table .date-col { width: 25%; }
              .print-table .amount-col { width: 25%; }

              @media print {
                body { padding: 0; }
                .print-container { 
                  border: 1px solid #333;
                  box-shadow: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              <div class="print-header">
                <img src="/UDMLOGO.png" alt="University Logo" class="print-logo" />
                <div class="print-title">
                  <h3 class="print-university">Universidad De Manila</h3>
                  <p class="print-document-type">Repair History</p>
                </div>
              </div>
              
              <div class="print-divider"></div>
              
              <table class="print-info-table">
                <tr>
                  <td class="print-info-label">Equipment Name:</td>
                  <td class="print-info-value">${selectedEquipment.name || 'N/A'}</td>
                  <td class="print-info-label">Item Code:</td>
                  <td class="print-info-value">${selectedEquipment.itemCode || 'N/A'}</td>
                </tr>
                <tr>
  <td class="print-info-label">Description:</td>
  <td class="print-info-value">${selectedEquipment.description || 'N/A'}</td>
  <td class="print-info-label">Price Amount:</td>
  <td class="print-info-value">₱${selectedEquipment.amount ? parseFloat(selectedEquipment.amount).toFixed(2) : '0.00'}</td>
</tr>
              </table>

              <table class="print-table">
                <thead>
                  <tr>
                    <th class="date-col">Repair Date</th>
                    <th class="details-col">Repair Details</th>
                    <th class="amount-col">Amount Used</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedEquipment.repairHistory && selectedEquipment.repairHistory.length > 0 
                    ? [...selectedEquipment.repairHistory]
                        .sort((a, b) => new Date(a.repairDate) - new Date(b.repairDate))
                        .map(repair => `
                        <tr>
                          <td>${repair.repairDate}</td>
                          <td>${repair.repairDetails}</td>
                          <td>₱${parseFloat(repair.amountUsed || 0).toFixed(2)}</td>
                        </tr>
                      `).join('') 
                      : ''}
                  ${Array.from({ length: 20 }, () => `
                    <tr>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
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
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <polyline points="6,9 6,2 18,2 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 18H4C3.46957 18 2.96086 17.7893 2.58579 17.4142C2.21071 17.0391 2 16.5304 2 16V11C2 10.4696 2.21071 9.96086 2.58579 9.58579C2.96086 9.21071 3.46957 9 4 9H20C20.5304 9 21.0391 9.21071 21.4142 9.58579C21.7893 9.96086 22 10.4696 22 11V16C22 16.5304 21.7893 17.0391 21.4142 17.4142C21.0391 17.7893 20.5304 18 20 18H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="6,14 18,14 18,22 6,22 6,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    Print Repair History
  </button>
</div>
  </div>
  </div>
)}

{/* Equipment Document Viewer Modal */}
<EquipmentDocumentViewer 
  equipment={selectedEquipment}
  isOpen={isEquipmentDocumentViewerOpen}
  onClose={handleCloseEquipmentDocumentViewer}
/>
    </div>
  );
}

export default EquipmentPage;
