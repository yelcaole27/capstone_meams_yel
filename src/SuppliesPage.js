import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import SuppliesAPI from './suppliesApi'; // Import the API service
import './SuppliesPage.css';

function SuppliesPage() {
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
    unit: '', // NEW FIELD
    location: '', // NEW FIELD
    status: 'Normal', // NEW FIELD with default value
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

  const categories = ['Sanitary Supply', 'Office Supply', 'Construction Supply', 'Electrical Supply'];
  
  // NEW: Define unit options
  const unitOptions = ['piece', 'pack', 'box', 'bottle', 'gallon', 'set', 'roll', 'bag', 'meter', 'ream'];
  
  // NEW: Define status options
  const statusOptions = ['Understock', 'Normal', 'Overstock'];

  // Load supplies from database when component mounts
  useEffect(() => {
    loadSupplies();
  }, []);

  // Load supplies from database
  const loadSupplies = async () => {
  try {
    setLoading(true);
    const supplies = await SuppliesAPI.getAllSupplies();
    // Transform database data to match your current structure
    const transformedSupplies = supplies.map(supply => {
  // Generate a proper item code if one doesn't exist
  let itemCode = supply.itemCode;
  if (!itemCode) {
    // Generate item code based on category and random number
    const categoryPrefix = supply.category ? supply.category.substring(0, 3).toUpperCase() : 'SUP';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    itemCode = `${categoryPrefix}-${randomNum}`;
  }
  
  return {
    _id: supply._id,
    itemCode: itemCode, // Use generated or existing itemCode
    stockNo: supply.supplier || Math.floor(Math.random() * 100).toString(),
    quantity: supply.quantity,
    itemName: supply.name, // Keep the actual name here
    category: supply.category,
    description: supply.description || '',
    unit: supply.unit || 'piece',
    location: supply.location || '',
    status: supply.status || 'Normal',
    date: supply.date || ''  // NEW FIELD: Date field
  };
});
    setSuppliesData(transformedSupplies);
    setError(null);
  } catch (err) {
    console.error('Failed to load supplies:', err);
    setError('Failed to load supplies. Please try again.');
    // Keep existing sample data as fallback
    setSuppliesData([
      { itemCode: 'MED-2-12345', stockNo: '59', quantity: 10, itemName: 'Ethyl Alcohol', category: 'Sanitary', description: '500ml', unit: 'bottle', location: 'Storage Room A', status: 'Normal' },
      { itemCode: 'MED-1-00001', stockNo: '11', quantity: 14, itemName: 'Ink', category: 'Office Supply', description: 'Black ink cartridge', unit: 'piece', location: 'Office Supply Cabinet', status: 'Normal' }
    ]);
  } finally {
    setLoading(false);
  }
};

  // NEW: Delete supply function
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

  // Filter supplies (now works with database data)
  const filteredSupplies = suppliesData.filter(item => {
    const matchesSearch = item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // QR Code generation function - UPDATED to include new fields
  const generateQRCode = async (item) => {
    try {
      const qrData = JSON.stringify({
        itemCode: item.itemCode,
        itemName: item.itemName,
        stockNo: item.stockNo,
        category: item.category,
        quantity: item.quantity,
        description: item.description,
        unit: item.unit, // NEW FIELD
        location: item.location, // NEW FIELD
        status: item.status, // NEW FIELD
        timestamp: new Date().toISOString()
      });

      const dataURL = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeDataURL(dataURL);
      setQrCodeItem(item);
      setIsQRModalOpen(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    }
  };

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
        unit: '', // NEW FIELD
        location: '', // NEW FIELD
        status: 'Normal', // NEW FIELD with default
        date: '',
        itemPicture: null
      });
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

  const generateItemCode = () => {
    const categoryPrefix = newItem.category ? newItem.category.substring(0, 3).toUpperCase() : 'GEN';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const generatedCode = `${categoryPrefix}-${randomNum}`;
    setNewItem({ ...newItem, itemCode: generatedCode });
  };

  // Updated handleAddItem to save to database - UPDATED with new fields
  const handleAddItem = async () => {
    // UPDATED validation to include new required fields
    if (!newItem.itemName || !newItem.quantity || !newItem.category || !newItem.unit) {
      alert('Please fill in all required fields (Item Name, Quantity, Category, Unit)');
      return;
    }

    try {
      // Prepare data for API (matching your backend structure) - UPDATED with new fields
      const supplyData = {
  name: newItem.itemName,
  category: newItem.category,
  description: newItem.description,
  quantity: parseInt(newItem.quantity),
  unit_price: 0, 
  supplier: newItem.stockNo || '', 
  location: newItem.location,
  status: newItem.status,
  unit: newItem.unit,
  date: newItem.date  // NEW FIELD: Date field
};

      // Show loading state
      setLoading(true);
      
      // Add to database
      const savedSupply = await SuppliesAPI.addSupply(supplyData);
      
      // Transform the response to match your current data structure - UPDATED with new fields
      const newSupplyItem = {
        _id: savedSupply._id,
        itemCode: newItem.itemCode || `GEN-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
        stockNo: newItem.stockNo || Math.floor(Math.random() * 100).toString(),
        quantity: parseInt(newItem.quantity),
        itemName: newItem.itemName,
        category: newItem.category,
        description: newItem.description,
        unit: newItem.unit, // NEW FIELD
        location: newItem.location, // NEW FIELD
        status: newItem.status, // NEW FIELD
        date: newItem.date,
        itemPicture: newItem.itemPicture
      };

      // Update local state
      setSuppliesData([...suppliesData, newSupplyItem]);
      
      // Show success message
      alert('Supply added successfully!');
      
      // Close overlay and reset form
      handleOverlayToggle();
      
    } catch (error) {
      console.error('Error adding supply:', error);
      alert(`Failed to add supply: ${error.message}`);
    } finally {
      setLoading(false);
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
        </div>
      </div>

      <table className="supplies-table">
        <thead>
          <tr>
            <th>ITEM CODE</th>
            <th>STOCK NO.</th>
            <th>QUANTITY</th>
            <th>ITEM NAME</th>
            <th>CATEGORY</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {filteredSupplies.map((supply, index) => (
            <tr key={supply._id || index}>
              <td>{supply.itemCode}</td>
              <td>{supply.stockNo}</td>
              <td>{supply.quantity}</td>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="add-item-button" onClick={handleOverlayToggle}>
        {loading ? 'Loading...' : 'Add Item Supply'}
      </button>

      {/* Enhanced Overlay Form - UPDATED WITH NEW FIELDS */}
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
                className={`file-drop-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput').click()}
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
                onClick={handleAddItem}
                disabled={loading}
              >
                {loading ? 'ADDING...' : 'ADD ITEM/SUPPLY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Overview Overlay - UPDATED TO SHOW NEW FIELDS */}
      {isItemOverviewOpen && selectedItem && (
        <div className="overlay" onClick={handleCloseItemOverview}>
          <div className="item-overview-content" onClick={(e) => e.stopPropagation()}>
            <h3>Item Overview</h3>
            
            <div className="item-overview-layout">
              <div className="item-image-placeholder">
                <div className="placeholder-box">No Image</div>
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
                {/* NEW FIELD DISPLAY: STATUS */}
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value">{selectedItem.status || 'N/A'}</span>
                </div>
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
              
              <button className="action-btn view-docs-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                View Documents ⌕
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
              
              {/* NEW: Delete Supply Button */}
              <button 
                className="action-btn delete-btn"
                onClick={() => handleDeleteSupply(selectedItem._id, selectedItem.itemName)}
                style={{ 
                  background: '#dc3545',
                  marginLeft: 'auto'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Delete Supply
              </button>
            </div>
            
            <button className="close-overview-btn" onClick={handleCloseItemOverview}>
              ×
            </button>
          </div>
        </div>
      )}

{/* Compact QR Code Modal - UPDATED TO SHOW NEW FIELDS */}
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
        
        {/* Item Information - UPDATED WITH NEW FIELDS */}
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
      
      {/* Actions - Matching item overview actions style */}
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

{isStockCardOpen && selectedItem && (
  <div className="modal-overlay">
    <div className="repair-card-modal">
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
          </tbody>
        </table>
      </div>

      <div className="modal-print-section">
        <button
          className="modal-print-btn"
          onClick={() => {
            const printWindow = window.open('', '_blank');
            handleCloseStockCard();
            printWindow.document.write(`
              <html>
                <head>
                  <title>Stock Card - ${selectedItem.itemName || 'Item'}</title>
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
                      font-weight: bold;
                      background: #e9ecef;
                    }
                    .print-table .date-column, .print-table .receipt-column, .print-table .quantity-issue-column, .print-table .balance-column {
                      width: 25%;
                    }
                    .quantity-header {
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
                        <p class="print-document-type">Stock Card</p>
                      </div>
                    </div>

                    <div class="print-divider"></div>

                    <table class="print-info-table">
                      <tr>
                        <td class="print-info-label">Item:</td>
                        <td class="print-info-value">${selectedItem.itemName || 'N/A'}</td>
                        <td class="print-info-label">Stock No.:</td>
                        <td class="print-info-value">${selectedItem.stockNo || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td class="print-info-label">Category:</td>
                        <td class="print-info-value">${selectedItem.category || 'N/A'}</td>
                        <td class="print-info-label">Description:</td>
                        <td class="print-info-value">${selectedItem.description || 'N/A'}</td>
                      </tr>
                    </table>

                    <table class="print-table">
                      <thead>
                        <tr>
                          <th rowSpan="2" class="date-column">Date</th>
                          <th colSpan="3" class="quantity-header">Quantity</th>
                        </tr>
                        <tr>
                          <th class="receipt-column">Receipt</th>
                          <th class="quantity-issue-column">Issue</th>
                          <th class="balance-column">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td class="date-cell" style="color: black;">${selectedItem.date}</td>
                          <td>${selectedItem.quantity}</td>
                          <td>&nbsp;</td>
                          <td>${selectedItem.quantity}</td>
                        </tr>
                        ${Array.from({ length: 20 }, () => `
                          <tr>
                            <td class="date-cell">&nbsp;</td>
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

export default SuppliesPage;

