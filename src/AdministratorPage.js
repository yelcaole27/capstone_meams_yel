import React, { useState } from 'react';
import './AdministratorPage.css';

function AdministratorPage() {
  const [activeTab, setActiveTab] = useState('users');

  const userData = [
    { id: 1, username: 'admin', email: 'admin@meams.com', role: 'Administrator', status: 'Active' },
    { id: 2, username: 'user1', email: 'user1@meams.com', role: 'User', status: 'Active' },
    { id: 3, username: 'user2', email: 'user2@meams.com', role: 'User', status: 'Inactive' },
  ];

  const systemLogs = [
    { timestamp: '2024-01-15 10:30:00', user: 'admin', action: 'Login', details: 'Successful login' },
    { timestamp: '2024-01-15 10:25:00', user: 'user1', action: 'Add Item', details: 'Added new supply item MED-1-00009' },
    { timestamp: '2024-01-15 10:20:00', user: 'admin', action: 'User Management', details: 'Created new user account' },
    { timestamp: '2024-01-15 10:15:00', user: 'user2', action: 'Update Item', details: 'Updated quantity for MED-E-34561' },
  ];

  return (
    <div className="administrator-page-container">
      <div className="admin-header">
        <h2 className="page-title">Administrator Panel</h2>
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          System Logs
        </button>
        <button 
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          System Settings
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'users' && (
          <div className="users-section">
            <div className="section-header">
              <h3>User Management</h3>
              <button className="add-user-button">Add New User</button>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {userData.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span className={`status-badge ${user.status.toLowerCase()}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>
                      <button className="action-button edit">Edit</button>
                      <button className="action-button delete">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="logs-section">
            <div className="section-header">
              <h3>System Activity Logs</h3>
              <button className="export-logs-button">Export Logs</button>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {systemLogs.map((log, index) => (
                  <tr key={index}>
                    <td>{log.timestamp}</td>
                    <td>{log.user}</td>
                    <td>{log.action}</td>
                    <td>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-section">
            <div className="section-header">
              <h3>System Settings</h3>
            </div>
            <div className="settings-grid">
              <div className="setting-card">
                <h4>Database Management</h4>
                <p>Backup and restore system data</p>
                <div className="setting-actions">
                  <button className="setting-button primary">Backup Database</button>
                  <button className="setting-button secondary">Restore Database</button>
                </div>
              </div>
              
              <div className="setting-card">
                <h4>System Maintenance</h4>
                <p>Clear cache and optimize system performance</p>
                <div className="setting-actions">
                  <button className="setting-button primary">Clear Cache</button>
                  <button className="setting-button secondary">Optimize Database</button>
                </div>
              </div>
              
              <div className="setting-card">
                <h4>Security Settings</h4>
                <p>Configure system security parameters</p>
                <div className="setting-actions">
                  <button className="setting-button primary">Update Security</button>
                  <button className="setting-button secondary">View Logs</button>
                </div>
              </div>
              
              <div className="setting-card">
                <h4>Email Configuration</h4>
                <p>Configure email settings for notifications</p>
                <div className="setting-actions">
                  <button className="setting-button primary">Configure Email</button>
                  <button className="setting-button secondary">Test Email</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdministratorPage;