// index.js - Update your existing index.js file
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './LoginPage';
import ResetPasswordPage from './ResetPassword';
import MainLayout from './MainLayout';
import DashboardPage from './DashboardPage';
import SuppliesPage from './SuppliesPage';
import EquipmentPage from './EquipmentPage';
import LogsPage from './LogsPage';
import ManageAccountsPage from './ManageAccountsPage';
import SettingsPage from './SettingsPage';
import AdminLogin from './AdminLogin';
import StaffLayout from './StaffLayout'; 

// Protected Route Component
const ProtectedRoute = ({ children, requireAuth = false, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or your loading component
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function AppRoutes() {
  const { isAuthenticated, isAdmin, isStaff, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or your loading component
  }

  return (
    <Routes>
      {/* Standalone Routes (Not Protected) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin-login" element={<AdminLogin />} />

      {/* Admin Protected Routes using MainLayout */}
      {isAdmin && (
        <Route element={
          <ProtectedRoute requireAdmin={true}>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/supplies" element={<SuppliesPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/manage-accounts" element={<ManageAccountsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      )}

      {/* Staff Protected Routes using StaffLayout */}
      {isStaff && (
        <Route element={
          <ProtectedRoute requireAuth={true}>
            <StaffLayout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/supplies" element={<SuppliesPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      )}

      {/* Default Route */}
      <Route
        path="/"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : 
          <Navigate to="/login" replace />
        }
      />
      
      {/* Fallback for any unmatched routes */}
      <Route path="*" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : 
        <Navigate to="/login" replace />
      } />
    </Routes>
  );
}

function App() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);