import React, { useState, useEffect } from 'react';
import { AlertCircle, BarChart3, Building2, CheckCircle2, ClipboardList, Clock3, Package, ShoppingCart, TrendingUp, Users, Wrench } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    totalRevenue: 0,
    activeRepairs: 0
  });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [repairJobs, setRepairJobs] = useState([]);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/dashboard', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Dashboard data unavailable')))
      .then(data => setStats(current => ({ ...current, ...data })))
      .catch(err => console.error(err));
    fetch('http://localhost:5000/api/purchase-orders', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setPurchaseOrders(data))
      .catch(err => console.error(err));
    fetch('http://localhost:5000/api/jobCards', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(setRepairJobs)
      .catch(err => console.error(err));
    fetch('http://localhost:5000/api/sales', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(setSales)
      .catch(err => console.error(err));
  }, []);

  const completedRepairs = repairJobs.filter(job => ['COMPLETED', 'Completed'].includes(job.status)).length;
  const pendingOrders = purchaseOrders.filter(order => !['Received', 'Rejected'].includes(order.status)).length;
  const monthlySales = sales.slice(-6);
  const maxSale = Math.max(...monthlySales.map(sale => Number(sale.total || 0)), 1);
  const technicianWorkload = ['Technician 1', 'Technician 2'].map(name => ({ name, count: repairJobs.filter(job => job.technician?.name === name).length }));

  return (
    <div>
      <div className="dashboard-heading"><div><p className="eyebrow"><TrendingUp size={15} /> Live business overview</p><h3>Business Dashboard</h3><p className="page-subtitle">A quick view of workshop performance, stock health, and daily operations.</p></div><span className="dashboard-date"><Clock3 size={15} /> Updated today</span></div>
      <div className="flex gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
        
        <div className="card" style={{ flex: '1 1 200px' }}>
          <div className="flex align-center gap-4 mb-2">
            <div style={{ background: 'rgba(59,130,246,0.2)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--primary)' }}>
              <ShoppingCart size={24} />
            </div>
            <h4 style={{ color: 'var(--text-muted)' }}>Revenue</h4>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>Rs. {Number(stats.totalRevenue || 0).toLocaleString()}</div>
        </div>

        <div className="card" style={{ flex: '1 1 200px' }}>
          <div className="flex align-center gap-4 mb-2">
            <div style={{ background: 'rgba(16,185,129,0.2)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--success)' }}>
              <Package size={24} />
            </div>
            <h4 style={{ color: 'var(--text-muted)' }}>Products in Stock</h4>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalProducts}</div>
        </div>

        <div className="card" style={{ flex: '1 1 200px' }}>
          <div className="flex align-center gap-4 mb-2">
            <div style={{ background: 'rgba(245,158,11,0.2)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--warning)' }}>
              <Wrench size={24} />
            </div>
            <h4 style={{ color: 'var(--text-muted)' }}>Active Repairs</h4>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.activeRepairs}</div>
        </div>

        <div className="card" style={{ flex: '1 1 200px', borderLeft: stats.lowStockCount > 0 ? '4px solid var(--danger)' : '' }}>
          <div className="flex align-center gap-4 mb-2">
            <div style={{ background: 'rgba(239,68,68,0.2)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--danger)' }}>
              <AlertCircle size={24} />
            </div>
            <h4 style={{ color: 'var(--text-muted)' }}>Low Stock Items</h4>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: stats.lowStockCount > 0 ? 'var(--danger)' : '' }}>
            {stats.lowStockCount}
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 200px' }}>
          <div className="flex align-center gap-4 mb-2"><div className="kpi-icon kpi-icon-blue"><ClipboardList size={24} /></div><h4 style={{ color: 'var(--text-muted)' }}>Pending Orders</h4></div>
          <div className="kpi-value">{pendingOrders}</div><span className="kpi-footnote">Awaiting delivery or receipt</span>
        </div>
        <div className="card" style={{ flex: '1 1 200px' }}>
          <div className="flex align-center gap-4 mb-2"><div className="kpi-icon kpi-icon-green"><CheckCircle2 size={24} /></div><h4 style={{ color: 'var(--text-muted)' }}>Completed Repairs</h4></div>
          <div className="kpi-value">{completedRepairs}</div><span className="kpi-footnote">Jobs closed successfully</span>
        </div>

      </div>

      <div className="dashboard-chart-grid">
        <section className="card dashboard-chart-card"><div className="chart-heading"><div><p className="eyebrow"><BarChart3 size={15} /> Revenue trend</p><h4>Recent sales performance</h4></div><span className="chart-total">Rs. {Number(stats.totalRevenue || 0).toLocaleString()}</span></div><div className="sales-chart">{monthlySales.length ? monthlySales.map((sale, index) => <div className="sales-bar-wrap" key={sale._id || index}><div className="sales-bar" style={{ height: `${Math.max((Number(sale.total || 0) / maxSale) * 100, 8)}%` }} title={`Rs. ${Number(sale.total || 0).toLocaleString()}`} /><span>{new Date(sale.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>) : <p className="empty-state">Sales will appear here after the first invoice.</p>}</div></section>
        <section className="card dashboard-chart-card"><div className="chart-heading"><div><p className="eyebrow"><Users size={15} /> Team capacity</p><h4>Technician workload</h4></div></div><div className="workload-list">{technicianWorkload.map(technician => <div className="workload-row" key={technician.name}><div><span>{technician.name}</span><strong>{technician.count} jobs</strong></div><div className="workload-track"><i style={{ width: `${Math.min(technician.count * 18, 100)}%` }} /></div></div>)}</div><div className="stock-health"><span><Package size={15} /> Stock health</span><strong>{Math.max(stats.totalProducts - stats.lowStockCount, 0)} healthy items</strong></div></section>
      </div>

      <div className="card">
        <h4 className="mb-4">Quick Actions</h4>
        <div className="flex gap-4">
          <a href="/inventory" className="btn btn-primary" style={{ textDecoration: 'none' }}>Go to Inventory</a>
          <a href="/sales" className="btn btn-primary" style={{ textDecoration: 'none' }}>New Sale</a>
          <a href="/repairs" className="btn btn-primary" style={{ textDecoration: 'none' }}>Manage Repairs</a>
          <a href="/suppliers" className="btn btn-primary" style={{ textDecoration: 'none' }}><Building2 size={16} /> Manage Suppliers</a>
          <a href="/purchase-orders" className="btn btn-primary" style={{ textDecoration: 'none' }}><ClipboardList size={16} /> Create Purchase Order</a>
        </div>
      </div>
      <div className="card dashboard-orders-card">
        <div className="flex justify-between align-center mb-4"><div><h4>Recent Purchase Orders</h4><p className="page-subtitle">Orders shared with registered suppliers.</p></div><a href="/purchase-orders" className="btn btn-outline" style={{ textDecoration: 'none' }}>View all orders</a></div>
        {purchaseOrders.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No purchase orders created yet.</p> : <div className="table-container"><table><thead><tr><th>PO ID</th><th>Supplier</th><th>Amount</th><th>Status</th></tr></thead><tbody>{purchaseOrders.slice(0, 5).map(order => <tr key={order._id}><td><strong>{order.orderNumber}</strong></td><td>{order.supplier?.name || 'Unknown supplier'}</td><td>Rs. {Number(order.total).toLocaleString()}</td><td><span className={`status-badge ${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span></td></tr>)}</tbody></table></div>}
      </div>
      <div className="card dashboard-orders-card">
        <div className="flex justify-between align-center mb-4"><div><h4>Repair Operations</h4><p className="page-subtitle">Active jobs, completed service history, and technician workload.</p></div><a href="/repairs" className="btn btn-outline" style={{ textDecoration: 'none' }}>Open job cards</a></div>
        <div className="dashboard-repair-summary"><div><span>Active repairs</span><strong>{repairJobs.filter(job => job.status !== 'COMPLETED').length}</strong></div><div><span>Completed</span><strong>{repairJobs.filter(job => job.status === 'COMPLETED').length}</strong></div>{['Technician 1', 'Technician 2'].map(name => <div key={name}><span>{name} workload</span><strong>{repairJobs.filter(job => job.technician?.name === name && job.status !== 'COMPLETED').length}</strong></div>)}</div>
        {repairJobs.length > 0 && <div className="table-container dashboard-repair-table"><table><thead><tr><th>Job Card</th><th>Customer</th><th>Vehicle</th><th>Technician</th><th>Status</th></tr></thead><tbody>{repairJobs.slice(0, 6).map(job => <tr key={job._id}><td><strong>{job.jobCardNumber}</strong></td><td>{job.customerName}</td><td>{job.vehicleMake || ''} {job.vehicleModel} · {job.registrationNumber || job.licensePlate}</td><td>{job.technician?.name || 'Unassigned'}</td><td><span className={`badge ${job.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`}>{job.status}</span></td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
};

export default Dashboard;
