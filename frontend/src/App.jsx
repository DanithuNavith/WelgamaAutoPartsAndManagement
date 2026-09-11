import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Repairs from './pages/Repairs';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Home from './pages/Home';
import Login from './pages/Login';
import CustomerDashboard from './pages/CustomerDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import Suppliers from './pages/Suppliers';
import SupplierDashboard from './pages/SupplierDashboard';
import PurchaseOrders from './pages/PurchaseOrders';
import { Moon, Sun } from 'lucide-react';

const ThemeSwitch = () => {
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('theme-dark'));

  useEffect(() => {
    const syncTheme = () => setIsDark(document.body.classList.contains('theme-dark'));
    window.addEventListener('welgama-theme-change', syncTheme);
    return () => window.removeEventListener('welgama-theme-change', syncTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    document.body.classList.toggle('theme-dark', nextTheme === 'dark');
    localStorage.setItem('welgama-theme', nextTheme);
    setIsDark(nextTheme === 'dark');
    window.dispatchEvent(new CustomEvent('welgama-theme-change'));
  };

  return <button className="top-theme-switch" onClick={toggleTheme} title={`Switch to ${isDark ? 'light' : 'dark'} theme`}><span>{isDark ? <Sun size={16} /> : <Moon size={16} />}</span>{isDark ? 'Light mode' : 'Dark mode'}</button>;
};

// Protected Route wrapper
const ProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const user = localStorage.getItem('user') || sessionStorage.getItem('user');

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  let parsed;
  try {
    parsed = JSON.parse(user);
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(parsed.role)) {
    // Redirect to their own dashboard
    switch (parsed.role) {
      case 'Owner': return <Navigate to="/admin/dashboard" replace />;
      case 'Customer': return <Navigate to="/customer/dashboard" replace />;
      case 'Technician': return <Navigate to="/technician/dashboard" replace />;
      case 'Supplier': return <Navigate to="/supplier/dashboard" replace />;
      default: return <Navigate to="/login" replace />;
    }
  }

  return children || <Outlet />;
};

// Admin layout with sidebar (for Owner role)
const AdminLayout = () => {
  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="admin-main" style={{ flex: 1, padding: '2rem', marginLeft: '250px' }}>
        <header className="admin-topbar mb-6 flex justify-between align-center">
          <div><p className="topbar-kicker">OPERATIONS CENTER</p><h2>Welgama Auto Parts</h2></div>
          <div className="topbar-actions">
            <ThemeSwitch />
            <div className="topbar-user"><span className="user-avatar">{user?.name?.charAt(0) || 'W'}</span><span>{user?.name || 'Owner'}</span></div>
            <button onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              sessionStorage.removeItem('token');
              sessionStorage.removeItem('user');
              window.location.href = '/login';
            }} className="topbar-logout">Logout</button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/supplier/login" element={<Login />} />

        {/* Owner / Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['Owner']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales" element={<Sales />} />
          <Route path="repairs" element={<Repairs />} />
          <Route path="customers" element={<Customers />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="purchase-orders" element={<PurchaseOrders />} />
        </Route>

        {/* Customer Routes */}
        <Route path="/customer/dashboard" element={
          <ProtectedRoute allowedRoles={['Customer']}>
            <CustomerDashboard />
          </ProtectedRoute>
        } />

        {/* Technician Routes */}
        <Route path="/technician/dashboard" element={
          <ProtectedRoute allowedRoles={['Technician']}>
            <TechnicianDashboard />
          </ProtectedRoute>
        } />

        <Route path="/supplier/dashboard" element={
          <ProtectedRoute allowedRoles={['Supplier']}>
            <SupplierDashboard />
          </ProtectedRoute>
        } />

        {/* Legacy redirects for old paths */}
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/inventory" element={<Navigate to="/admin/inventory" replace />} />
        <Route path="/sales" element={<Navigate to="/admin/sales" replace />} />
        <Route path="/repairs" element={<Navigate to="/admin/repairs" replace />} />
        <Route path="/customers" element={<Navigate to="/admin/customers" replace />} />
        <Route path="/suppliers" element={<Navigate to="/admin/suppliers" replace />} />
        <Route path="/purchase-orders" element={<Navigate to="/admin/purchase-orders" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
