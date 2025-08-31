// COMPLETE UPDATED ManageAccountsPage.js file:

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import './ManageAccountsPage.css';

function ManageAccountsPage() {
  const { authToken, adminToken } = useAuth();
  
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAccountOverview, setShowAccountOverview] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editFormData, setEditFormData] = useState({
    name: '',
    username: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    role: 'staff',
    department: 'Operations',
    position: 'Staff Member',
    phone_number: '',
    profilePicture: null
  });

  // State for accounts from API
  const [accounts, setAccounts] = useState([]);

  // Get auth token - FIXED VERSION
  const getAuthToken = () => {
    // Check for admin token first, then regular auth token
    return adminToken || authToken || localStorage.getItem('adminToken') || localStorage.getItem('authToken') || '';
  };

  // Fetch accounts from API
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      const response = await fetch('http://localhost:8000/api/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAccounts(data.data);
        setError(''); // Clear any previous errors
      } else {
        setError('Failed to fetch accounts');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('Failed to load accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };


useEffect(() => {
  const handleClickOutside = (event) => {
    if (openDropdown && !event.target.closest('.manage-dropdown')) {
      setOpenDropdown(null);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [openDropdown]);

  // Load accounts on component mount
  useEffect(() => {
    fetchAccounts();
  }, [authToken, adminToken]); // Re-fetch when tokens change

  const handleStatusToggle = async (accountId) => {
    try {
      const account = accounts.find(acc => acc._id === accountId);
      if (!account) return;

      const response = await fetch(`http://localhost:8000/api/accounts/${accountId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: !account.status
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Update local state
        setAccounts(accounts.map(acc => 
          acc._id === accountId ? { ...acc, status: !acc.status } : acc
        ));
        setSuccess('Account status updated successfully');
      }
    } catch (error) {
      console.error('Error updating account status:', error);
      setError('Failed to update account status');
    }
  };

  const toggleDropdown = (id) => {
    setOpenDropdown(openDropdown === id ? null : id);
  };

  const handleEdit = (id) => {
    const accountToEdit = accounts.find(account => account._id === id);
    if (accountToEdit) {
      setSelectedAccount(accountToEdit);
      setEditFormData({
        name: accountToEdit.name,
        username: accountToEdit.username
      });
      setShowEditModal(true);
    }
    setOpenDropdown(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this account?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/accounts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAccounts(accounts.filter(acc => acc._id !== id));
        setSuccess('Account deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account');
    } finally {
      setLoading(false);
    }
    setOpenDropdown(null);
  };

  const handleResetPassword = async (id) => {
    if (!window.confirm('Are you sure you want to reset this account\'s password? A new password will be sent to their email.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/accounts/${id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setError('Failed to reset password');
    } finally {
      setLoading(false);
    }
    setOpenDropdown(null);
  };

  const handleAddAccount = () => {
    setShowAddModal(true);
    setError('');
    setSuccess('');
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setFormData({
      name: '',
      username: '',
      email: '',
      role: 'staff',
      department: 'Operations',
      position: 'Staff Member',
      phone_number: '',
      profilePicture: null
    });
    setError('');
    setSuccess('');
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedAccount(null);
    setEditFormData({
      name: '',
      username: ''
    });
  };

  const handleNameClick = (account) => {
    setSelectedAccount(account);
    setShowAccountOverview(true);
  };

  const handleCloseAccountOverview = () => {
    setShowAccountOverview(false);
    setSelectedAccount(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
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

  const handleSubmitAccount = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const accountData = {
        name: formData.name,
        username: formData.username,
        email: formData.email,
        role: formData.role,
        department: formData.department,
        position: formData.position,
        phone_number: formData.phone_number
      };

      const response = await fetch('http://localhost:8000/api/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(accountData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        // Refresh accounts list
        await fetchAccounts();
        // Close modal after a short delay to show success message
        setTimeout(() => {
          handleCloseModal();
        }, 2000);
      } else {
        setError('Failed to create account');
      }

    } catch (error) {
      console.error('Error creating account:', error);
      setError(error.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedAccount) return;

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/accounts/${selectedAccount._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editFormData.name,
          username: editFormData.username
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Update local state
        setAccounts(accounts.map(account => 
          account._id === selectedAccount._id 
            ? { 
                ...account, 
                name: editFormData.name, 
                username: editFormData.username 
              }
            : account
        ));
        setSuccess('Account updated successfully');
        handleCloseEditModal();
      }
    } catch (error) {
      console.error('Error updating account:', error);
      setError('Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="manage-accounts-page-container">
      {/* Error/Success Messages */}
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="accounts-header">
        <h2 className="page-title">Manage Accounts</h2>
        <button className="add-account-button" onClick={handleAddAccount}>
          ADD ACCOUNT
        </button>
      </div>

      {loading && <div className="loading-spinner">Loading...</div>}

      <div className="account-cards-grid">
        {accounts.map((account) => (
          <div 
            key={account._id} 
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
            {accounts.map((account, index) => (
              <tr key={account._id}>
                <td>{index + 1}</td>
                <td>
                  <span 
                    className="clickable-name"
                    onClick={() => handleNameClick(account)}
                  >
                    {account.name}
                  </span>
                </td>
                <td>{account.username}</td>
                <td>{account.email}</td>
                <td>
                  <label className="status-toggle">
                    <input 
                      type="checkbox" 
                      checked={account.status}
                      onChange={() => handleStatusToggle(account._id)}
                    />
                    <span className="slider"></span>
                  </label>
                </td>
                <td>{account.account_creation}</td>
                <td>
                  <div className="manage-dropdown">
                    <button 
                      className="manage-button"
                      onClick={() => toggleDropdown(account._id)}
                    >
                      MANAGE
                    </button>
                    {openDropdown === account._id && (
                      <div className="manage-dropdown-menu">
                        <div 
                          className="manage-dropdown-item edit"
                          onClick={() => handleEdit(account._id)}
                        >
                          Edit
                        </div>
                        <div 
                          className="manage-dropdown-item reset"
                          onClick={() => handleResetPassword(account._id)}
                        >
                          Reset Password
                        </div>
                        <div 
                          className="manage-dropdown-item delete"
                          onClick={() => handleDelete(account._id)}
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
              {error && <div className="modal-error">{error}</div>}
              {success && <div className="modal-success">{success}</div>}

              <div className="form-group">
                <label className="form-label">NAME:</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Full Name"
                  required
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
                  placeholder="Username"
                  required
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
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">ROLE:</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="form-input"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">DEPARTMENT:</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Department"
                />
              </div>

              <div className="form-group">
                <label className="form-label">POSITION:</label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Job Position"
                />
              </div>

              <div className="form-group">
                <label className="form-label">PHONE NUMBER:</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="+63 912 345 6789"
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

              <div className="password-notice">
                <p><strong>📧 Password Notification:</strong> A secure password will be automatically generated and sent to the provided email address.</p>
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={handleCloseModal}
                  disabled={loading}
                >
                  CANCEL
                </button>
                <button 
                  className="submit-button"
                  onClick={handleSubmitAccount}
                  disabled={loading || !formData.name || !formData.username || !formData.email}
                >
                  {loading ? 'CREATING...' : 'ADD ACCOUNT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && selectedAccount && (
        <div className="modal-overlay">
          <div className="edit-account-modal">
            <div className="edit-modal-header">
              <h3 className="edit-modal-title">Edit Account</h3>
            </div>
            
            <div className="edit-modal-content">
              <div className="edit-image-section">
                <div className="edit-image-placeholder">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              <div className="edit-form-section">
                <div className="edit-form-left">
                  <div className="edit-form-group">
                    <label className="edit-form-label">Name:</label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditInputChange}
                      className="edit-form-input"
                    />
                  </div>

                  <div className="edit-form-group">
                    <label className="edit-form-label">Username:</label>
                    <input
                      type="text"
                      name="username"
                      value={editFormData.username}
                      onChange={handleEditInputChange}
                      className="edit-form-input"
                    />
                  </div>

                  <div className="edit-form-group">
                    <label className="edit-form-label">ID:</label>
                    <span className="edit-form-readonly">{selectedAccount._id}</span>
                  </div>
                </div>

                <div className="edit-form-right">
                  <div className="edit-form-group">
                    <label className="edit-form-label">Status:</label>
                    <span className="edit-form-readonly">
                      {selectedAccount.status ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="edit-form-group">
                    <label className="edit-form-label">Account Created:</label>
                    <span className="edit-form-readonly">{selectedAccount.account_creation}</span>
                  </div>

                  <div className="edit-form-group">
                    <label className="edit-form-label">Email:</label>
                    <span className="edit-form-readonly">{selectedAccount.email}</span>
                  </div>
                </div>
              </div>

              <div className="edit-modal-actions">
                <button 
                  className="save-changes-button"
                  onClick={handleSaveChanges}
                  disabled={loading}
                >
                  {loading ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Overview Modal */}
      {showAccountOverview && selectedAccount && (
        <div className="modal-overlay">
          <div className="account-overview-modal">
            <div className="account-overview-header">
              <h3 className="account-overview-title">Account Overview</h3>
              <button 
                className="close-button"
                onClick={handleCloseAccountOverview}
              >
                ×
              </button>
            </div>
            
            <div className="account-overview-content">
              <div className="account-image-section">
                <div className="account-image-placeholder">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="no-image-text">No Image</div>
                </div>
              </div>

              <div className="account-details-section">
                <div className="detail-row">
                  <span className="detail-label">Account Name:</span>
                  <span className="detail-value">{selectedAccount.name}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Username:</span>
                  <span className="detail-value">{selectedAccount.username}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{selectedAccount.email}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Role:</span>
                  <span className="detail-value">{selectedAccount.role}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Department:</span>
                  <span className="detail-value">{selectedAccount.department}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Position:</span>
                  <span className="detail-value">{selectedAccount.position}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Phone Number:</span>
                  <span className="detail-value">{selectedAccount.phone_number || 'Not provided'}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className={`detail-value status-${selectedAccount.status ? 'active' : 'inactive'}`}>
                    {selectedAccount.status ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Account Creation:</span>
                  <span className="detail-value">{selectedAccount.account_creation}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Last Login:</span>
                  <span className="detail-value">{selectedAccount.last_login}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export default ManageAccountsPage;

