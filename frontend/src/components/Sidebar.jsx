import React from 'react';
import { NavLink } from 'react-router-dom';
import { Building2, ClipboardList, LayoutDashboard, Package, ShoppingCart, Wrench, Users, UserRoundCog } from 'lucide-react';
import BrandLogo from './BrandLogo';

const Sidebar = () => {

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Inventory', path: '/admin/inventory', icon: Package },
    { name: 'Sales & Billing', path: '/admin/sales', icon: ShoppingCart },
    { name: 'Repairs', path: '/admin/repairs', icon: Wrench },
    { name: 'Customers', path: '/admin/customers', icon: Users },
    { name: 'Technician Profiles', path: '/admin/technician-profiles', icon: UserRoundCog },
    { name: 'Suppliers', path: '/admin/suppliers', icon: Building2 },
    { name: 'Purchase Orders', path: '/admin/purchase-orders', icon: ClipboardList },
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
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        {navItems.map((item, index) => (
          <NavLink
            key={item.name}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 0,
              borderBottom: index < navItems.length - 1 ? '1px solid var(--border)' : 'none',
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
