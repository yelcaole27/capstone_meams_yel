import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import './HelpSupport.css';

function HelpSupport() {
  const { getCurrentUser, authToken } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('report');
  const [bugReport, setBugReport] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [expandedGuide, setExpandedGuide] = useState(null);
  const currentUser = getCurrentUser();

  const getAuthToken = () => {
    return localStorage.getItem('authToken') || localStorage.getItem('adminToken');
  };

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

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/report-bug`, {
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

  const GuideAccordionItem = ({ title, children, isOpen, onToggle }) => {
    return (
      <div className="guide-item">
        <div className="guide-item-header" onClick={onToggle}>
          <h4>{title}</h4>
          <div className={`guide-item-icon ${isOpen ? 'open' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <div className={`guide-item-content ${isOpen ? 'open' : ''}`}>
          {children}
        </div>
      </div>
    );
  };
   
  return (
    <div className="help-support-container">
      <div className="help-support-header">
        <h1>Help & Support</h1>
        <p>Find guides, information, and report issues</p>
      </div>

      <div className="help-support-tabs">
        <button
          className={`tab-button ${activeTab === 'user-guide' ? 'active' : ''}`}
          onClick={() => setActiveTab('user-guide')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 19.5C4 18.1193 5.11929 17 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.5 2H20V22H6.5C5.11929 22 4 20.8807 4 19.5V4.5C4 3.11929 5.11929 2 6.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          User Guide
        </button>
        <button
          className={`tab-button ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="8" r="1" fill="currentColor"/>
          </svg>
          About MED
        </button>
        <button
          className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.9011 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9011 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="1" fill="currentColor"/>
          </svg>
          Report Issue
        </button>
      </div>

      <div className="help-support-content">
        {activeTab === 'user-guide' && (
          <div className="user-guide-section">
            <div className="guide-card">
              <h3>Managing Supplies and Equipment</h3>
              
              <GuideAccordionItem
                title="Adding Supply"
                isOpen={expandedGuide === 'add-supply'}
                onToggle={() => setExpandedGuide(expandedGuide === 'add-supply' ? null : 'add-supply')}
              >
                <ol>
                  <li>Navigate to the Supplies section.</li>
                  <li>Scroll down to find and click the "Add Supply" button.</li>
                  <li>Complete the required information fields.</li>
                  <li>Click Add to save the new supply item.</li>
                </ol>
              </GuideAccordionItem>

              <GuideAccordionItem
                title="Adding Equipment"
                isOpen={expandedGuide === 'add-equipment'}
                onToggle={() => setExpandedGuide(expandedGuide === 'add-equipment' ? null : 'add-equipment')}
              >
                <ol>
                  <li>Go to the Equipment section.</li>
                  <li>Scroll down to locate and click the "Add Equipment" button.</li>
                  <li>Fill in the necessary details about the equipment.</li>
                  <li>Click Add to register the new equipment.</li>
                </ol>
              </GuideAccordionItem>

              <GuideAccordionItem
                title="Updating Supply Quantity"
                isOpen={expandedGuide === 'update-supply'}
                onToggle={() => setExpandedGuide(expandedGuide === 'update-supply' ? null : 'update-supply')}
              >
                <ol>
                  <li>Go to the Supplies section.</li>
                  <li>Click the name of the supply you wish to modify.</li>
                  <li>Select the "Update Supply" button.</li>
                  <li>Enter the exact new amount (quantity) for the supply and save the changes.</li>
                </ol>
              </GuideAccordionItem>

              <GuideAccordionItem
                title="Updating Equipment Details"
                isOpen={expandedGuide === 'update-equipment'}
                onToggle={() => setExpandedGuide(expandedGuide === 'update-equipment' ? null : 'update-equipment')}
              >
                <ol>
                  <li>Go to the Equipment section.</li>
                  <li>Click the name of the equipment you want to change.</li>
                  <li>Select the "Update Equipment" button.</li>
                  <li>Adjust the details (e.g., RepairDate, RepairDetails) as needed and save the changes.</li>
                </ol>
              </GuideAccordionItem>

              <GuideAccordionItem
                title="Locating the QR Code Generator"
                isOpen={expandedGuide === 'qr-code'}
                onToggle={() => setExpandedGuide(expandedGuide === 'qr-code' ? null : 'qr-code')}
              >
                <ol>
                  <li>Navigate to either the Supplies or Equipment section.</li>
                  <li>Click the item name (supply or equipment) for which you need a QR code.</li>
                  <li>You will see and click the "Generate QR Code" button.</li>
                  <li>The system will then display the unique QR code for that specific item.</li>
                </ol>
              </GuideAccordionItem>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="about-section">
            <div className="about-card">
              <div className="about-header">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="8" r="1" fill="currentColor"/>
                </svg>
                <h3>About MED</h3>
              </div>
              <p className="about-description" style={{ textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                Information about the Maintenance and Engineering Division will be displayed here soon.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="report-section">
            <div className="report-card">
              <div className="report-header">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.9011 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9011 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="17" r="1" fill="currentColor"/>
                </svg>
                <h3>Report an Issue</h3>
              </div>
              <p className="report-description">
                Please describe the issue you're experiencing or any questions you have. Our team will review your report and respond as soon as possible.
              </p>
              
              <div className="report-form">
                <label htmlFor="issue-description">Issue Description</label>
                <textarea
                  id="issue-description"
                  placeholder="Describe your issue or question in detail..."
                  value={bugReport}
                  onChange={(e) => setBugReport(e.target.value)}
                  rows="8"
                />
                
                <div className="report-actions">
                  <button
                    className="clear-btn"
                    onClick={() => setBugReport('')}
                    disabled={!bugReport.trim() || isSendingReport}
                  >
                    Clear
                  </button>
                  <button
                    className="submit-btn"
                    onClick={handleSendReport}
                    disabled={isSendingReport || !bugReport.trim()}
                  >
                    {isSendingReport ? (
                      <>
                        <div className="spinner"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Send Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HelpSupport;
