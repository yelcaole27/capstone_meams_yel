import React, { useState, useEffect } from 'react';
import './LogsPage.css';

function LogsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUser, setSelectedUser] = useState('ALL USERS');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [logsData, setLogsData] = useState([]);
  const [userOptions, setUserOptions] = useState(['ALL USERS']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get auth token from localStorage
  const getAuthToken = () => {
    return localStorage.getItem('authToken') || localStorage.getItem('adminToken');
  };

  // Fetch logs from API
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (selectedUser && selectedUser !== 'ALL USERS') params.append('username', selectedUser);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`http://localhost:8000/api/logs?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view logs. Admin access required.');
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else {
          throw new Error('Failed to fetch logs');
        }
      }

      const data = await response.json();
      
      if (data.success) {
        setLogsData(data.data || []);
        
        // Update user options if they're provided
        if (data.usernames) {
          setUserOptions(data.usernames);
        }
      } else {
        throw new Error(data.message || 'Failed to fetch logs');
      }

    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err.message);
      setLogsData([]);
    } finally {
      setLoading(false);
    }
  };

  // Export logs functionality
  const handleExport = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        alert('No authentication token found');
        return;
      }

      const exportData = {
        date_from: dateFrom || null,
        date_to: dateTo || null,
        username: selectedUser === 'ALL USERS' ? null : selectedUser,
        search: searchTerm || null
      };

      const response = await fetch('http://localhost:8000/api/logs/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error('Failed to export logs');
      }

      const data = await response.json();
      
      if (data.success) {
        // Create and download CSV file
        const blob = new Blob([data.csv_data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || 'meams_logs.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('Logs exported successfully');
      } else {
        throw new Error(data.message || 'Export failed');
      }

    } catch (err) {
      console.error('Error exporting logs:', err);
      alert(`Export failed: ${err.message}`);
    }
  };

  // Set default date range on component mount
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Fetch logs when component mounts or when filters change
  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchLogs();
    }
  }, [dateFrom, dateTo, selectedUser]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (dateFrom && dateTo) {
        fetchLogs();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchLogs();
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    // If it's already formatted, return as is
    if (typeof timestamp === 'string' && timestamp.includes(' - ')) {
      return timestamp;
    }
    
    // Otherwise, format it
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(',', ' -');
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <div className="logs-page-container">
      <div className="logs-header">
        <h2 className="page-title">Logs</h2>
        <div className="header-controls">
          <button 
            className="refresh-button"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh logs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C9.61 21 7.43 20.03 5.86 18.46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 18L5.86 18.46L6.32 15.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search logs..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 15L21 21M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="logs-filters">
        <div className="date-filter-group">
          <span className="date-filter-label">Date from:</span>
          <input
            type="date"
            className="date-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        
        <div className="date-filter-group">
          <span className="date-filter-label">Date to:</span>
          <input
            type="date"
            className="date-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="user-filter-dropdown">
          <button 
            className="dropdown-toggle"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
          >
            {selectedUser}
            <svg className="dropdown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {isUserDropdownOpen && (
            <div className="dropdown-menu">
              {userOptions.map(user => (
                <div 
                  key={user}
                  className="dropdown-item"
                  onClick={() => {
                    setSelectedUser(user);
                    setIsUserDropdownOpen(false);
                  }}
                >
                  {user}
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="export-button" onClick={handleExport}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Export
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="error-message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
          </svg>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="loading-message">
          <div className="loading-spinner"></div>
          Loading logs...
        </div>
      )}

      {/* Logs table */}
      {!loading && !error && (
        <>
          <div className="logs-info">
            <span>Showing {logsData.length} log entries</span>
            {(dateFrom || dateTo || selectedUser !== 'ALL USERS' || searchTerm) && (
              <button 
                className="clear-filters-btn"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedUser('ALL USERS');
                  const today = new Date();
                  const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                  setDateTo(today.toISOString().split('T')[0]);
                  setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>USERNAME</th>
                  <th>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {logsData.length > 0 ? (
                  logsData.map((log, index) => (
                    <tr key={log._id || index}>
                      <td>{formatTimestamp(log.timestamp)}</td>
                      <td>{log.username}</td>
                      <td>{log.remarks || log.action}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="no-data">
                      {searchTerm || selectedUser !== 'ALL USERS' || dateFrom || dateTo 
                        ? 'No logs found matching the current filters.' 
                        : 'No log entries available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default LogsPage;