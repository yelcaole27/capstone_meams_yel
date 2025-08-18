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

// Helper function to check if token exists, is valid, and get role
function isValidToken(token) {
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload && payload.role) {
      return payload.role;
    }
    return false;
  } catch (error) {
    return false;
  }
}

function App() {
  // Get tokens from localStorage
  const authToken = localStorage.getItem('authToken');
  const adminToken = localStorage.getItem('adminToken');
  
  // Validate tokens and retrieve the role
  const userRole = isValidToken(authToken);
  const isAdminRole = userRole === 'admin';
  const isStaffRole = userRole === 'staff';

  // Clean up invalid tokens
  if (authToken && !userRole) {
    localStorage.removeItem('authToken');
  }
  if (adminToken && !isAdminRole) {
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
          <Route element={isAdminRole || isStaffRole ? <MainLayout /> : <Navigate to="/login" replace />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/supplies" element={<SuppliesPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            {/* Only Staff and Admin have access to these */}
            {isAdminRole || isStaffRole ? (
              <>
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/manage-accounts" element={<ManageAccountsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </>
            ) : null}
          </Route>

          {/* Admin Protected Routes */}
          <Route element={isAdminRole ? <MainLayout /> : <Navigate to="/admin-login" replace />}>
            <Route path="/administrator" element={<AdministratorPage />} />
          </Route>

          {/* Default Route: Redirect based on valid tokens */}
          <Route
            path="/"
            element={
              isAdminRole ? <Navigate to="/administrator" replace /> :
              isStaffRole ? <Navigate to="/dashboard" replace /> : 
              <Navigate to="/login" replace />
            }
          />
          
          {/* Fallback for any unmatched routes */}
          <Route path="*" element={
            isAdminRole ? <Navigate to="/administrator" replace /> :
            isStaffRole ? <Navigate to="/dashboard" replace /> : 
            <Navigate to="/login" replace />
          } />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
