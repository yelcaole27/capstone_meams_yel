import React, { useState } from 'react';
import './SettingsPage.css';

function SettingsPage() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [exportOption, setExportOption] = useState('');
  const [bugReport, setBugReport] = useState('');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  const exportOptions = [
    'All Data',
    'Supply Inventory',
    'User Accounts',
    'System Logs',
    'Reports Only'
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

  const handleImportData = () => {
    if (selectedFile) {
      console.log('Importing file:', selectedFile.name);
      // Add import logic here
      alert(`Importing data from ${selectedFile.name}...`);
    } else {
      alert('Please select a file to import.');
    }
  };

  const handleExportData = () => {
    if (exportOption) {
      console.log('Exporting:', exportOption);
      // Add export logic here
      alert(`Exporting ${exportOption}...`);
    } else {
      alert('Please select data to export.');
    }
  };

  const handleSendReport = () => {
    if (bugReport.trim()) {
      console.log('Bug report:', bugReport);
      // Add bug report logic here
      alert('Bug report sent successfully!');
      setBugReport('');
    } else {
      alert('Please enter your question or bug report.');
    }
  };

  return (
    <div className="settings-page-container">
      <div className="settings-header">
        <h1 className="settings-title">SETTINGS</h1>
      </div>

      <div className="settings-content">
        {/* Import Data Section */}
        <div className="settings-section import-section">
          <h2 className="section-title">IMPORT DATA</h2>
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
              <small>Supported formats: CSV, XLS, XLSX</small>
              <small>Maximum size: 25MB</small>
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
              <span>Selected file: {selectedFile.name}</span>
            </div>
          )}
          
          <button className="import-btn" onClick={handleImportData}>
            IMPORT DATA
          </button>
        </div>

        {/* Export Data Section */}
        <div className="settings-section export-section">
          <h2 className="section-title">EXPORT DATA</h2>
          <p className="section-subtitle">SELECT DATA TO EXPORT:</p>
          
          <div className="export-dropdown-container">
            <button 
              className="export-dropdown-toggle"
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
            >
              {exportOption || 'Dropdown text'}
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
          
          <button className="export-btn" onClick={handleExportData}>
            EXPORT DATA
          </button>
        </div>

        {/* Questions/Report Bugs Section */}
        <div className="settings-section bugs-section">
          <h2 className="section-title">QUESTIONS / REPORT BUGS</h2>
          
          <textarea
            className="bug-report-textarea"
            placeholder="Type here..."
            value={bugReport}
            onChange={(e) => setBugReport(e.target.value)}
            rows={6}
          />
          
          <button className="send-btn" onClick={handleSendReport}>
            Send
            <svg className="send-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;