import React, { useState } from 'react';
import './LogsPage.css';

function LogsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('2025-12-30');
  const [dateTo, setDateTo] = useState('2025-12-31');
  const [selectedUser, setSelectedUser] = useState('ALL USERS');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const logsData = [
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Logged in.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Logged out.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Logged in.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Logged out.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Logged in.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Logged out.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Logged in.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Added a supply file.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Added an account.' },
    { timestamp: '12/30/2025 - 00:12:50', username: 'admin2025', remarks: 'Logged out.' },
  ];

  const userOptions = ['ALL USERS', 'admin2025', 'staff1', 'staff2', 'staff3'];

  const filteredLogs = logsData.filter(log => {
    const matchesSearch = log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.remarks.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUser = selectedUser === 'ALL USERS' || log.username === selectedUser;
    return matchesSearch && matchesUser;
  });

  const handleExport = () => {
    console.log('Exporting logs...');
    // Add export functionality here
  };

  return (
    <div className="logs-page-container">
      <div className="logs-header">
        <h2 className="page-title">Logs</h2>
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="Search"
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 15L21 21M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
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

      <table className="logs-table">
        <thead>
          <tr>
            <th>TIMESTAMP</th>
            <th>USERNAME</th>
            <th>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((log, index) => (
            <tr key={index}>
              <td>{log.timestamp}</td>
              <td>{log.username}</td>
              <td>{log.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LogsPage;