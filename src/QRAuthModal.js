import React, { useState } from 'react';

/**
 * QRAuthModal - Authentication overlay for QR code scanning
 * Two-step authentication: Email validation → Password verification
 */
function QRAuthModal({ isOpen, onClose, onAuthenticated, itemType = "equipment" }) {
  const [step, setStep] = useState(1); // 1 = email, 2 = password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'https://meams.onrender.com';

  const handleEmailSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.exists) {
        setStep(2); // Move to password step
      } else {
        setError('Email not found in the system');
      }
    } catch (err) {
      setError('Failed to verify email. Please try again.');
      console.error('Email check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/verify-qr-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ QR authentication successful:', data.user);
        onAuthenticated(data.access_token, data.user);
        handleClose();
      } else {
        setError(data.detail || 'Invalid password');
      }
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('403')) {
        setError('Invalid password');
      } else {
        setError('Authentication failed. Please try again.');
      }
      console.error('Password verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setEmail('');
    setPassword('');
    setError('');
    setShowPassword(false);
    onClose();
  };

  const handleBack = () => {
    setStep(1);
    setPassword('');
    setError('');
  };

  // Handle Enter key press
  const handleKeyPress = (e, submitFunc) => {
    if (e.key === 'Enter') {
      submitFunc(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="qr-auth-overlay"
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="qr-auth-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '450px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '64px', marginBottom: '15px' }}>
            {step === 1 ? '🔐' : '🔑'}
          </div>
          <h2 style={{ 
            color: 'white', 
            margin: '0 0 10px 0',
            fontSize: '28px',
            fontWeight: '700'
          }}>
            QR Authentication
          </h2>
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.8)', 
            margin: 0,
            fontSize: '14px'
          }}>
            {step === 1 
              ? `Scan to view ${itemType} information` 
              : 'Enter your password to continue'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Step 1: Email Input */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleEmailSubmit)}
                placeholder="Enter your email"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.border = '2px solid white';
                  e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                }}
                onBlur={(e) => {
                  e.target.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleClose}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  border: '2px solid white',
                  background: 'transparent',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: loading ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEmailSubmit}
                disabled={loading || !email}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: loading ? '#9ca3af' : 'white',
                  color: '#667eea',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  transform: 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  if (!loading && email) {
                    e.target.style.transform = 'scale(1.05)';
                    e.target.style.boxShadow = '0 8px 20px rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                {loading ? 'Verifying...' : 'Next →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Password Input */}
        {step === 2 && (
          <div>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '12px',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 8L10.89 13.26C11.22 13.47 11.6 13.59 12 13.59C12.4 13.59 12.78 13.47 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ 
                color: 'white', 
                fontSize: '14px',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {email}
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handlePasswordSubmit)}
                  placeholder="Enter your password"
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '14px',
                    paddingRight: '50px',
                    borderRadius: '10px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: 'white',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '2px solid white';
                    e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'white',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleBack}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  border: '2px solid white',
                  background: 'transparent',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: loading ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                ← Back
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={loading || !password}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: loading ? '#9ca3af' : 'white',
                  color: '#667eea',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  transform: 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  if (!loading && password) {
                    e.target.style.transform = 'scale(1.05)';
                    e.target.style.boxShadow = '0 8px 20px rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                {loading ? 'Authenticating...' : 'Authenticate ✓'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '25px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          textAlign: 'center'
        }}>
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.7)', 
            fontSize: '12px',
            margin: 0
          }}>
            🔒 Secure QR code authentication
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px); 
          }
          to { 
            opacity: 1;
            transform: translateY(0); 
          }
        }

        .qr-auth-overlay input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}

export default QRAuthModal;
