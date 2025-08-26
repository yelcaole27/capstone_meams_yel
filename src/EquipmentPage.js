import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import EquipmentAPI from './EquipmentApi'; // Import the API service
import './EquipmentPage.css';

function EquipmentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isEquipmentOverviewOpen, setIsEquipmentOverviewOpen] = useState(false);
  const [equipmentData, setEquipmentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Add Equipment Overlay states
  const [isAddEquipmentOverlayOpen, setIsAddEquipmentOverlayOpen] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    itemCode: '',
    name: '',        // Equipment name (what displays in table)
    quantity: '',
    unit: '',
    description: '', // Separate description field
    category: '',
    location: '',
    status: 'Within-Useful-Life',
    serialNo: '',
    date: '',
    itemPicture: null
  });
  const [dragActive, setDragActive] = useState(false);
  const [addingEquipment, setAddingEquipment] = useState(false);
  
  // QR Code states
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [qrCodeEquipment, setQrCodeEquipment] = useState(null);

  // Maintenance
 // Add this state to your existing useState declarations
const [showRepairDocument, setShowRepairDocument] = useState(false);

// Add this function to handle the View Maintenance Log button click
const handleViewMaintenanceLog = () => {
  setShowRepairDocument(true);
};

// Add this function to close the repair document
const closeRepairDocument = () => {
  setShowRepairDocument(false);
};

// Add this function to handle printing
const handlePrintStockCard = () => {
  window.print();
};

  // Equipment categories and statuses
  const equipmentCategories = ['Mechanical', 'Electrical', 'Medical', 'IT Equipment', 'Laboratory', 'HVAC', 'Safety'];
  const equipmentStatuses = ['Within-Useful-Life', 'Maintenance', 'Beyond-Useful-Life',];
  const equipmentUnits = ['UNIT', 'SET', 'PIECE', 'LOT'];

  // Load equipment from database when component mounts
   useEffect(() => {
    loadEquipment();
  }, []);

  // Enhanced load equipment function with better error handling
  const loadEquipment = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const equipment = await EquipmentAPI.getAllEquipment();
      
      // Transform database data to match your current structure
       const transformedEquipment = equipment.map(item => ({
  _id: item._id || item.id,
  itemCode: item.itemCode || item.item_code || `MED-E-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
  quantity: item.quantity || 1,
  unit: item.unit || 'UNIT',
  name: item.name || 'Unknown Equipment',
  description: item.description || 'No description available',
  category: item.category || 'General',
  location: item.location || 'Unknown',
  status: item.status || 'Within-Useful-Life',
  serialNo: item.serialNo || item.serial_number || `SN-${Math.floor(Math.random() * 10000)}`,
  supplier: item.supplier || '',
  unit_price: item.unit_price || 0,
  date: item.date || ''  // NEW FIELD: Date field
}));
      
      setEquipmentData(transformedEquipment);
      console.log(`✅ Loaded ${transformedEquipment.length} equipment items from database`);
      
    } catch (err) {
      console.error('Failed to load equipment:', err);
      setError(`Failed to load equipment: ${err.message}`);
      
      // Fallback to empty array instead of sample data to avoid confusion
      setEquipmentData([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipment = equipmentData.filter(item =>
    item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    item.serialNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add Equipment Overlay handlers
  const handleAddEquipmentToggle = () => {
    setIsAddEquipmentOverlayOpen(!isAddEquipmentOverlayOpen);
    if (isAddEquipmentOverlayOpen) {
      setNewEquipment({
        itemCode: '',
        name: '',          // Reset name
        quantity: '',
        unit: '',
        description: '',   // Reset description
        category: '',
        location: '',
        status: 'Within-Useful-Life',
        serialNo: '',
        date: '',
        itemPicture: null
      });
      setError(null);
    }
  };

  const handleEquipmentInputChange = (e) => {
    const { name, value } = e.target;
    setNewEquipment({ ...newEquipment, [name]: value });
  };

  const handleEquipmentFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (25MB limit)
      if (file.size > 25 * 1024 * 1024) {
        alert('File size must be less than 25MB');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid file type (JPEG, PNG, PDF, DOC, DOCX)');
        return;
      }
      
      setNewEquipment({ ...newEquipment, itemPicture: file });
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
      
      // Validate file size and type
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

  const generateEquipmentCode = () => {
    const categoryPrefix = newEquipment.category ? newEquipment.category.substring(0, 3).toUpperCase() : 'EQP';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const generatedCode = `${categoryPrefix}-E-${randomNum}`;
    setNewEquipment({ ...newEquipment, itemCode: generatedCode });
  };

  // Enhanced form validation
  const validateEquipmentForm = () => {
    const errors = [];
    
    if (!newEquipment.name.trim()) {
      errors.push('Equipment name is required');
    }
    
    if (!newEquipment.description.trim()) {
      errors.push('Description is required');
    }
    
    if (!newEquipment.quantity || parseInt(newEquipment.quantity) <= 0) {
      errors.push('Quantity must be a positive number');
    }
    
    if (!newEquipment.unit) {
      errors.push('Unit is required');
    }
    
    if (!newEquipment.category) {
      errors.push('Category is required');
    }
    
    if (!newEquipment.serialNo.trim()) {
      errors.push('Serial Number is required');
    }
    
    if (!newEquipment.status) {
      errors.push('Status is required');
    }
    
    return errors;
  };

  // Enhanced handleAddEquipment with better error handling and validation
  const handleAddEquipment = async () => {
    // Validate form
    const validationErrors = validateEquipmentForm();
    if (validationErrors.length > 0) {
      alert(`Please fix the following errors:\n• ${validationErrors.join('\n• ')}`);
      return;
    }

    // Check for duplicate serial number
    const duplicateSerial = equipmentData.find(item => 
      item.serialNo.toLowerCase() === newEquipment.serialNo.toLowerCase()
    );
    
    if (duplicateSerial) {
      alert('An equipment with this serial number already exists. Please use a unique serial number.');
      return;
    }

    try {
      setAddingEquipment(true);
      setError(null);
      
      // FIXED: Prepare data with correct mapping
      const equipmentData = {
  name: newEquipment.name.trim(),
  description: newEquipment.description.trim(),
  category: newEquipment.category,
  quantity: parseInt(newEquipment.quantity),
  unit: newEquipment.unit,
  location: newEquipment.location.trim() || '',
  status: newEquipment.status,
  serialNo: newEquipment.serialNo.trim(),
  itemCode: newEquipment.itemCode.trim() || `MED-E-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
  unit_price: 0,
  supplier: '',
  date: newEquipment.date  // NEW FIELD: Date field
};

      console.log('📤 Adding new equipment:', equipmentData);
      
      const savedEquipment = await EquipmentAPI.addEquipment(equipmentData);
      
      // FIXED: Transform the response to match your current data structure
      const newEquipmentItem = {
  _id: savedEquipment._id || savedEquipment.id,
  itemCode: equipmentData.itemCode,
  name: newEquipment.name.trim(),
  quantity: parseInt(newEquipment.quantity),
  unit: newEquipment.unit,
  description: newEquipment.description.trim(),
  category: newEquipment.category,
  location: newEquipment.location.trim(),
  status: newEquipment.status,
  serialNo: newEquipment.serialNo.trim(),
  itemPicture: newEquipment.itemPicture,
  supplier: '',
  unit_price: 0,
  date: newEquipment.date  // NEW FIELD: Date field
};

      setEquipmentData(prevData => [...prevData, newEquipmentItem]);
      
      alert(`Equipment "${newEquipment.name}" added successfully!`);
      
      handleAddEquipmentToggle();
      
      console.log('✅ Equipment added successfully');
      
    } catch (error) {
      console.error('❌ Error adding equipment:', error);
      setError(`Failed to add equipment: ${error.message}`);
      alert(`Failed to add equipment: ${error.message}`);
    } finally {
      setAddingEquipment(false);
    }
  };

  // Delete equipment function
  const handleDeleteEquipment = async (equipmentId, equipmentName) => {
    if (!window.confirm(`Are you sure you want to delete "${equipmentName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await EquipmentAPI.deleteEquipment(equipmentId);
      
      // Remove from local state
      setEquipmentData(prevData => prevData.filter(item => item._id !== equipmentId));
      
      // Close overview modal if the deleted item was selected
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

  // QR Code generation function
  const generateQRCode = async (equipment) => {
    try {
      // Create comprehensive QR code data for equipment
      const qrData = JSON.stringify({
        type: 'equipment',
        itemCode: equipment.itemCode,
        name: equipment.name,
        description: equipment.description,
        quantity: equipment.quantity,
        unit: equipment.unit,
        category: equipment.category,
        location: equipment.location,
        status: equipment.status,
        serialNo: equipment.serialNo,
        date: equipment.date,
        id: equipment._id,
        timestamp: new Date().toISOString(),
        generatedBy: 'Equipment Management System'
      });

      // Generate QR code as data URL with better quality
      const dataURL = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      setQrCodeDataURL(dataURL);
      setQrCodeEquipment(equipment);
      setIsQRModalOpen(true);
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  // Download QR code as image
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

  // Enhanced print QR code function
  const printQRCode = () => {
    if (!qrCodeDataURL || !qrCodeEquipment) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${qrCodeEquipment.name}</title>
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
            @media print {
              body { margin: 0; }
              .qr-container { border: 2px solid #333; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="item-info">
              <h2>${qrCodeEquipment.name}</h2>
              <div class="item-details">
                <p><strong>Item Code:</strong> ${qrCodeEquipment.itemCode}</p>
                <p><strong>Serial No:</strong> ${qrCodeEquipment.serialNo}</p>
                <p><strong>Category:</strong> ${qrCodeEquipment.category}</p>
                <p><strong>Location:</strong> ${qrCodeEquipment.location}</p>
                <p><strong>Status:</strong> ${qrCodeEquipment.status}</p>
                <p><strong>Quantity:</strong> ${qrCodeEquipment.quantity} ${qrCodeEquipment.unit}</p>
                <p><strong>Date:</strong> ${qrCodeEquipment.date || 'Not specified'}</p>
                <p><strong>Description:</strong> ${qrCodeEquipment.description}</p>
              </div>
            </div>
            <img src="${qrCodeDataURL}" alt="QR Code for ${qrCodeEquipment.name}" />
            <div class="footer">
              <p>Equipment Management System - Generated: ${new Date().toLocaleDateString()}</p>
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

  // Refresh equipment data
  const handleRefreshEquipment = () => {
    loadEquipment();
  };

  // Show loading state
  if (loading && equipmentData.length === 0) {
    return (
      <div className="equipment-page-container">
        <div className="loading-state">
          <h2>Loading equipment...</h2>
          <p>Please wait while we fetch equipment data from the database.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="equipment-page-container">
      {/* Enhanced Error Banner */}
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
              placeholder="Search by code, name, description, serial, or category..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 15L21 21M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          
          <button 
            className="refresh-btn" 
            onClick={handleRefreshEquipment}
            disabled={loading}
            style={{
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
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
              <th>ITEM CODE</th>
              <th>QUANTITY</th>
              <th>UNIT</th>
              <th>EQUIPMENT NAME</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredEquipment.map((equipment, index) => (
              <tr key={equipment._id || index}>
                <td>{equipment.itemCode}</td>
                <td>{equipment.quantity}</td>
                <td>{equipment.unit}</td>
                <td>
                  <span 
                    className="description-clickable"
                    onClick={() => handleEquipmentClick(equipment)}
                    title="Click to view details"
                  >
                    {equipment.name} {/* FIXED: Show name instead of description */}
                  </span>
                </td>
                <td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                <label>QUANTITY: *</label>
                <input 
                  type="number" 
                  name="quantity" 
                  value={newEquipment.quantity} 
                  onChange={handleEquipmentInputChange}
                  placeholder="Enter quantity"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>UNIT: *</label>
                <select 
                  name="unit" 
                  value={newEquipment.unit} 
                  onChange={handleEquipmentInputChange}
                  required
                >
                  <option value="">Select Unit</option>
                  {equipmentUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
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

              <div className="form-group">
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
              </div>

              <div className="form-group">
                <label>SERIAL NO.: *</label>
                <input 
                  type="text" 
                  name="serialNo" 
                  value={newEquipment.serialNo} 
                  onChange={handleEquipmentInputChange}
                  placeholder="Enter unique serial number"
                  required
                />
              </div>

              <div className="form-group">
                 <label>DATE:</label>
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
                className={`file-drop-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleEquipmentDrag}
                onDragLeave={handleEquipmentDrag}
                onDragOver={handleEquipmentDrag}
                onDrop={handleEquipmentDrop}
                onClick={() => document.getElementById('equipmentFileInput').click()}
              >
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
              <div className="item-image-placeholder">
                <div className="placeholder-box">No Image</div>
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
                  <span className="detail-label">Serial No.:</span>
                  <span className="detail-value">{selectedEquipment.serialNo}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">{selectedEquipment.category}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Quantity:</span>
                  <span className="detail-value">{selectedEquipment.quantity} {selectedEquipment.unit}</span>
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
                           selectedEquipment.status === 'Beyond-Useful-Life' ? '#fd7e14' : '#dc3545'
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
              
              <button className="action-btn view-docs-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                View Documents ◌
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
              
              <button 
                className="action-btn delete-btn"
                onClick={() => handleDeleteEquipment(selectedEquipment._id, selectedEquipment.name)}
                style={{ 
                  background: '#dc3545',
                  marginLeft: 'auto'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Delete Equipment
              </button>
            </div>
            
            <button className="close-overview-btn" onClick={handleCloseEquipmentOverview}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal for Equipment */}
      {isQRModalOpen && qrCodeEquipment && (
        <div className="overlay" onClick={handleCloseQRModal}>
          <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="qr-status">Generated</div>
            <h3>QR Code - {qrCodeEquipment.name}</h3>
            
            <div className="qr-display-section">
              {/* Compact QR Code Display */}
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
                  <span className="qr-detail-label">Serial No.:</span>
                  <span className="qr-detail-value">{qrCodeEquipment.serialNo}</span>
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
                  <span className="qr-detail-value">{qrCodeEquipment.status}</span>
                </div>

                <div className="qr-detail-row">
                  <span className="qr-detail-label">Quantity:</span>
                  <span className="qr-detail-value">{qrCodeEquipment.quantity} {qrCodeEquipment.unit}</span>
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
                // Copy comprehensive QR data to clipboard
                const qrData = {
                  type: 'equipment',
                  itemCode: qrCodeEquipment.itemCode,
                  name: qrCodeEquipment.name,
                  description: qrCodeEquipment.description,
                  serialNo: qrCodeEquipment.serialNo,
                  category: qrCodeEquipment.category,
                  location: qrCodeEquipment.location,
                  status: qrCodeEquipment.status,
                  quantity: qrCodeEquipment.quantity,
                  unit: qrCodeEquipment.unit,
                  id: qrCodeEquipment._id,
                  timestamp: new Date().toISOString()
                };
                navigator.clipboard.writeText(JSON.stringify(qrData, null, 2));
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

    {showRepairDocument && selectedEquipment && (
  <div className="modal-overlay">
    <div className="repair-card-modal">
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
              <td className="info-label-cell">PAR No.:</td>
              <td className="info-value-cell"></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="modal-table-container">
        <table className="modal-repair-table">
          <thead>
            <tr>
              <th className="quantity-header" colSpan="2">Quantity</th>
              <th className="repair-header" colSpan="3">Repair</th>
            </tr>
            <tr>
              <th className="receipt-col">Receipt</th>
              <th className="unit-col">Unit</th>
              <th className="date-repair-col">Date of Last Repair</th>
              <th className="details-col">Details</th>
              <th className="amount-col">Amount Used</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, index) => (
              <tr key={index}>
                <td className="receipt-cell"></td>
                <td className="unit-cell"></td>
                <td className="date-repair-cell"></td>
                <td className="details-cell"></td>
                <td className="amount-cell"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="modal-print-section">
        <button 
          className="modal-print-btn"
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
                      width: 40%;
                      text-align: left;
                    }
                    .print-table .date-col { width: 15%; }
                    .print-table .receipt-col { width: 15%; }
                    .print-table .unit-col { width: 15%; }
                    .print-table .amount-col { width: 15%; }
                    .quantity-header,
                    .repair-header {
                      font-weight: bold;
                      background: #e9ecef;
                    }
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
                        <td class="print-info-label">PAR No.:</td>
                        <td class="print-info-value"></td>
                      </tr>
                    </table>
                    
                    <table class="print-table">
                      <thead>
                        <tr>
                          <th colspan="2" class="quantity-header">Quantity</th>
                          <th colspan="3" class="repair-header">Repair</th>
                        </tr>
                        <tr>
                          <th class="receipt-col">Receipt</th>
                          <th class="unit-col">Unit</th>
                          <th class="date-col">Date of Last Repair</th>
                          <th class="details-col">Details</th>
                          <th class="amount-col">Amount Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${Array.from({ length: 20 }, () => `
                          <tr>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
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
            <path d="M6 18H4C3.46957 18 2.96086 17.7893 2.58579 17.4142C2.21071 17.0391 2 16.5304 2 16V11C2 10.4696 2.21071 9.21071 2.58579 9.58579C2.96086 9.21071 3.46957 9 4 9H20C20.5304 9 21.0391 9.21071 21.4142 9.58579C21.7893 9.96086 22 10.4696 22 11V16C22 16.5304 21.7893 17.0391 21.4142 17.4142C21.0391 17.7893 20.5304 18 20 18H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="6,14 18,14 18,22 6,22 6,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Print Stock Card
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default EquipmentPage;

