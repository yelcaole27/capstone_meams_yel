import React, { useState } from 'react';
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
    itemPicture: null
  });
  const [suppliesData, setSuppliesData] = useState([
    { itemCode: 'MED-2-12345', stockNo: '59', quantity: 10, itemName: 'Ethyl Alcohol', category: 'Sanitary' },
    { itemCode: 'MED-1-00001', stockNo: '11', quantity: 14, itemName: 'Ink', category: 'Office Supply' },
    { itemCode: 'MED-1-00002', stockNo: '12', quantity: 15, itemName: 'Bondpaper', category: 'Office Supply' },
    { itemCode: 'MED-1-00003', stockNo: '13', quantity: 16, itemName: 'Tarpaulin', category: 'Office Supply' },
    { itemCode: 'MED-2-23456', stockNo: '2', quantity: 17, itemName: 'Hand Soap', category: 'Sanitary' },
    { itemCode: 'MED-1-00004', stockNo: '14', quantity: 2, itemName: 'Copy Paper Short', category: 'Office Supply' },
    { itemCode: 'MED-1-00005', stockNo: '15', quantity: 14, itemName: 'Copy Paper Long', category: 'Office Supply' },
    { itemCode: 'MED-1-00006', stockNo: '16', quantity: 15, itemName: 'Scotch Tape 2"', category: 'Office Supply' },
    { itemCode: 'MED-1-00007', stockNo: '17', quantity: 16, itemName: 'Ballpen (black)', category: 'Office Supply' },
    { itemCode: 'MED-1-00008', stockNo: '18', quantity: 17, itemName: 'Expanding Envelope (long)', category: 'Office Supply' },
  ]);
  const [dragActive, setDragActive] = useState(false);

  const categories = ['Sanitary', 'Office Supply', 'Medical', 'Equipment', 'Maintenance'];
  const uniqueCategories = ['All Categories', ...new Set(suppliesData.map(item => item.category))];

  const filteredSupplies = suppliesData.filter(item => {
    const matchesSearch = item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOverlayToggle = () => {
    setIsOverlayOpen(!isOverlayOpen);
    // Reset form when closing
    if (isOverlayOpen) {
      setNewItem({ 
        itemCode: '', 
        stockNo: '',
        itemName: '', 
        quantity: '', 
        category: '',
        itemPicture: null
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: value });
  };

  const handleCategorySelect = (category) => {
    setNewItem({ ...newItem, category: category });
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

  const handleAddItem = () => {
    // Validate required fields
    if (!newItem.itemName || !newItem.quantity || !newItem.category) {
      alert('Please fill in all required fields');
      return;
    }

    const newSupplyItem = {
      itemCode: newItem.itemCode || `GEN-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      stockNo: newItem.stockNo || Math.floor(Math.random() * 100).toString(),
      quantity: parseInt(newItem.quantity),
      itemName: newItem.itemName,
      category: newItem.category,
      itemPicture: newItem.itemPicture
    };

    setSuppliesData([...suppliesData, newSupplyItem]);
    console.log('New item added:', newSupplyItem);
    handleOverlayToggle();
  };

  return (
    <div className="supplies-page-container">
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
          </tr>
        </thead>
        <tbody>
          {filteredSupplies.map((supply, index) => (
            <tr key={index}>
              <td>{supply.itemCode}</td>
              <td>{supply.stockNo}</td>
              <td>{supply.quantity}</td>
              <td>{supply.itemName}</td>
              <td>{supply.category}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="add-item-button" onClick={handleOverlayToggle}>Add Item Supply</button>

      {/* Enhanced Overlay Form */}
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
              <button className="add-btn" onClick={handleAddItem}>ADD ITEM/SUPPLY</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuppliesPage;