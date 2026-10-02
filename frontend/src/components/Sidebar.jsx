import React from 'react';
import { NavLink } from 'react-router-dom';
import { Building2, ClipboardList, LayoutDashboard, Package, ShoppingCart, Wrench, Users } from 'lucide-react';
import BrandLogo from './BrandLogo';

const Sidebar = () => {

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Inventory', path: '/inventory', icon: Package },
    { name: 'Sales & Billing', path: '/sales', icon: ShoppingCart },
    { name: 'Repairs', path: '/repairs', icon: Wrench },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Suppliers', path: '/suppliers', icon: Building2 },
    { name: 'Purchase Orders', path: '/purchase-orders', icon: ClipboardList },
  ];

  return (
    <aside style={{
      width: '250px',
      background: 'var(--bg-card)',
      backdropFilter: 'var(--glass-blur)',
      borderRight: '1px solid var(--border)',
      padding: '2rem 1rem',
      position: 'fixed',
      height: '100vh',
      left: 0,
      top: 0
    }}>
      <h1 className="mb-6" style={{ textAlign: 'center' }}>
        <BrandLogo width={125} style={{ height: 'auto', maxWidth: '100%' }} />
      </h1>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              color: isActive ? '#fff' : 'var(--text-muted)',
              background: isActive ? 'var(--primary)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s',
              fontWeight: 500
            })}
          >
            <item.icon size={20} />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
