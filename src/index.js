import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import ResetPasswordPage from './ResetPassword';
import MainLayout from './MainLayout'; // Import the new MainLayout component
import DashboardPage from './DashboardPage';
import SuppliesPage from './SuppliesPage';
import EquipmentPage from './EquipmentPage';
import LogsPage from './LogsPage'; // Import new LogsPage
import ManageAccountsPage from './ManageAccountsPage'; // Import new ManageAccountsPage
import SettingsPage from './SettingsPage'; // Import the new SettingsPage
import AdminLogin from './AdminLogin';
import AdministratorPage from './AdministratorPage';

// Helper function to check if token exists and is valid
function isValidToken(token) {
  if (!token) return false;
  
  // Add any additional token validation logic here
  // For example, check if token is expired, properly formatted, etc.
  try {
    // Basic validation - ensure it's not just an empty string or null
    return token.trim().length > 0;
  } catch (error) {
    return false;
  }
}

function App() {
  // Get tokens from localStorage
  const authToken = localStorage.getItem('authToken');
  const adminToken = localStorage.getItem('adminToken');
  
  // Validate tokens
  const isAuthValid = isValidToken(authToken);
  const isAdminValid = isValidToken(adminToken);
  
  // Clean up invalid tokens
  if (authToken && !isAuthValid) {
    localStorage.removeItem('authToken');
  }
  if (adminToken && !isAdminValid) {
    localStorage.removeItem('adminToken');
  }

  return (
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          {/* Standalone Routes (Not Protected) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* Protected Routes using MainLayout */}
          <Route element={isAuthValid ? <MainLayout /> : <Navigate to="/login" replace />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/supplies" element={<SuppliesPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/manage-accounts" element={<ManageAccountsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={isAdminValid ? <MainLayout /> : <Navigate to="/admin-login" replace />}>
            <Route path="/administrator" element={<AdministratorPage />} />
          </Route>

          {/* Default Route: Redirect based on valid tokens */}
          <Route
            path="/"
            element={
              isAdminValid ? <Navigate to="/administrator" replace /> :
              isAuthValid ? <Navigate to="/dashboard" replace /> : 
              <Navigate to="/login" replace />
            }
          />
          
          {/* Fallback for any unmatched routes */}
          <Route path="*" element={
            isAdminValid ? <Navigate to="/administrator" replace /> :
            isAuthValid ? <Navigate to="/dashboard" replace /> : 
            <Navigate to="/login" replace />
          } />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
