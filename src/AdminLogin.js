import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Import the auth context
import './AdminLogin.css';

function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { adminLogin } = useAuth(); // Use the auth context

  // Helper function to create a fake but valid JWT token structure
  const createFakeJWT = (username, role = 'admin') => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    
    const payload = btoa(JSON.stringify({
      sub: username,
      role: role,
      iat: Math.floor(Date.now() / 1000), // Issued at
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Expires in 24 hours
    }));
    
    const signature = "fake_signature_for_demo";
    
    return `${header}.${payload}.${signature}`;
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    // Temporary admin credentials (replace with real authentication)
    if (username === 'admin' && password === 'admin123') {
      // Create a proper JWT-like token
      const fakeToken = createFakeJWT(username, 'admin');
      
      // Use the auth context login method
      adminLogin(fakeToken);
      
      navigate('/administrator');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-form">
        <h1 className="admin-login-title">MEAMS</h1>
        <h2 style={{color: '#ffffff', marginBottom: '30px'}}>ADMIN LOGIN</h2>
        
        <form onSubmit={handleLogin}>
          <div className="admin-login-input-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              className="admin-login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="admin-login-input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="admin-login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          {error && <p style={{color: '#ef4444', marginBottom: '15px'}}>{error}</p>}
          
          <button type="submit" className="admin-login-button">Login</button>
        </form>
        
        <a href="#forgot-password" className="forgot-password-link">Forgot password?</a>
      </div>
    </div>
  );
}

export default AdminLogin;

