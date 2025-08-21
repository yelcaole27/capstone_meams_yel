import React, { useState } from 'react';
import './ManageAccountsPage.css';

function ManageAccountsPage() {
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    profilePicture: null
  });

  const accountsData = [
    { 
      id: 1, 
      name: 'Engr. Jayson Valeroso', 
      username: 'admin', 
      email: 'sample@email.com', 
      status: true, 
      accountCreation: '05/10/2025',
      role: 'admin'
    },
    { 
      id: 2, 
      name: 'Admin Name', 
      username: 'staff1', 
      email: 'sample@email.com', 
      status: true, 
      accountCreation: '05/10/2025',
      role: 'staff1'
    },
    { 
      id: 3, 
      name: 'Admin Name', 
      username: 'staff2', 
      email: 'sample@email.com', 
      status: true, 
      accountCreation: '05/10/2025',
      role: 'staff2'
    },
    { 
      id: 4, 
      name: 'Admin Name', 
      username: 'staff3', 
      email: 'sample@email.com', 
      status: true, 
      accountCreation: '05/10/2025',
      role: 'staff3'
    }
  ];

  const [accounts, setAccounts] = useState(accountsData);

  const handleStatusToggle = (id) => {
    setAccounts(accounts.map(account => 
      account.id === id ? { ...account, status: !account.status } : account
    ));
  };

  const toggleDropdown = (id) => {
    setOpenDropdown(openDropdown === id ? null : id);
  };

  const handleEdit = (id) => {
    console.log('Edit account:', id);
    setOpenDropdown(null);
    // Add edit functionality here
  };

  const handleDelete = (id) => {
    console.log('Delete account:', id);
    setOpenDropdown(null);
    // Add delete functionality here
  };

  const handleAddAccount = () => {
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setFormData({
      name: '',
      username: '',
      email: '',
      profilePicture: null
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      setFormData(prev => ({
        ...prev,
        profilePicture: file
      }));
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      setFormData(prev => ({
        ...prev,
        profilePicture: file
      }));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmitAccount = () => {
    // Here you would typically send the data to your backend
    console.log('Adding account:', formData);
    
    // For demo purposes, add to local state
    const newAccount = {
      id: accounts.length + 1,
      name: formData.name,
      username: formData.username,
      email: formData.email,
      status: true,
      accountCreation: new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      }),
      role: formData.username
    };

    setAccounts([...accounts, newAccount]);
    handleCloseModal();
  };

  return (
    <div className="manage-accounts-page-container">
      <div className="accounts-header">
        <h2 className="page-title">Manage Accounts</h2>
        <button className="add-account-button" onClick={handleAddAccount}>
          ADD ACCOUNT
        </button>
      </div>

      <div className="account-cards-grid">
        {accounts.map((account) => (
          <div 
            key={account.id} 
            className={`account-card ${!account.status ? 'inactive' : ''}`}
          >
            <div className="account-avatar">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="account-name">{account.role}</div>
          </div>
        ))}
      </div>

      <div className="accounts-table-section">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>NAME</th>
              <th>USERNAME</th>
              <th>EMAIL</th>
              <th>STATUS</th>
              <th>ACCOUNT CREATION</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.id}</td>
                <td>{account.name}</td>
                <td>{account.username}</td>
                <td>{account.email}</td>
                <td>
                  <label className="status-toggle">
                    <input 
                      type="checkbox" 
                      checked={account.status}
                      onChange={() => handleStatusToggle(account.id)}
                    />
                    <span className="slider"></span>
                  </label>
                </td>
                <td>{account.accountCreation}</td>
                <td>
                  <div className="manage-dropdown">
                    <button 
                      className="manage-button"
                      onClick={() => toggleDropdown(account.id)}
                    >
                      MANAGE
                    </button>
                    {openDropdown === account.id && (
                      <div className="manage-dropdown-menu">
                        <div 
                          className="manage-dropdown-item edit"
                          onClick={() => handleEdit(account.id)}
                        >
                          Edit
                        </div>
                        <div 
                          className="manage-dropdown-item delete"
                          onClick={() => handleDelete(account.id)}
                        >
                          Delete
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">ADD ACCOUNT</h3>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label className="form-label">NAME:</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Input text"
                />
              </div>

              <div className="form-group">
                <label className="form-label">USERNAME:</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Input text"
                />
              </div>

              <div className="form-group">
                <label className="form-label">EMAIL:</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Input text"
                />
              </div>

              <div className="upload-section">
                <label className="upload-label">UPLOAD PICTURE</label>
                <div 
                  className="upload-area"
                  onDrop={handleFileDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="upload-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="12" y1="17" x2="12" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="upload-text">
                    Drag and Drop files here or{' '}
                    <span className="upload-link">
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleFileChange}
                        className="file-input"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="file-label">
                        Choose file
                      </label>
                    </span>
                  </div>
                  {formData.profilePicture && (
                    <div className="selected-file">
                      Selected: {formData.profilePicture.name}
                    </div>
                  )}
                </div>
                <div className="upload-info">
                  <span className="format-info">Supported formats: JPEG, PNG</span>
                  <span className="size-info">Maximum size: 10MB</span>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={handleCloseModal}
                >
                  CANCEL
                </button>
                <button 
                  className="submit-button"
                  onClick={handleSubmitAccount}
                  disabled={!formData.name || !formData.username || !formData.email}
                >
                  ADD ACCOUNT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageAccountsPage;
