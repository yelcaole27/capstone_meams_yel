import React, { useState } from 'react';
import './ManageAccountsPage.css';

function ManageAccountsPage() {
  const [openDropdown, setOpenDropdown] = useState(null);

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
    console.log('Add new account');
    // Add new account functionality here
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
    </div>
  );
}

export default ManageAccountsPage;