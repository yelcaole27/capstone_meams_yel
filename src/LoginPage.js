import React, { useState } from 'react';
import './LoginPage.css';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(''); // This will now handle login messages as well
  const [passwordVisible, setPasswordVisible] = useState(false); // State to toggle password visibility

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setMessage(''); // Clear any previous messages
    setIsLoading(true); // Start loading state

    try {
      // Send login data (username and password) to the backend
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      const data = await response.json(); // Parse the JSON response from the backend

      if (response.ok) {
        setMessage("Login successful!"); // Set success message

        // On successful login, store the JWT token in localStorage
        localStorage.setItem('authToken', data.access_token);

        // Redirect to the dashboard after a slight delay
        setTimeout(() => {
          window.location.href = '/dashboard'; // Redirect to the dashboard route
        }, 1500);
      } else {
        setMessage(data.detail || 'Invalid username or password'); // Error message from backend
      }
    } catch (error) {
      setMessage('Error: ' + error.message); // Show any error messages
    }

    setIsLoading(false); // Hide the loading indicator
  };

  // Forgot password handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!forgotEmail) {
      setMessage('Please enter your email address');
      return;
    }

    if (!isValidEmail(forgotEmail)) {
      setMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setMessage(''); // Clear any previous messages

    try {
      // Send a request to the backend to initiate password reset
      const response = await fetch('http://localhost:8000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await response.json();
      setMessage(data.message); // Show message based on the response from the backend
    } catch (error) {
      setMessage('Error: ' + error.message); // Show any error messages
    } finally {
      setIsLoading(false);
    }
  };

  // Close forgot password modal
  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setMessage('');
    setForgotEmail('');
  };

  // Validate email format
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  // Eye icon components
  const EyeOpenIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const EyeClosedIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.94 17.94C16.2306 19.243 14.1491 19.9649 12 20C5 20 1 12 1 12C2.24389 9.68192 3.96914 7.65663 6.06 6.06M9.9 4.24C10.5883 4.0789 11.2931 3.99836 12 4C19 4 23 12 23 12C22.393 13.1356 21.6691 14.2048 20.84 15.19M14.12 14.12C13.8454 14.4148 13.5141 14.6512 13.1462 14.8151C12.7782 14.9791 12.3809 15.0673 11.9781 15.0744C11.5753 15.0815 11.1752 15.0074 10.8016 14.8565C10.4281 14.7056 10.0887 14.4811 9.80385 14.1962C9.51897 13.9113 9.29439 13.5719 9.14351 13.1984C8.99262 12.8248 8.91853 12.4247 8.92563 12.0219C8.93274 11.6191 9.02091 11.2218 9.18488 10.8538C9.34884 10.4858 9.58525 10.1546 9.88 9.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 1L23 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="logo">
          <h1 className="logo-text">MEAMS</h1>
        </div>

        {/* Wrap login inputs and button in a form for Enter key submission */}
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="login-input"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="input-group">
            <div className="input-wrapper">
              <svg className="input-icon" width="20" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
                <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <input
                type={passwordVisible ? "text" : "password"}  // Toggle between text and password field
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}  // Toggle visibility when clicked
                className="password-toggle"
                disabled={isLoading}
                aria-label={passwordVisible ? "Hide password" : "Show password"}
              >
                {passwordVisible ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </div>

          {/* Message for login errors/success */}
          {message && !showForgotPassword && ( // Only show if not in forgot password modal
            <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="forgot-password">
          <button
            onClick={() => { setShowForgotPassword(true); setMessage(''); }} // Clear message when opening forgot password
            className="forgot-link"
          >
            Forgot password?
          </button>
        </div>
      </div>

      {/* Forgot Password Overlay */}
      {showForgotPassword && (
        <div className="overlay">
          <div className="forgot-modal">
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="close-btn" onClick={closeForgotPassword}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <p className="modal-description">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div className="input-group">
              <div className="input-wrapper">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="login-input"
                  disabled={isLoading}
                />
              </div>
            </div>

            {message && showForgotPassword && ( // Only show if in forgot password modal
              <div className={`message ${message.includes('sent') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}

            <button
              onClick={handleForgotPassword}
              className="reset-button"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
