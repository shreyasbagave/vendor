import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Signup from './pages/Signup';
import SidebarLayout from './components/SidebarLayout';
import ItemsPage from './pages/Items';
import SuppliersPage from './pages/Suppliers';
import CustomersPage from './pages/Customers';
import InwardPage from './pages/Inward';
import OutwardPage from './pages/Outward';
import ReportsPage from './pages/Reports';
import TransactionHistoryPage from './pages/TransactionHistory';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SidebarLayout onLogout={logout}>
                <Dashboard />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/items"
          element={
            <ProtectedRoute>
              <SidebarLayout onLogout={logout}>
                <ItemsPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <SidebarLayout onLogout={logout}>
                <SuppliersPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <SidebarLayout onLogout={logout}>
                <CustomersPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inward"
          element={
            <ProtectedRoute>
              <SidebarLayout onLogout={logout}>
                <InwardPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/outward"
          element={
            <ProtectedRoute>
              <SidebarLayout onLogout={logout}>
                <OutwardPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <SidebarLayout onLogout={logout}>
                <ReportsPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <SidebarLayout onLogout={logout}>
                <TransactionHistoryPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
