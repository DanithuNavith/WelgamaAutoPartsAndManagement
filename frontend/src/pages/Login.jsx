import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, ShieldCheck, Wrench, Building2, Eye, EyeOff, ArrowLeft, Settings, Loader2 } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { API_BASE_URL } from '../services/apiBase';


const roles = [
  { key: 'Owner', label: 'Owner', icon: ShieldCheck, color: '#8b5cf6', desc: 'Full system access & management' },
  { key: 'Customer', label: 'Customer', icon: User, color: '#3b82f6', desc: 'Track repairs & browse parts' },
  { key: 'Technician', label: 'Technician', icon: Wrench, color: '#10b981', desc: 'Manage assigned jobs & repairs' },
  { key: 'Supplier', label: 'Supplier', icon: Building2, color: '#f59e0b', desc: 'View your orders & deliveries' }
];

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');

  const [isRegister, setIsRegister] = useState(searchParams.get('tab') === 'register' && location.pathname !== '/supplier/login');
  const [selectedRole, setSelectedRole] = useState(
    roles.some(role => role.key === requestedRole)
      ? requestedRole
      : location.pathname === '/supplier/login' ? 'Supplier' : 'Customer'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  useEffect(() => {
    // If already logged in, redirect
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const user = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (token && user) {
      const parsed = JSON.parse(user);
      redirectByRole(parsed.role);
    }
  }, []);

  const redirectByRole = (role) => {
    switch (role) {
      case 'Owner': navigate('/admin/dashboard'); break;
      case 'Customer': navigate('/customer/dashboard'); break;
      case 'Technician': navigate('/technician/dashboard'); break;
      case 'Supplier': navigate('/supplier/dashboard'); break;
      default: navigate('/');
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister
        ? { ...form, role: selectedRole }
        : { email: form.email, password: form.password, role: selectedRole };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      const returnTo = searchParams.get('returnTo');
      const safeOwnerReturnTo = returnTo?.startsWith('/admin/') && !returnTo.includes('..')
        ? returnTo
        : null;
      if (safeOwnerReturnTo && data.user.role !== 'Owner') {
        throw new Error('This management page requires an Owner account. Select Owner and sign in again.');
      }

      // Store token and user info
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', data.token);
      storage.setItem('user', JSON.stringify(data.user));

      setSuccess(data.message);

      // Redirect after short delay
      setTimeout(() => {
        if (data.user.role === 'Owner' && safeOwnerReturnTo) {
          navigate(safeOwnerReturnTo, { replace: true });
          return;
        }
        redirectByRole(data.user.role);
      }, 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeRoleData = roles.find(r => r.key === selectedRole);

  return (
    <div className="login-page" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0e1a', padding: '2rem', position: 'relative', overflow: 'hidden'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-30%', left: '-20%', width: '700px', height: '700px',
        borderRadius: '50%', background: `radial-gradient(circle, ${activeRoleData.color}10 0%, transparent 70%)`,
        transition: 'background 0.6s ease', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', right: '-20%', width: '600px', height: '600px',
        borderRadius: '50%', background: `radial-gradient(circle, ${activeRoleData.color}08 0%, transparent 70%)`,
        transition: 'background 0.6s ease', pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1,
        animation: 'fadeInUp 0.6s ease-out'
      }}>
        {/* Back to Home */}
        <button onClick={() => navigate('/')} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
          fontSize: '0.85rem', marginBottom: '2rem', padding: 0,
          transition: 'color 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.color = '#f8fafc'}
        onMouseOut={e => e.currentTarget.style.color = '#64748b'}
        >
          <ArrowLeft size={16} /> Back to Home
        </button>

        {/* Logo */}
        <div style={{ marginBottom: '2rem' }}>
          <BrandLogo width={125} style={{ height: 'auto' }} />
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem',
          padding: '2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {isRegister ? 'Register to get started' : 'Sign in to your account'}
          </p>

          {/* Role Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.5rem', display: 'block' }}>
              Login as
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isRegister ? 3 : 4}, 1fr)`, gap: '0.5rem' }}>
              {roles.filter(role => !isRegister || role.key !== 'Supplier').map(role => (
                <button key={role.key} onClick={() => setSelectedRole(role.key)} style={{
                  padding: '0.75rem 0.5rem', borderRadius: '12px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                  background: selectedRole === role.key ? `${role.color}15` : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${selectedRole === role.key ? `${role.color}40` : 'rgba(255,255,255,0.06)'}`,
                  color: selectedRole === role.key ? role.color : '#64748b',
                  transition: 'all 0.3s ease', fontSize: '0.8rem', fontWeight: 500
                }}>
                  <role.icon size={20} />
                  {role.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.5rem', textAlign: 'center' }}>
              {activeRoleData.desc}
            </p>
          </div>

          {/* Error / Success messages */}
          {error && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5', fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
              color: '#6ee7b7', fontSize: '0.85rem'
            }}>
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isRegister && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.35rem', display: 'block' }}>Full Name</label>
                <input
                  type="text" name="name" value={form.name} onChange={handleChange}
                  placeholder="Enter your full name" required
                  style={{
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f8fafc', fontSize: '0.9rem', outline: 'none',
                    transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.target.style.borderColor = `${activeRoleData.color}50`; e.target.style.boxShadow = `0 0 0 3px ${activeRoleData.color}10`; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.35rem', display: 'block' }}>Email</label>
              <input
                type={isRegister || selectedRole === 'Supplier' ? 'email' : 'text'} name="email" value={form.email} onChange={handleChange}
                placeholder={selectedRole === 'Supplier' && !isRegister ? 'Enter your registered supplier email' : 'Enter your email'} required
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f8fafc', fontSize: '0.9rem', outline: 'none',
                  transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box'
                }}
                onFocus={e => { e.target.style.borderColor = `${activeRoleData.color}50`; e.target.style.boxShadow = `0 0 0 3px ${activeRoleData.color}10`; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.35rem', display: 'block' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="Enter your password" required
                  style={{
                    width: '100%', padding: '0.75rem 3rem 0.75rem 1rem', borderRadius: '10px',
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f8fafc', fontSize: '0.9rem', outline: 'none',
                    transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.target.style.borderColor = `${activeRoleData.color}50`; e.target.style.boxShadow = `0 0 0 3px ${activeRoleData.color}10`; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                  padding: '0.25rem', display: 'flex'
                }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.35rem', display: 'block' }}>
                  Phone {selectedRole === 'Customer' ? '(Required)' : '(Optional)'}
                </label>
                <input
                  type="tel" name="phone" value={form.phone} onChange={handleChange}
                  placeholder={selectedRole === 'Customer' ? 'Enter your phone number' : 'Enter your phone number (optional)'}
                  required={selectedRole === 'Customer'}
                  style={{
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f8fafc', fontSize: '0.9rem', outline: 'none',
                    transition: 'border-color 0.3s, box-shadow 0.3s', boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.target.style.borderColor = `${activeRoleData.color}50`; e.target.style.boxShadow = `0 0 0 3px ${activeRoleData.color}10`; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              padding: '0.85rem', borderRadius: '12px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: `linear-gradient(135deg, ${activeRoleData.color}, ${activeRoleData.color}cc)`,
              color: '#fff', fontSize: '0.95rem', fontWeight: 600,
              boxShadow: `0 8px 25px ${activeRoleData.color}30`,
              transition: 'all 0.3s ease', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              marginTop: '0.5rem'
            }}
            onMouseOver={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 12px 35px ${activeRoleData.color}40`; }}}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 25px ${activeRoleData.color}30`; }}
            >
              {loading && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {!isRegister && <div className="login-options"><label><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Remember me</label><button type="button" onClick={() => setSuccess('If an account exists for this email, password reset instructions will be sent.')}>Forgot password?</button></div>}

          {/* Toggle Login/Register */}
          {selectedRole === 'Supplier' && !isRegister ? <p className="supplier-login-help">Supplier accounts are created by the owner. Sign in with the registered email address and password the owner provided.</p> : <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { const nextIsRegister = !isRegister; setIsRegister(nextIsRegister); if (nextIsRegister && selectedRole === 'Supplier') setSelectedRole('Customer'); setError(''); setSuccess(''); }} style={{
              background: 'none', border: 'none', color: activeRoleData.color,
              cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              transition: 'opacity 0.2s'
            }}>
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>}
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
