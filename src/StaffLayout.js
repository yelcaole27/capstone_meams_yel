import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import ProfileModal from './ProfileModal';
import './StaffLayout.css';

function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getCurrentUser, authToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showStaffMenu, setShowStaffMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [bugReport, setBugReport] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [showUserGuideModal, setShowUserGuideModal] = useState(false);
  const currentUser = getCurrentUser();

  // State for full name and profile picture
  const [fullName, setFullName] = useState(currentUser ? currentUser.username : 'Staff User');
  const [profilePicture, setProfilePicture] = useState(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef(null);

  // Convert file to base64 helper
  const convertFileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  // Fetch profile data including picture
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (authToken) {
        try {
          const response = await fetch('http://localhost:8000/profile', {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const profileData = await response.json();
            setFullName(profileData.fullName || currentUser.username);
            if (profileData.profilePicture) {
              setProfilePicture(profileData.profilePicture);
            }
          } else {
            setFullName(currentUser.username);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setFullName(currentUser.username);
        }
      }
    };

    fetchUserProfile();
  }, [authToken, currentUser]);

  const toggleHelpMenu = () => setShowHelpMenu(!showHelpMenu);

  const handleSendReport = async () => {
    if (!bugReport.trim()) {
      alert('Please enter your question or bug report.');
      return;
    }

    try {
      setIsSendingReport(true);
      const token = getAuthToken();

      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch('http://localhost:8000/api/report-bug', {
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
        setShowReportModal(false);
      } else {
        throw new Error(result.detail || 'Failed to send bug report');
      }
    } catch (error) {
      console.error('Bug report error:', error);
      alert('Failed to send bug report. Please try again later.');
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleProfilePictureUpdate = (newPicture) => {
    console.log('Profile picture updated from modal:', newPicture);
    setProfilePicture(newPicture);
  };

  const handleAvatarClick = () => {
    if (!uploadingPicture) fileInputRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file too large. Please select an image smaller than 5MB');
      e.target.value = '';
      return;
    }

    try {
      setUploadingPicture(true);
      const base64 = await convertFileToBase64(file);
      setProfilePicture(base64);

      const response = await fetch('http://localhost:8000/profile/picture', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profilePicture: base64 }),
      });

      if (!response.ok) throw new Error('Upload failed');
    } catch (error) {
      alert('Error uploading profile picture. Please try again.');
      setProfilePicture(null);
    } finally {
      setUploadingPicture(false);
      e.target.value = '';
    }
  };

  const handleDeleteProfilePicture = async (e) => {
    e.stopPropagation();
    if (!profilePicture) return;
    if (!window.confirm('Are you sure you want to delete your profile picture?')) return;

    try {
      setUploadingPicture(true);
      const response = await fetch('http://localhost:8000/profile/picture', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) setProfilePicture(null);
      else throw new Error('Delete failed');
    } catch (error) {
      alert('Error deleting profile picture. Please try again.');
    } finally {
      setUploadingPicture(false);
    }
  };

  const getAuthToken = () => localStorage.getItem('authToken');

  const handleSignOut = async () => {
    try {
      const token = getAuthToken();
      if (token) {
        try {
          await fetch('http://localhost:8000/logout', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch {}
      }
      localStorage.removeItem('authToken');
      navigate('/login');
    } catch {
      localStorage.removeItem('authToken');
      navigate('/login');
    }
  };

  const toggleStaffMenu = () => setShowStaffMenu(!showStaffMenu);

  const handleProfileClick = (e) => {
    e.preventDefault();
    setShowProfileModal(true);
    setShowStaffMenu(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="staff-layout-container">
      <aside className="staff-sidebar">
        <div className="logo">
          <h1 className="logo-text">MEAMS</h1>
        </div>

        <div className="staff-info">
          <div
            className={`staff-avatar ${uploadingPicture ? 'uploading' : ''}`}
            title={profilePicture ? 'Click to change profile picture' : 'Click to upload profile picture'}
            style={{
              cursor: uploadingPicture ? 'not-allowed' : 'pointer',
              position: 'relative',
            }}
            onClick={handleAvatarClick}
          >
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="avatar-image" />
            ) : (
              <div className="avatar-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" fill="currentColor" />
                  <path d="M6 18c0-3.31 5.33-5 6-5s6 1.69 6 5v1H6v-1z" fill="currentColor" />
                </svg>
              </div>
            )}

            <div className="avatar-overlay">
              {uploadingPicture ? (
                <div className="upload-spinner"></div>
              ) : profilePicture ? (
                <button
                  className="avatar-action-btn delete-btn"
                  onClick={handleDeleteProfilePicture}
                  title="Delete profile picture"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <p className="staff-name">{fullName}</p>
        </div>

        <nav className="nav-menu">
          <ul>
            <li>
              <Link to="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 3H4C3.46957 3 2.96086 3.21071 2.58579 3.58579C2.21071 3.96086 2 4.46957 2 5V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H20C20.5304 22 21.0391 21.7893 21.4142 21.4142C21.7893 21.0391 22 20.5304 22 20V5C22 4.46957 21.7893 3.96086 21.4142 3.58579C21.0391 3.21071 20.5304 3 20 3H14M10 3V12M10 3H14M14 3V12M14 12V22M10 12V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/supplies" className={`nav-item ${isActive('/supplies') ? 'active' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C14.76 4 17 6.24 17 9H7C7 6.24 9.24 4 12 4ZM19.78 14H4.22C4.54 16.32 6.55 18 9 18H15C17.45 18 19.46 16.32 19.78 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Supplies
              </Link>
            </li>
            <li>
              <Link to="/equipment" className={`nav-item ${isActive('/equipment') ? 'active' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Equipment
              </Link>
            </li>
            <li>
              <Link to="/settings" className={`nav-item ${isActive('/settings') ? 'active' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Settings
              </Link>
            </li>
          </ul>
        </nav>

        <div className="sign-out">
          <button onClick={handleSignOut} className="sign-out-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M17 17L22 12L17 7M22 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <h1>Welcome, {fullName}</h1>
          <div className="header-actions">
            {/* Help & Support Dropdown */}
            <div className="staff-menu-dropdown">
              <button className="staff-menu-toggle" onClick={toggleHelpMenu}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {showHelpMenu && (
                <div className="admin-dropdown-content">
                  <a href="#" onClick={(e) => { 
                    e.preventDefault(); 
                    setShowHelpMenu(false); 
                    setShowUserGuideModal(true);
                  }}>User Guide</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); setShowHelpMenu(false); }}>About MED</a>
                  <a href="#" onClick={(e) => { 
                    e.preventDefault(); 
                    setShowHelpMenu(false); 
                    setShowReportModal(true);
                  }}>Report Issue</a>
                </div>
              )}
            </div>

            {/* Theme Toggle Button */}
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" fill="currentColor"/>
                  <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            
            {/* Profile Dropdown */}
            <div className="staff-menu-dropdown">
              <button className="staff-menu-toggle" onClick={toggleStaffMenu}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.96C6.04 13.98 10 12.9 12 12.9C13.99 12.9 17.96 13.98 18 15.96C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor" />
                </svg>
              </button>
              {showStaffMenu && (
                <div className="staff-dropdown-content">
                  <a href="#" onClick={handleProfileClick}>Profile</a>
                  <a href="#" onClick={handleSignOut}>Sign out</a>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="main-content-scrollable">
          <Outlet />
        </div>
      </main>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfilePictureUpdate={handleProfilePictureUpdate}
      />

      {/* Report Issue Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Report Issue</h2>
              <button 
                onClick={() => setShowReportModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
            
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Please describe the issue you're experiencing or any questions you have:
            </p>
            
            <textarea
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '20px'
              }}
              placeholder="Type your issue or question here..."
              value={bugReport}
              onChange={(e) => setBugReport(e.target.value)}
            />
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setBugReport('');
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendReport}
                disabled={isSendingReport || !bugReport.trim()}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  background: isSendingReport || !bugReport.trim() ? '#ccc' : '#4CAF50',
                  color: 'white',
                  cursor: isSendingReport || !bugReport.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isSendingReport ? 'Sending...' : 'Send Report'}
                {!isSendingReport && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Guide Modal */}
      {showUserGuideModal && (
        <div className="modal-overlay" onClick={() => setShowUserGuideModal(false)}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '800px', 
              padding: '0',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '8px',
              background: theme === 'light' ? '#ffffff' : '#1e1e1e'
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '30px',
              background: theme === 'light' ? '#2c3e50' : '#0d1117',
              color: '#ffffff',
              borderRadius: '8px 8px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '600', color: '#ffffff' }}>System User Guide</h2>
              <button 
                onClick={() => setShowUserGuideModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '28px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '0' }}>
              <div style={{ 
                padding: '30px', 
                background: theme === 'light' ? '#f8f9fa' : '#161b22'
              }}>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  margin: '0 0 20px 0', 
                  color: theme === 'light' ? '#2c3e50' : '#e6edf3'
                }}>
                  Managing Supplies and Equipment
                </h3>
              </div>
              
              <div style={{ 
                padding: '30px', 
                background: theme === 'light' ? '#ffffff' : '#0d1117'
              }}>
                <h4 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '15px', 
                  color: theme === 'light' ? '#2c3e50' : '#e6edf3'
                }}>
                  1. Adding Supply
                </h4>
                <ol style={{ 
                  paddingLeft: '25px', 
                  margin: '0', 
                  color: theme === 'light' ? '#444' : '#c9d1d9'
                }}>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Navigate to the Supplies section.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Scroll down to find and click the "Add Supply" button.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Complete the required information fields.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Click Add to save the new supply item.</li>
                </ol>
              </div>

              <div style={{ 
                padding: '30px', 
                background: theme === 'light' ? '#f8f9fa' : '#161b22'
              }}>
                <h4 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '15px', 
                  color: theme === 'light' ? '#2c3e50' : '#e6edf3'
                }}>
                  2. Adding Equipment
                </h4>
                <ol style={{ 
                  paddingLeft: '25px', 
                  margin: '0', 
                  color: theme === 'light' ? '#444' : '#c9d1d9'
                }}>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Go to the Equipment section.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Scroll down to locate and click the "Add Equipment" button.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Fill in the necessary details about the equipment.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Click Add to register the new equipment.</li>
                </ol>
              </div>

              <div style={{ 
                padding: '30px', 
                background: theme === 'light' ? '#ffffff' : '#0d1117'
              }}>
                <h4 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '15px', 
                  color: theme === 'light' ? '#2c3e50' : '#e6edf3'
                }}>
                  3. Updating Supply Quantity
                </h4>
                <ol style={{ 
                  paddingLeft: '25px', 
                  margin: '0', 
                  color: theme === 'light' ? '#444' : '#c9d1d9'
                }}>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Go to the Supplies section.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Click the name of the supply you wish to modify.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Select the "Update Supply" button.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Enter the exact new amount (quantity) for the supply and save the changes.</li>
                </ol>
              </div>

              <div style={{ 
                padding: '30px', 
                background: theme === 'light' ? '#f8f9fa' : '#161b22'
              }}>
                <h4 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '15px', 
                  color: theme === 'light' ? '#2c3e50' : '#e6edf3'
                }}>
                  4. Updating Equipment Details
                </h4>
                <ol style={{ 
                  paddingLeft: '25px', 
                  margin: '0', 
                  color: theme === 'light' ? '#444' : '#c9d1d9'
                }}>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Go to the Equipment section.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Click the name of the equipment you want to change.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Select the "Update Equipment" button.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Adjust the details (e.g., RepairDate, RepairDetails) as needed and save the changes.</li>
                </ol>
              </div>

              <div style={{ 
                padding: '30px', 
                background: theme === 'light' ? '#ffffff' : '#0d1117'
              }}>
                <h4 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  marginBottom: '15px', 
                  color: theme === 'light' ? '#2c3e50' : '#e6edf3'
                }}>
                  5. Locating the QR Code Generator
                </h4>
                <ol style={{ 
                  paddingLeft: '25px', 
                  margin: '0', 
                  color: theme === 'light' ? '#444' : '#c9d1d9'
                }}>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Navigate to either the Supplies or Equipment section.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>Click the item name (supply or equipment) for which you need a QR code.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>You will see and click the "Generate QR Code" button.</li>
                  <li style={{ marginBottom: '10px', lineHeight: '1.6' }}>The system will then display the unique QR code for that specific item.</li>
                </ol>
              </div>
            </div>

            <div style={{ 
              padding: '20px 30px', 
              background: theme === 'light' ? '#f8f9fa' : '#161b22', 
              borderTop: theme === 'light' ? '1px solid #e0e0e0' : '1px solid #30363d', 
              textAlign: 'right',
              borderRadius: '0 0 8px 8px'
            }}>
              <button
                onClick={() => setShowUserGuideModal(false)}
                style={{
                  padding: '12px 30px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#4CAF50',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffLayout;