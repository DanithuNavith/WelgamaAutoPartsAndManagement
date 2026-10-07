import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import BrandLogo from './components/BrandLogo';
import { Moon, Sun } from 'lucide-react';
import { API_BASE_URL } from './services/apiBase';

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
  const location = useLocation();
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const user = localStorage.getItem('user') || sessionStorage.getItem('user');
  const [authCheck, setAuthCheck] = useState({ token: null, status: 'checking', error: '' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(async response => {
      if (cancelled) return;
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setAuthCheck({ token, status: 'unauthenticated', error: '' });
        return;
      }
      if (!response.ok) {
        setAuthCheck({ token, status: 'error', error: `Could not verify your sign-in (HTTP ${response.status}).` });
        return;
      }
      const verifiedUser = await response.json();
      if (!cancelled) setAuthCheck({ token, status: 'authenticated', error: '', user: verifiedUser });
    }).catch(() => {
      if (!cancelled) setAuthCheck({ token, status: 'error', error: 'Could not reach the sign-in service. Check that the server is running, then retry.' });
    });

    return () => {
      cancelled = true;
    };
  }, [token, retryCount]);

  if (!token || !user) {
    const requiredRole = allowedRoles?.length === 1 ? allowedRoles[0] : null;
    const returnTo = requiredRole === 'Owner' && location.pathname.startsWith('/admin/')
      ? `${location.pathname}${location.search}`
      : null;
    const query = new URLSearchParams();
    if (requiredRole) query.set('role', requiredRole);
    if (returnTo) query.set('returnTo', returnTo);
    return <Navigate to={`/login${query.size ? `?${query.toString()}` : ''}`} replace />;
  }

  try {
    JSON.parse(user);
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  if (authCheck.token !== token || authCheck.status === 'checking') {
    return <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Checking your sign-in…</div>;
  }

  if (authCheck.status === 'error') {
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
        <p>{authCheck.error}</p>
        <button type="button" onClick={() => setRetryCount(count => count + 1)}>Retry</button>
      </div>
    );
  }

  const verifiedRole = authCheck.user?.role;
  if (allowedRoles && !allowedRoles.includes(verifiedRole)) {
    // Redirect to their own dashboard
    switch (verifiedRole) {
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
          <div><BrandLogo width={120} style={{ height: 'auto' }} /><p className="topbar-kicker">OPERATIONS CENTER</p></div>
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
