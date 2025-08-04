import React, { useState, useEffect } from 'react';
import './ResetPassword.css';

function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [isValidToken, setIsValidToken] = useState(null);

  // Simulate getting token from URL parameters
  useEffect(() => {
    // In real app, you'd get this from URL: new URLSearchParams(window.location.search).get('token')
    const urlToken = 'demo-reset-token-123';
    setToken(urlToken);
    
    // Validate token with backend
    validateToken(urlToken);
  }, []);

  const validateToken = async (tokenToValidate) => {
    setIsLoading(true);
    // Simulate API call to validate token
    setTimeout(() => {
      // Simulate token validation (in real app, call your API)
      const isValid = tokenToValidate && tokenToValidate.length > 10;
      setIsValidToken(isValid);
      setIsLoading(false);
      
      if (!isValid) {
        setMessage('Invalid or expired reset link. Please request a new one.');
      }
    }, 1000);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!password || !confirmPassword) {
      setMessage('Please fill in all fields');
      return;
    }
    
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setMessage('Password reset successfully! You can now log in with your new password.');
      
      // In real app, redirect to login page after success
      setTimeout(() => {
        // window.location.href = '/login';
        console.log('Redirect to login page');
      }, 2000);
    }, 1500);
  };

  const goBackToLogin = () => {
    // In real app: window.location.href = '/login';
    console.log('Navigate back to login');
  };

  if (isLoading && isValidToken === null) {
    return (
      <div className="reset-container">
        <div className="reset-form">
          <div className="logo">
            <h1 className="logo-text">MEAMS</h1>
          </div>
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Validating reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="reset-container">
        <div className="reset-form">
          <div className="logo">
            <h1 className="logo-text">MEAMS</h1>
          </div>
          <div className="error-state">
            <svg className="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
              <path d="m15 9-6 6" stroke="#ef4444" strokeWidth="2"/>
              <path d="m9 9 6 6" stroke="#ef4444" strokeWidth="2"/>
            </svg>
            <h2>Invalid Reset Link</h2>
            <p>This password reset link is invalid or has expired. Please request a new one.</p>
            <button onClick={goBackToLogin} className="back-to-login-btn">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-container">
      <div className="reset-form">
        <div className="logo">
          <h1 className="logo-text">MEAMS</h1>
        </div>
        
        <div className="reset-header">
          <h2>Create New Password</h2>
          <p>Please enter your new password below</p>
        </div>

        <div>
          <div className="input-group">
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
                <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="reset-input"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="input-group">
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
                <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="reset-input"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="password-requirements">
            <p>Password must be at least 8 characters long</p>
          </div>

          {message && (
            <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <button 
            onClick={handleResetPassword} 
            className="reset-button"
            disabled={isLoading}
          >
            {isLoading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </div>

        <div className="back-to-login">
          <button onClick={goBackToLogin} className="back-link">
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;