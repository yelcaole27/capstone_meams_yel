import React, { useState } from 'react';
import './LoginPage.css';

// Email service configuration (still here for potential future backend integration)
const EMAIL_API_CONFIG = {
  resetPasswordEndpoint: '/api/auth/forgot-password',
  emailJSConfig: {
    serviceID: 'your_service_id',
    templateID: 'your_template_id',
    publicKey: 'your_public_key'
  }
};

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(''); // This will now handle login messages as well

  // --- Temporary Login Credentials ---
  const TEMP_USERNAME = 'admin';
  const TEMP_PASSWORD = 'password123';
  // --- End Temporary Login Credentials ---

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent default form submission to handle it with React
    setMessage(''); // Clear any previous messages
    setIsLoading(true); // Start loading state

    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay

    // --- Simulate Login without a Backend ---
    if (username === TEMP_USERNAME && password === TEMP_PASSWORD) {
      setMessage('Login successful! Redirecting to dashboard...');
      localStorage.setItem('authToken', 'temp_admin_token'); // Simulate a token
      setTimeout(() => {
        window.location.href = '/dashboard'; // Redirect to a dashboard route
      }, 1500); // Wait a bit longer for message to be seen
    } else {
      setMessage('Invalid username or password.'); // Set error message for wrong credentials
    }
    setIsLoading(false); // End loading state
    // --- End Simulate Login ---
  };

  // Method 1: Using your backend API (as it was)
  const sendResetEmailViaAPI = async (email) => {
    const response = await fetch(EMAIL_API_CONFIG.resetPasswordEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send reset email');
    }

    return await response.json();
  };

  // Method 2: Using EmailJS (client-side email service) (as it was, with simulation)
  const sendResetEmailViaEmailJS = async (email) => {
    const resetToken = generateResetToken();
    const resetLink = `${window.location.origin}/reset-password?token=${resetToken}`;

    const templateParams = {
      to_email: email,
      reset_link: resetLink,
      app_name: 'MEAMS',
      expiry_time: '1 hour'
    };

    console.log('Email would be sent to:', email, 'with link:', resetLink);
    return { status: 200 };
  };

  // Generate a secure reset token (simplified version)
  const generateResetToken = () => {
    return btoa(Date.now() + Math.random().toString(36)).replace(/[^a-zA-Z0-9]/g, '');
  };

  // Validate email format
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

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
    setMessage('');

    try {
      // For frontend only, we'll use the EmailJS simulation for forgot password
      await sendResetEmailViaEmailJS(forgotEmail);

      setMessage('Reset link sent to your email! Please check your inbox.');

      setTimeout(() => {
        setShowForgotPassword(false);
        setMessage('');
        setForgotEmail('');
      }, 3000);

    } catch (error) {
      setMessage(error.message || 'Failed to send reset email. Please try again.');
      console.error('Forgot password error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setMessage('');
    setForgotEmail('');
  };

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
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                disabled={isLoading}
              />
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
