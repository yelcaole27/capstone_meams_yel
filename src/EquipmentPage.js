import React, { useState } from 'react';
import QRCode from 'qrcode';
import './EquipmentPage.css';

function EquipmentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isEquipmentOverviewOpen, setIsEquipmentOverviewOpen] = useState(false);
  
  // Add Equipment Overlay states
  const [isAddEquipmentOverlayOpen, setIsAddEquipmentOverlayOpen] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    itemCode: '',
    quantity: '',
    unit: '',
    description: '',
    category: '',
    location: '',
    status: 'Operational',
    serialNo: '',
    itemPicture: null
  });
  const [dragActive, setDragActive] = useState(false);
  
  // QR Code states
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [qrCodeEquipment, setQrCodeEquipment] = useState(null);

  const [equipmentData, setEquipmentData] = useState([
    { itemCode: 'MED-E-34561', quantity: 1, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room A', status: 'Operational', serialNo: 'GP001' },
    { itemCode: 'MED-E-34562', quantity: 11, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room B', status: 'Operational', serialNo: 'GP002' },
    { itemCode: 'MED-E-34563', quantity: 12, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room C', status: 'Maintenance', serialNo: 'GP003' },
    { itemCode: 'MED-E-34564', quantity: 13, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room D', status: 'Operational', serialNo: 'GP004' },
    { itemCode: 'MED-E-34565', quantity: 2, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room E', status: 'Operational', serialNo: 'GP005' },
    { itemCode: 'MED-E-34566', quantity: 14, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room F', status: 'Out of Service', serialNo: 'GP006' },
    { itemCode: 'MED-E-34567', quantity: 15, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room G', status: 'Operational', serialNo: 'GP007' },
    { itemCode: 'MED-E-34568', quantity: 16, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room H', status: 'Operational', serialNo: 'GP008' },
    { itemCode: 'MED-E-34569', quantity: 17, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room I', status: 'Operational', serialNo: 'GP009' },
    { itemCode: 'MED-E-34560', quantity: 18, unit: 'UNIT', description: '3HP GOULD PUMP', category: 'Mechanical', location: 'Pump Room J', status: 'Operational', serialNo: 'GP010' }
  ]);

  // Equipment categories and statuses
  const equipmentCategories = ['Mechanical', 'Electrical', 'Medical', 'IT Equipment', 'Laboratory', 'HVAC', 'Safety'];
  const equipmentStatuses = ['Operational', 'Maintenance', 'Out of Service', 'Under Repair'];
  const equipmentUnits = ['UNIT', 'SET', 'PIECE', 'LOT'];

  const filteredEquipment = equipmentData.filter(item =>
    item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add Equipment Overlay handlers
  const handleAddEquipmentToggle = () => {
    setIsAddEquipmentOverlayOpen(!isAddEquipmentOverlayOpen);
    if (isAddEquipmentOverlayOpen) {
      setNewEquipment({
        itemCode: '',
        quantity: '',
        unit: '',
        description: '',
        category: '',
        location: '',
        status: 'Operational',
        serialNo: '',
        itemPicture: null
      });
    }
  };

  const handleEquipmentInputChange = (e) => {
    const { name, value } = e.target;
    setNewEquipment({ ...newEquipment, [name]: value });
  };

  const handleEquipmentFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
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
      setNewEquipment({ ...newEquipment, itemPicture: file });
    }
  };

  const generateEquipmentCode = () => {
    const categoryPrefix = newEquipment.category ? newEquipment.category.substring(0, 3).toUpperCase() : 'EQP';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const generatedCode = `MED-E-${randomNum}`;
    setNewEquipment({ ...newEquipment, itemCode: generatedCode });
  };

  const handleAddEquipment = () => {
    if (!newEquipment.description || !newEquipment.quantity || !newEquipment.category || !newEquipment.serialNo) {
      alert('Please fill in all required fields');
      return;
    }

    const newEquipmentItem = {
      itemCode: newEquipment.itemCode || `MED-E-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      quantity: parseInt(newEquipment.quantity),
      unit: newEquipment.unit || 'UNIT',
      description: newEquipment.description,
      category: newEquipment.category,
      location: newEquipment.location,
      status: newEquipment.status,
      serialNo: newEquipment.serialNo,
      itemPicture: newEquipment.itemPicture
    };

    setEquipmentData([...equipmentData, newEquipmentItem]);
    console.log('New equipment added:', newEquipmentItem);
    handleAddEquipmentToggle();
  };

  // QR Code generation function
  const generateQRCode = async (equipment) => {
    try {
      // Create QR code data for equipment
      const qrData = JSON.stringify({
        itemCode: equipment.itemCode,
        description: equipment.description,
        quantity: equipment.quantity,
        unit: equipment.unit,
        category: equipment.category,
        location: equipment.location,
        status: equipment.status,
        serialNo: equipment.serialNo,
        timestamp: new Date().toISOString()
      });

      // Generate QR code as data URL
      const dataURL = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeDataURL(dataURL);
      setQrCodeEquipment(equipment);
      setIsQRModalOpen(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    }
  };

  // Download QR code as image
  const downloadQRCode = () => {
    if (!qrCodeDataURL || !qrCodeEquipment) return;

    const link = document.createElement('a');
    link.download = `QR_${qrCodeEquipment.itemCode}_${qrCodeEquipment.description.replace(/\s+/g, '_')}.png`;
    link.href = qrCodeDataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print QR code
  const printQRCode = () => {
    if (!qrCodeDataURL || !qrCodeEquipment) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${qrCodeEquipment.description}</title>
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
              <h2>${qrCodeEquipment.description}</h2>
              <div class="item-details">
                <p><strong>Item Code:</strong> ${qrCodeEquipment.itemCode}</p>
                <p><strong>Serial No:</strong> ${qrCodeEquipment.serialNo}</p>
                <p><strong>Category:</strong> ${qrCodeEquipment.category}</p>
                <p><strong>Location:</strong> ${qrCodeEquipment.location}</p>
                <p><strong>Status:</strong> ${qrCodeEquipment.status}</p>
              </div>
            </div>
            <img src="${qrCodeDataURL}" alt="QR Code for ${qrCodeEquipment.description}" />
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

  return (
    <div className="equipment-page-container">
      <div className="equipment-header">
        <h2 className="page-title">Equipment Inventory</h2>
        <div className="table-controls">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search equipment..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 15L21 21M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <table className="equipment-table">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Description</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredEquipment.map((equipment, index) => (
            <tr key={index}>
              <td>{equipment.itemCode}</td>
              <td>{equipment.quantity}</td>
              <td>{equipment.unit}</td>
              <td>
                <span 
                  className="description-clickable"
                  onClick={() => handleEquipmentClick(equipment)}
                >
                  {equipment.description}
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

      <button className="add-equipment-button" onClick={handleAddEquipmentToggle}>Add New Equipment</button>

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
                <label>QUANTITY:</label>
                <input 
                  type="number" 
                  name="quantity" 
                  value={newEquipment.quantity} 
                  onChange={handleEquipmentInputChange}
                  placeholder="Input text"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>UNIT:</label>
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
                <label>DESCRIPTION:</label>
                <input 
                  type="text" 
                  name="description" 
                  value={newEquipment.description} 
                  onChange={handleEquipmentInputChange}
                  placeholder="Input text"
                  required
                />
              </div>

              <div className="form-group">
                <label>CATEGORY:</label>
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
                  placeholder="Input text"
                />
              </div>

              <div className="form-group">
                <label>STATUS:</label>
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
                <label>SERIAL NO.:</label>
                <input 
                  type="text" 
                  name="serialNo" 
                  value={newEquipment.serialNo} 
                  onChange={handleEquipmentInputChange}
                  placeholder="Input text"
                  required
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
              <button className="add-btn" onClick={handleAddEquipment}>ADD EQUIPMENT</button>
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
                  <span className="detail-label">Equipment:</span>
                  <span className="detail-value">{selectedEquipment.description}</span>
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
                  <span className="detail-value">{selectedEquipment.location}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value">{selectedEquipment.status}</span>
                </div>
              </div>
            </div>
            
            <div className="item-overview-actions">
              <button className="action-btn view-stock-btn">
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
            <h3>QR Code - {qrCodeEquipment.description}</h3>
            
            <div className="qr-display-section">
              {/* Compact QR Code Display */}
              <div className="qr-code-container">
                <div className="qr-code-wrapper">
                  <div className="qr-code-display">
                    <img src={qrCodeDataURL} alt={`QR Code for ${qrCodeEquipment.description}`} />
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
                  <span className="qr-detail-value">{qrCodeEquipment.location}</span>
                </div>
                
                <div className="qr-detail-row">
                  <span className="qr-detail-label">Status:</span>
                  <span className="qr-detail-value">{qrCodeEquipment.status}</span>
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
                // Copy QR data to clipboard
                const qrData = JSON.stringify({
                  itemCode: qrCodeEquipment.itemCode,
                  description: qrCodeEquipment.description,
                  serialNo: qrCodeEquipment.serialNo,
                  category: qrCodeEquipment.category,
                  location: qrCodeEquipment.location,
                  status: qrCodeEquipment.status
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
    </div>
  );
}

export default EquipmentPage;