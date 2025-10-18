import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import './ProfileModal.css';

function ProfileModal({ isOpen, onClose, onProfilePictureUpdate }) {
  const { getCurrentUser, authToken } = useAuth();
  const currentUser = getCurrentUser();
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    fullName: '',
    role: '',
    department: '',
    phoneNumber: '',
    dateJoined: '',
    profilePicture: null
  });
  const [editData, setEditData] = useState({});
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Profile picture specific states
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef(null);

  // Helper function for base64 conversion
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Fetch profile data when modal opens
  useEffect(() => {
    if (isOpen && authToken) {
      fetchProfileData();
    }
  }, [isOpen, authToken]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/profile', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
        setEditData(data);
      } else {
        // Fallback to token data if API fails
        const fallbackData = {
          username: currentUser?.username || '',
          email: currentUser?.email || 'jayson.valeroso@example.com',
          fullName: currentUser?.fullName || 'Engr. Jayson Valeroso',
          role: currentUser?.role || 'admin',
          department: currentUser?.department || 'Engineering Department',
          phoneNumber: currentUser?.phoneNumber || '+63 912 345 6789',
          dateJoined: currentUser?.dateJoined || '2023-01-15',
          profilePicture: null
        };
        setProfileData(fallbackData);
        setEditData(fallbackData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Fallback data
      const fallbackData = {
        username: currentUser?.username || '',
        email: 'jayson.valeroso@example.com',
        fullName: 'Engr. Jayson Valeroso',
        role: currentUser?.role || 'admin',
        department: 'Engineering Department',
        phoneNumber: '+63 912 345 6789',
        dateJoined: '2023-01-15',
        profilePicture: null
      };
      setProfileData(fallbackData);
      setEditData(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  // Handle profile picture upload
  const handleAvatarClick = () => {
    if (uploadingPicture) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image file too large. Please select an image smaller than 5MB');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      event.target.value = '';
      return;
    }

    try {
      setUploadingPicture(true);
      const imageBase64 = await convertFileToBase64(file);
      
      // Update local state immediately for instant UI feedback
      setProfileData(prev => ({ ...prev, profilePicture: imageBase64 }));
      setEditData(prev => ({ ...prev, profilePicture: imageBase64 }));

      const response = await fetch('http://localhost:8000/profile/picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profilePicture: imageBase64 })
      });

      if (response.ok) {
        // Notify parent component to update sidebar
        if (onProfilePictureUpdate) {
          onProfilePictureUpdate(imageBase64);
        }
        setMessage('Profile picture updated successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('Error uploading profile picture. Please try again.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      // Revert local state on error
      setProfileData(prev => ({ ...prev, profilePicture: null }));
      setEditData(prev => ({ ...prev, profilePicture: null }));
    } finally {
      setUploadingPicture(false);
      event.target.value = '';
    }
  };

  const handleDeleteProfilePicture = async (e) => {
    e.stopPropagation();
    
    if (!profileData.profilePicture) return;
    
    if (!window.confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    try {
      setUploadingPicture(true);
      
      const response = await fetch('http://localhost:8000/profile/picture', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Update local state
        setProfileData(prev => ({ ...prev, profilePicture: null }));
        setEditData(prev => ({ ...prev, profilePicture: null }));
        
        // Notify parent component to update sidebar
        if (onProfilePictureUpdate) {
          onProfilePictureUpdate(null);
        }
        
        setMessage('Profile picture deleted successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMessage('Error deleting profile picture. Please try again.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setProfileData(updatedData);
        setEditData(updatedData);
        setIsEditing(false);
        setMessage('Profile updated successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setMessage(errorData.detail || 'Failed to update profile');
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile. Please try again.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setShowChangePassword(false);
        setMessage('Password changed successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setMessage(errorData.detail || 'Failed to change password');
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage('Error changing password. Please try again.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditData(profileData);
    setIsEditing(false);
    setShowChangePassword(false);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setMessage('');
  };

  const handleClose = () => {
    handleCancel();
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  return (
    <div className="profile-modal-overlay" onClick={handleClose}>
      <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.96C6.04 13.98 10 12.9 12 12.9C13.99 12.9 17.96 13.98 18 15.96C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/>
            </svg>
            Profile Information
          </h2>
          <button className="profile-modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {message && (
          <div className={`profile-message ${messageType}`}>
            {message}
          </div>
        )}

        <div className="profile-modal-body">
          {loading ? (
            <div className="profile-loading">
              <div className="loading-spinner"></div>
              <p>Loading profile...</p>
            </div>
          ) : (
            <>
              <div className="profile-avatar-section">
                {/* Updated profile picture section */}
                <div 
                  className={`profile-avatar-large ${uploadingPicture ? 'uploading' : ''}`}
                  onClick={handleAvatarClick}
                  style={{ 
                    cursor: uploadingPicture ? 'not-allowed' : 'pointer',
                    position: 'relative'
                  }}
                  title={profileData.profilePicture ? "Click to change profile picture" : "Click to upload profile picture"}
                >
                  {profileData.profilePicture ? (
                    <img 
                      src={profileData.profilePicture} 
                      alt="Profile" 
                      style={{ 
                        width: '100px', 
                        height: '100px', 
                        borderRadius: '50%', 
                        objectFit: 'cover',
                        border: '3px solid #4ade80'
                      }}
                    />
                  ) : (
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.96C6.04 13.98 10 12.9 12 12.9C13.99 12.9 17.96 13.98 18 15.96C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/>
                    </svg>
                  )}
                  
                  {/* Profile picture overlay */}
                  <div className="avatar-overlay" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = 1}
                  onMouseLeave={(e) => e.target.style.opacity = 0}>
                    {uploadingPicture ? (
                      <div className="upload-spinner" style={{ color: 'white' }}>Uploading...</div>
                    ) : profileData.profilePicture ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16 13H13V16C13 16.55 12.55 17 12 17C11.45 17 11 16.55 11 16V13H8C7.45 13 7 12.55 7 12C7 11.45 7.45 11 8 11H11V8C11 7.45 11.45 7 12 7C12.55 7 13 7.45 13 8V11H16C16.55 11 17 11.45 17 12C17 12.55 16.55 13 16 13Z"/>
                        </svg>
                        <button 
                          onClick={handleDeleteProfilePicture}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'white', 
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />

                <div className="profile-user-info">
                  <h3>{profileData.fullName}</h3>
                  <p className="profile-role">{profileData.role}</p>
                  <p className="profile-department">{profileData.department}</p>
                </div>
              </div>

              <div className="profile-details">
                <div className="profile-field">
                  <label>Username</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.username || ''}
                      onChange={(e) => handleEditChange('username', e.target.value)}
                      disabled={true}
                      className="profile-input disabled"
                    />
                  ) : (
                    <p>{profileData.username}</p>
                  )}
                </div>

                <div className="profile-field">
                  <label>Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.fullName || ''}
                      onChange={(e) => handleEditChange('fullName', e.target.value)}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.fullName}</p>
                  )}
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => handleEditChange('email', e.target.value)}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.email}</p>
                  )}
                </div>

                <div className="profile-field">
                  <label>Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editData.phoneNumber || ''}
                      onChange={(e) => handleEditChange('phoneNumber', e.target.value)}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.phoneNumber || 'Not provided'}</p>
                  )}
                </div>

                <div className="profile-field">
                  <label>Department</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.department || ''}
                      onChange={(e) => handleEditChange('department', e.target.value)}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.department}</p>
                  )}
                </div>

                <div className="profile-field">
                  <label>Role</label>
                  <p>{profileData.role}</p>
                  <small className="profile-field-note">Role cannot be changed</small>
                </div>

                <div className="profile-field">
                  <label>Date Joined</label>
                  <p>{formatDate(profileData.dateJoined)}</p>
                </div>
              </div>

              {showChangePassword && (
                <div className="password-change-section">
                  <h4>Change Password</h4>
                  <div className="profile-field">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        currentPassword: e.target.value
                      }))}
                      className="profile-input"
                    />
                  </div>
                  <div className="profile-field">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      className="profile-input"
                    />
                  </div>
                  <div className="profile-field">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      className="profile-input"
                    />
                  </div>
                  <div className="password-actions">
                    <button 
                      className="btn-secondary" 
                      onClick={() => setShowChangePassword(false)}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn-primary" 
                      onClick={handlePasswordChange}
                      disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    >
                      {loading ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="profile-modal-footer">
          <div className="profile-actions">
            {!isEditing && !showChangePassword ? (
              <>
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowChangePassword(true)}
                >
                  Change Password
                </button>
                <button 
                  className="btn-primary" 
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </button>
              </>
            ) : isEditing ? (
              <>
                <button 
                  className="btn-secondary" 
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;