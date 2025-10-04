import React, { useState, useEffect } from 'react';
import SuppliesAPI from './suppliesApi';
import './DocumentViewer.css';

function DocumentViewer({ item, isOpen, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
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
    } finally {
      setLoading(false);
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
    if (!window.confirm(`Delete "${doc.filename}"?`)) return;

    try {
      setLoading(true);
      await SuppliesAPI.deleteSupplyDocument(item._id, doc.index);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (doc) => setPreviewDoc(doc);
  const closePreview = () => setPreviewDoc(null);

  const getFileIcon = (contentType) => {
    if (contentType.includes('pdf')) {
      return <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#dc2626" strokeWidth="2"/><polyline points="14,2 14,8 20,8" stroke="#dc2626" strokeWidth="2"/><text x="7" y="16" fontSize="6" fill="#dc2626" fontWeight="bold">PDF</text></svg>;
    } else if (contentType.includes('word') || contentType.includes('document')) {
      return <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#2563eb" strokeWidth="2"/><polyline points="14,2 14,8 20,8" stroke="#2563eb" strokeWidth="2"/><text x="7" y="16" fontSize="5" fill="#2563eb" fontWeight="bold">DOC</text></svg>;
    } else if (contentType.includes('image')) {
      return <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#059669" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="#059669"/><polyline points="21,15 16,10 5,21" stroke="#059669" strokeWidth="2"/></svg>;
    }
    return <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#6b7280" strokeWidth="2"/><polyline points="14,2 14,8 20,8" stroke="#6b7280" strokeWidth="2"/></svg>;
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

        <div className="doc-list-section">
          <h4>Uploaded Documents ({documents.length})</h4>
          
          {loading ? (
            <div className="doc-loading">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="doc-empty">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 15px', opacity: 0.3 }}>
                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <p>No documents uploaded yet</p>
              <small>Documents are uploaded when adding new items</small>
            </div>
          ) : (
            <div className="doc-grid">
              {documents.map((doc) => (
                <div key={doc.index} className="doc-card">
                  <div className="doc-icon">{getFileIcon(doc.content_type)}</div>
                  
                  <div className="doc-info">
                    <p className="doc-filename" title={doc.filename}>{doc.filename}</p>
                    <p className="doc-size">{formatFileSize(doc.file_size)}</p>
                    <p className="doc-date">{formatDate(doc.uploaded_at)}</p>
                  </div>
                  
                  <div className="doc-actions">
                    {doc.content_type.includes('image') && (
                      <button className="doc-action-btn preview-btn" onClick={() => handlePreview(doc)} title="Preview">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </button>
                    )}
                    
                    <button className="doc-action-btn download-btn" onClick={() => handleDownload(doc)} title="Download">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2"/>
                        <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </button>
                    
                    <button className="doc-action-btn delete-btn" onClick={() => handleDelete(doc)} title="Delete">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
