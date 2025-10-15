import React, { useState } from 'react';
import { useAuth } from './AuthContext'; // Import useAuth
import './SettingsPage.css';

function SettingsPage() {
  const { authToken, adminToken, isAdmin, getCurrentUser } = useAuth(); // Get auth info from context
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [exportOption, setExportOption] = useState('');
  const [bugReport, setBugReport] = useState('');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importType, setImportType] = useState('supplies');

  const exportOptions = [
    'All Data',
    'Supply Inventory',
    'Equipment Inventory',
    'User Accounts',
    'System Logs'
  ];

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
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Function to get auth token from AuthContext
  const getAuthToken = () => {
    return adminToken || authToken; // Use admin token first, then regular token
  };

  // Function to download file from blob
  const downloadFile = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Function to download file from base64 data (for ZIP files)
  const downloadBase64File = (base64Data, filename) => {
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/zip' });
      downloadFile(blob, filename);
    } catch (error) {
      console.error('Error downloading base64 file:', error);
      alert('Error downloading file. Please try again.');
    }
  };

  // Admin check function
  const checkAdminAccess = () => {
    if (!isAdmin) {
      alert('Access denied. This feature is only available to administrators.');
      return false;
    }
    return true;
  };

  // Main import function that calls FastAPI backend
  const handleImportData = async () => {
    // Check admin access first
    if (!checkAdminAccess()) return;

    if (!selectedFile) {
      alert('Please select a file to import.');
      return;
    }

    setIsImporting(true);

    try {
      const token = getAuthToken();
      if (!token) {
        alert('Authentication required. Please log in again.');
        setIsImporting(false);
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('import_type', importType);

      // Call the FastAPI bulk import endpoint
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required for data import.');
        }
        throw new Error(result.detail || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        // Show success message with details
        let message = `Successfully imported ${result.imported_count} ${importType}!`;
        
        if (result.error_count > 0) {
          message += `\n\n${result.error_count} items had errors and were skipped:`;
          const errorList = result.errors.slice(0, 5).map(error => {
            if (typeof error === 'string') {
              return `• ${error}`;
            } else {
              return `• ${error.item || 'Unknown item'}: ${error.error}`;
            }
          }).join('\n');
          
          message += `\n${errorList}`;
          
          if (result.errors.length > 5) {
            message += `\n• ... and ${result.errors.length - 5} more errors`;
          }
        }

        alert(message);

        // Update the display/state management system
        updateInventoryDisplay(result.imported_items, importType);

        // Reset form
        setSelectedFile(null);
        document.getElementById('importFileInput').value = '';

        // Trigger custom event to notify other components
        window.dispatchEvent(new CustomEvent('inventoryUpdated', { 
          detail: { 
            type: importType, 
            items: result.imported_items,
            action: 'bulk_import'
          } 
        }));

      } else {
        throw new Error(result.message || 'Import failed');
      }

    } catch (error) {
      console.error('Import error:', error);
      let errorMessage = 'Import failed: ' + error.message;
      
      // Handle specific error types
      if (error.message.includes('422')) {
        errorMessage = 'Invalid file format or data. Please check your file and try again.';
      } else if (error.message.includes('413')) {
        errorMessage = 'File too large. Maximum file size is 25MB.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication expired. Please log in again.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Admin privileges required for this operation.';
      } else if (error.message.includes('Unsupported file format')) {
        errorMessage = 'Unsupported file format. Please use CSV, XLS, or XLSX files.';
      }
      
      alert(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  // Function to update the UI/state management
  const updateInventoryDisplay = (importedItems, type) => {
    try {
      // Since we can't use localStorage in artifacts, we'll store in memory
      const storageKey = type === 'supplies' ? 'supplies' : 'equipment';
      
      // Try to get existing items from window object (memory storage)
      window.inventoryData = window.inventoryData || {};
      const existingItems = window.inventoryData[storageKey] || [];
      const updatedItems = [...existingItems, ...importedItems];
      window.inventoryData[storageKey] = updatedItems;
      
      console.log(`Successfully updated ${type} display with ${importedItems.length} items`);
    } catch (error) {
      console.error('Error updating inventory display:', error);
    }
  };

  const handleExportData = async () => {
    // Check admin access first
    if (!checkAdminAccess()) return;

    if (!exportOption) {
      alert('Please select data to export.');
      return;
    }

    setIsExporting(true);

    try {
      const token = getAuthToken();
      if (!token) {
        alert('Authentication required. Please log in again.');
        setIsExporting(false);
        return;
      }

      let exportUrl = '';
      
      switch (exportOption) {
        case 'Supply Inventory':
          exportUrl = '/api/export/supplies';
          break;
        case 'Equipment Inventory':
          exportUrl = '/api/export/equipment';
          break;
        case 'User Accounts':
          exportUrl = '/api/export/accounts';
          break;
        case 'System Logs':
          exportUrl = '/api/export/logs';
          break;
        case 'All Data':
          exportUrl = '/api/export/all';
          break;
        default:
          alert('Export functionality not implemented for this option yet.');
          setIsExporting(false);
          return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${exportUrl}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorResult = await response.json();
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required for data export.');
        }
        throw new Error(errorResult.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Handle different export types
        if (exportOption === 'All Data' && result.zip_data) {
          // Handle ZIP file download
          downloadBase64File(result.zip_data, result.filename);
          alert(`${exportOption} exported successfully!\n\nSummary:\n• Supplies: ${result.summary?.supplies_count || 0}\n• Equipment: ${result.summary?.equipment_count || 0}\n• Accounts: ${result.summary?.accounts_count || 0}`);
        } else if (result.csv_data) {
          // Handle CSV file download
          const blob = new Blob([result.csv_data], { type: 'text/csv;charset=utf-8;' });
          downloadFile(blob, result.filename);
          alert(`${exportOption} exported successfully!`);
        } else {
          throw new Error('No export data received from server');
        }
      } else {
        throw new Error(result.message || 'Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      let errorMessage = 'Export failed: ' + error.message;
      
      // Handle specific error types
      if (error.message.includes('403')) {
        errorMessage = 'Access denied. Admin privileges required for this export.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication expired. Please log in again.';
      }
      
      alert(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

const handleSendReport = async () => {
  if (!bugReport.trim()) {
    alert('Please enter your question or bug report.');
    return;
  }

  try {
    const token = getAuthToken();
    const currentUser = getCurrentUser();

    if (!token) {
      alert('Authentication required. Please log in again.');
      return;
    }

    const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/report-bug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: bugReport,
        username: currentUser?.username || 'unknown_user',
        role: currentUser?.role || 'unknown_role'
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('Bug report sent successfully to our team!');
      setBugReport('');
    } else {
      throw new Error(result.detail || 'Failed to send bug report');
    }
  } catch (error) {
    console.error('Bug report error:', error);
    alert('Failed to send bug report. Please try again later.');
  }
};

  // Get current user info for display
  const currentUser = getCurrentUser();

  return (
    <div className="settings-page-container">
      <div className="settings-header">
        <h1 className="settings-title">Data Transfer</h1>
        {currentUser && (
          <div className="user-info" style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            Logged in as: {currentUser.username} ({currentUser.role})
          </div>
        )}
      </div>

      <div className="settings-content">
        {/* Import Data Section - Admin Only */}
        <div className="settings-section import-section">
          <h2 className="section-title">
            IMPORT DATA
            {!isAdmin && <span style={{ color: '#e74c3c', fontSize: '14px', marginLeft: '10px' }}>(Admin Only)</span>}
          </h2>
          
          {isAdmin ? (
            <>
              {/* Import Type Selector */}
              <div className="import-type-selector" style={{ marginBottom: '15px' }}>
                <label style={{ marginRight: '20px', fontWeight: 'bold', color: '#333' }}>Import Type:</label>
                <label style={{ marginRight: '15px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="supplies"
                    checked={importType === 'supplies'}
                    onChange={(e) => setImportType(e.target.value)}
                    style={{ marginRight: '5px' }}
                  />
                  Supplies
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="equipment"
                    checked={importType === 'equipment'}
                    onChange={(e) => setImportType(e.target.value)}
                    style={{ marginRight: '5px' }}
                  />
                  Equipment
                </label>
              </div>
              
              <div 
                className={`import-drop-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('importFileInput').click()}
              >
                <div className="upload-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p>Drag and Drop files here or <span className="choose-file-link">Choose file</span></p>
                <div className="file-specs">
                  <large>Supported formats: CSV, XLS, XLSX</large>
                  <large>Maximum size: 25MB</large>
                  <large>
                    {importType === 'supplies' 
                      ? 'Expected columns: name/item_name, category, quantity, supplier, location, status' 
                      : 'Expected columns: name/item_name, description, category, quantity, unit, location, status, serialNo, unit_price'
                    }
                  </large>
                </div>
              </div>
              
              <input 
                type="file" 
                id="importFileInput"
                onChange={handleFileChange}
                accept=".csv,.xls,.xlsx"
                style={{ display: 'none' }}
              />
              
              {selectedFile && (
                <div className="selected-file">
                  <span>Selected file: {selectedFile.name} (Type: {importType})</span>
                </div>
              )}
              
              <button 
                className="import-btn" 
                onClick={handleImportData}
                disabled={isImporting || !selectedFile}
                style={{
                  opacity: (isImporting || !selectedFile) ? 0.6 : 1,
                  cursor: (isImporting || !selectedFile) ? 'not-allowed' : 'pointer'
                }}
              >
                {isImporting ? 'IMPORTING...' : 'IMPORT DATA'}
              </button>
            </>
          ) : (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              backgroundColor: '#f8f9fa', 
              border: '2px dashed #dee2e6', 
              borderRadius: '8px',
              color: '#6c757d'
            }}>
              <p style={{ fontSize: '16px', margin: '0' }}>
                🔒 This feature is restricted to administrators only.
              </p>
              <p style={{ fontSize: '14px', margin: '10px 0 0 0' }}>
                Please contact your system administrator if you need to import data.
              </p>
            </div>
          )}
        </div>

        {/* Export Data Section - Admin Only */}
        <div className="settings-section export-section">
          <h2 className="section-title">
            EXPORT DATA
            {!isAdmin && <span style={{ color: '#e74c3c', fontSize: '14px', marginLeft: '10px' }}>(Admin Only)</span>}
          </h2>
          
          {isAdmin ? (
            <>
              <p className="section-subtitle">SELECT DATA TO EXPORT:</p>
              
              <div className="export-dropdown-container">
                <button 
                  className="export-dropdown-toggle"
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  disabled={isExporting}
                >
                  {exportOption || 'Select Export Option'}
                  <svg className="dropdown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {isExportDropdownOpen && (
                  <div className="export-dropdown-menu">
                    {exportOptions.map(option => (
                      <div 
                        key={option}
                        className="export-dropdown-item"
                        onClick={() => {
                          setExportOption(option);
                          setIsExportDropdownOpen(false);
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <button 
                className="export-btn" 
                onClick={handleExportData}
                disabled={isExporting || !exportOption}
                style={{
                  opacity: (isExporting || !exportOption) ? 0.6 : 1,
                  cursor: (isExporting || !exportOption) ? 'not-allowed' : 'pointer'
                }}
              >
                {isExporting ? 'EXPORTING...' : 'EXPORT DATA'}
              </button>

              {/* Export Info */}
              {exportOption && (
                <div className="export-info" style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
                  {exportOption === 'All Data' && (
                    <p>📁 Will export all system data as a ZIP file containing multiple CSV files.</p>
                  )}
                  {exportOption === 'Supply Inventory' && (
                    <p>📊 Will export all supply inventory data as a CSV file.</p>
                  )}
                  {exportOption === 'Equipment Inventory' && (
                    <p>🔧 Will export all equipment inventory data as a CSV file.</p>
                  )}
                  {exportOption === 'User Accounts' && (
                    <p>👥 Will export user account data as a CSV file (Admin only).</p>
                  )}
                  {exportOption === 'System Logs' && (
                    <p>📋 Will export system activity logs as a CSV file (Admin only).</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              backgroundColor: '#f8f9fa', 
              border: '2px dashed #dee2e6', 
              borderRadius: '8px',
              color: '#6c757d'
            }}>
              <p style={{ fontSize: '16px', margin: '0' }}>
                🔒 This feature is restricted to administrators only.
              </p>
              <p style={{ fontSize: '14px', margin: '10px 0 0 0' }}>
                Please contact your system administrator if you need to export data.
              </p>
            </div>
          )}
        </div>

        </div>
      </div>
  );
}

export default SettingsPage;

