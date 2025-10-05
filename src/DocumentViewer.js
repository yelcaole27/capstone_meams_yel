import React, { useState, useEffect } from 'react';
import SuppliesAPI from './suppliesApi';
import './DocumentViewer.css';

function DocumentViewer({ item, isOpen, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    if (isOpen && item) {
      loadDocuments();
    }
  }, [isOpen, item]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await SuppliesAPI.getSupplyDocuments(item._id);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
      alert('Failed to load documents');
    } finally {
      setLoading(false);
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
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file) => {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Allowed: PDF, DOCX, DOC, JPEG, PNG, GIF');
      return;
    }

    // Validate file size (25MB)
    if (file.size > 25 * 1024 * 1024) {
      alert('File too large. Maximum size is 25MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      await SuppliesAPI.uploadSupplyDocument(item._id, selectedFile);
      alert(`Document "${selectedFile.name}" uploaded successfully!`);
      setSelectedFile(null);
      await loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert(`Failed to upload document: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      await SuppliesAPI.downloadSupplyDocument(item._id, doc.index, doc.filename);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await SuppliesAPI.deleteSupplyDocument(item._id, doc.index);
      alert('Document deleted successfully!');
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (doc) => {
    setPreviewDoc(doc);
  };

  const closePreview = () => {
    setPreviewDoc(null);
  };

  const getFileIcon = (contentType) => {
    if (contentType.includes('pdf')) {
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14,2 14,8 20,8" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <text x="7" y="16" fontSize="6" fill="#dc2626" fontWeight="bold">PDF</text>
        </svg>
      );
    } else if (contentType.includes('word') || contentType.includes('document')) {
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14,2 14,8 20,8" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <text x="7" y="16" fontSize="5" fill="#2563eb" fontWeight="bold">DOC</text>
        </svg>
      );
    } else if (contentType.includes('image')) {
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="#059669" strokeWidth="2"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="#059669"/>
          <polyline points="21,15 16,10 5,21" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    return (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="14,2 14,8 20,8" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (!isOpen) return null;

  return (
    <div className="document-viewer-overlay" onClick={onClose}>
      <div className="document-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <button className="doc-modal-close-btn" onClick={onClose}>×</button>
        
        <h3>Documents - {item.itemName}</h3>
        <p className="doc-item-code">Item Code: {item.itemCode}</p>

        {/* Upload Section */}
        <div className="doc-upload-section">
          <h4>Upload New Document</h4>
          <div 
            className={`doc-drop-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('docFileInput').click()}
          >
            <input 
              type="file" 
              id="docFileInput"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
              style={{ display: 'none' }}
            />
            
            <div className="upload-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            {selectedFile ? (
              <div className="selected-file-info">
                <p><strong>Selected:</strong> {selectedFile.name}</p>
                <p><small>{formatFileSize(selectedFile.size)}</small></p>
              </div>
            ) : (
              <>
                <p>Drag and Drop files here or <span className="choose-file-link">Choose file</span></p>
                <small>Supported formats: PDF, DOCX, JPEG, PNG, GIF</small>
                <small>Maximum size: 25MB</small>
              </>
            )}
          </div>
          
          {selectedFile && (
            <div className="upload-actions">
              <button 
                className="upload-btn" 
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
              <button 
                className="cancel-upload-btn" 
                onClick={() => setSelectedFile(null)}
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Documents List */}
        <div className="doc-list-section">
          <h4>Uploaded Documents ({documents.length})</h4>
          
          {loading ? (
            <div className="doc-loading">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="doc-empty">
              <p>No documents uploaded yet</p>
              <small>Upload documents using the form above</small>
            </div>
          ) : (
            <div className="doc-grid">
              {documents.map((doc) => (
                <div key={doc.index} className="doc-card">
                  <div className="doc-icon">
                    {getFileIcon(doc.content_type)}
                  </div>
                  
                  <div className="doc-info">
                    <p className="doc-filename" title={doc.filename}>{doc.filename}</p>
                    <p className="doc-size">{formatFileSize(doc.file_size)}</p>
                    <p className="doc-date">{formatDate(doc.uploaded_at)}</p>
                  </div>
                  
                  <div className="doc-actions">
                    {doc.content_type.includes('image') && (
                      <button 
                        className="doc-action-btn preview-btn"
                        onClick={() => handlePreview(doc)}
                        title="Preview"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </button>
                    )}
                    
                    <button 
                      className="doc-action-btn download-btn"
                      onClick={() => handleDownload(doc)}
                      title="Download"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2"/>
                        <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </button>
                    
                    <button 
                      className="doc-action-btn delete-btn"
                      onClick={() => handleDelete(doc)}
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2"/>
                        <path d="M19 6V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V6M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {previewDoc && (
          <div className="doc-preview-overlay" onClick={closePreview}>
            <div className="doc-preview-modal" onClick={(e) => e.stopPropagation()}>
              <button className="preview-close-btn" onClick={closePreview}>×</button>
              <h4>Preview: {previewDoc.filename}</h4>
              <div className="preview-content">
                <img 
                  src={SuppliesAPI.getDocumentUrl(item._id, previewDoc.index)}
                  alt={previewDoc.filename}
                  style={{ maxWidth: '100%', maxHeight: '70vh' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default DocumentViewer;