import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, BarChart3, Building2, CheckCircle2, ClipboardList,
  Clock3, Package, Plus, RefreshCw, ShoppingCart, TrendingUp, Users, Wrench
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';
const SALES_PERIODS = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '12m': { label: 'Last 12 months', months: 12 }
};

const fetchDashboardResource = async (resource, label, headers) => {
  const response = await fetch(`${API_BASE_URL}/${resource}`, { headers });
  if (!response.ok) throw new Error(`${label} could not be loaded.`);
  return response.json();
};

const fetchDashboardData = async () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [stats, purchaseOrders, repairJobs, sales, technicians] = await Promise.all([
    fetchDashboardResource('dashboard', 'Dashboard summary', headers),
    fetchDashboardResource('purchase-orders', 'Purchase orders', headers),
    fetchDashboardResource('jobCards', 'Repair jobs', headers),
    fetchDashboardResource('sales', 'Sales', headers),
    fetchDashboardResource('technicians', 'Technicians', headers)
  ]);
  if (![purchaseOrders, repairJobs, sales, technicians].every(Array.isArray)) {
    throw new Error('Dashboard data returned an unexpected format.');
  }
  return { stats: { ...stats, lowStockItems: stats.lowStockItems || [] }, purchaseOrders, repairJobs, sales, technicians };
};

const localStartOfDay = date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getSalesBuckets = (period, now) => {
  const settings = SALES_PERIODS[period];
  const start = localStartOfDay(now);
  const buckets = [];

  if (settings.months) {
    start.setDate(1);
    start.setMonth(start.getMonth() - (settings.months - 1));
    for (let index = 0; index < settings.months; index += 1) {
      const bucketStart = new Date(start);
      bucketStart.setMonth(start.getMonth() + index);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setMonth(bucketEnd.getMonth() + 1);
      bucketEnd.setMilliseconds(bucketEnd.getMilliseconds() - 1);
      buckets.push({
        start: bucketStart,
        end: bucketEnd,
        label: bucketStart.toLocaleDateString(undefined, { month: 'short' })
      });
    }
  } else {
    const bucketSize = settings.days === 30 ? 5 : 1;
    start.setDate(start.getDate() - (settings.days - 1));
    for (let index = 0; index < settings.days; index += bucketSize) {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + index);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + bucketSize);
      bucketEnd.setMilliseconds(bucketEnd.getMilliseconds() - 1);
      buckets.push({
        start: bucketStart,
        end: bucketEnd,
        label: settings.days === 7
          ? bucketStart.toLocaleDateString(undefined, { weekday: 'short' })
        : `${bucketStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}-${new Date(Math.min(bucketEnd.getTime(), now.getTime())).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      });
    }
  }

  return buckets;
};

const saleDate = sale => new Date(sale.createdAt);
const saleTotal = sale => Number(sale.total) || 0;
const isCompleted = job => String(job.status || '').toUpperCase() === 'COMPLETED';
const formatMoney = value => `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const Dashboard = () => {
  const [stats, setStats] = useState({ totalProducts: 0, lowStockCount: 0, totalRevenue: 0, activeRepairs: 0, lowStockItems: [] });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [repairJobs, setRepairJobs] = useState([]);
  const [sales, setSales] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [salesPeriod, setSalesPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const applyDashboardData = useCallback(data => {
    setStats(data.stats);
    setPurchaseOrders(data.purchaseOrders);
    setRepairJobs(data.repairJobs);
    setSales(data.sales);
    setTechnicians(data.technicians);
    const refreshedAt = new Date();
    setLastUpdated(refreshedAt);
    setCurrentTime(refreshedAt);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    fetchDashboardData()
      .then(data => {
        if (isCurrent) applyDashboardData(data);
      })
      .catch(err => {
        if (!isCurrent) return;
        console.error('Dashboard load failed:', err);
        setError(err.message || 'Dashboard data could not be loaded.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });
    return () => { isCurrent = false; };
  }, [applyDashboardData]);

  const retryDashboard = async () => {
    setRefreshing(true);
    setError('');
    try {
      applyDashboardData(await fetchDashboardData());
    } catch (err) {
      console.error('Dashboard refresh failed:', err);
      setError(err.message || 'Dashboard data could not be loaded.');
    } finally {
      setRefreshing(false);
    }
  };

  const now = currentTime;
  const revenueSummary = useMemo(() => {
    const todayStart = localStartOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const revenueBetween = (start, end) => sales.reduce((total, sale) => {
      const createdAt = saleDate(sale);
      return createdAt >= start && createdAt <= end ? total + saleTotal(sale) : total;
    }, 0);
    const settings = SALES_PERIODS[salesPeriod];
    let currentStart;
    let previousStart;

    if (settings.months) {
      currentStart = new Date(now.getFullYear(), now.getMonth() - (settings.months - 1), 1);
      previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - settings.months, 1);
    } else {
      currentStart = localStartOfDay(now);
      currentStart.setDate(currentStart.getDate() - (settings.days - 1));
      previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - settings.days);
    }

    const current = revenueBetween(currentStart, now);
    const previous = revenueBetween(previousStart, new Date(currentStart.getTime() - 1));
    const difference = previous ? ((current - previous) / previous) * 100 : null;
    const buckets = getSalesBuckets(salesPeriod, now).map(bucket => ({
      ...bucket,
      total: sales.reduce((total, sale) => {
        const createdAt = saleDate(sale);
        return createdAt >= bucket.start && createdAt <= bucket.end ? total + saleTotal(sale) : total;
      }, 0)
    }));

    return {
      today: revenueBetween(todayStart, now),
      month: revenueBetween(monthStart, now),
      year: revenueBetween(yearStart, now),
      current,
      previous,
      difference,
      buckets
    };
  }, [now, sales, salesPeriod]);

  const activeJobs = repairJobs.filter(job => !isCompleted(job));
  const completedRepairs = repairJobs.length - activeJobs.length;
  const pendingOrders = purchaseOrders.filter(order => !['RECEIVED', 'REJECTED'].includes(String(order.status || '').toUpperCase())).length;
  const technicianWorkload = technicians.map(technician => ({
    ...technician,
    activeCount: activeJobs.filter(job => String(job.technician?._id || job.technician || '') === String(technician._id)).length
  }));
  const unassignedCount = activeJobs.filter(job => !job.technician?._id && !job.technician).length;
  const maxWorkload = Math.max(...technicianWorkload.map(technician => technician.activeCount), 1);

  const attentionJobs = activeJobs
    .map(job => {
      const overdue = job.appointmentDate && new Date(job.appointmentDate) < now;
      const priority = String(job.priority || 'Medium').toLowerCase();
      const urgent = priority === 'urgent';
      const high = priority === 'high';
      const unassigned = !job.technician?._id && !job.technician;
      return { ...job, overdue, urgent, high, unassigned };
    })
    .filter(job => job.overdue || job.urgent || job.high || job.unassigned)
    .sort((left, right) => Number(right.urgent) - Number(left.urgent) || Number(right.overdue) - Number(left.overdue) || Number(right.high) - Number(left.high))
    .slice(0, 5);

  const maxSale = Math.max(...revenueSummary.buckets.map(bucket => bucket.total), 1);
  const comparisonText = revenueSummary.difference === null
    ? revenueSummary.current > 0 ? 'New revenue in this period' : 'No revenue in either period'
    : `${revenueSummary.difference > 0 ? '+' : ''}${revenueSummary.difference.toFixed(1)}% vs previous period`;

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow"><TrendingUp size={15} /> Live business overview</p>
          <h3>Business Dashboard</h3>
          <p className="page-subtitle">A quick view of workshop performance, stock health, and daily operations.</p>
        </div>
        <div className="dashboard-toolbar">
          <span className="dashboard-date"><Clock3 size={15} />{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not refreshed yet'}</span>
          <button className="btn btn-outline dashboard-refresh" type="button" onClick={retryDashboard} disabled={loading || refreshing}>
            <RefreshCw size={15} className={refreshing ? 'dashboard-spinning' : ''} />{refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="dashboard-error" role="alert"><AlertCircle size={17} /><span>{error}</span><button className="btn btn-outline" type="button" onClick={retryDashboard}>Try again</button></div>}
      {loading && <p className="dashboard-loading" role="status">Loading the latest business data...</p>}

      <div className="dashboard-kpi-grid">
        <div className="card dashboard-kpi"><div><span>Revenue today</span><ShoppingCart size={18} /></div><strong>{formatMoney(revenueSummary.today)}</strong><small>Recorded sales</small></div>
        <div className="card dashboard-kpi"><div><span>Revenue this month</span><TrendingUp size={18} /></div><strong>{formatMoney(revenueSummary.month)}</strong><small>Month to date</small></div>
        <div className="card dashboard-kpi"><div><span>Revenue this year</span><BarChart3 size={18} /></div><strong>{formatMoney(revenueSummary.year)}</strong><small>Year to date</small></div>
        <a href="/admin/inventory" className={`card dashboard-kpi dashboard-kpi-link ${stats.lowStockCount ? 'needs-attention' : ''}`}><div><span>Low-stock items</span><AlertCircle size={18} /></div><strong>{stats.lowStockCount || 0}</strong><small>{stats.totalProducts || 0} product types - View inventory <ArrowRight size={12} /></small></a>
        <a href="/admin/repairs" className="card dashboard-kpi dashboard-kpi-link"><div><span>Active repairs</span><Wrench size={18} /></div><strong>{activeJobs.length}</strong><small>{unassignedCount} unassigned - View jobs <ArrowRight size={12} /></small></a>
        <a href="/admin/purchase-orders" className="card dashboard-kpi dashboard-kpi-link"><div><span>Open purchase orders</span><ClipboardList size={18} /></div><strong>{pendingOrders}</strong><small>Awaiting delivery or receipt <ArrowRight size={12} /></small></a>
      </div>

      <div className="dashboard-chart-grid">
        <section className="card dashboard-chart-card">
          <div className="chart-heading dashboard-revenue-heading">
            <div><p className="eyebrow"><BarChart3 size={15} /> Revenue trend</p><h4>{SALES_PERIODS[salesPeriod].label}</h4></div>
            <div className="dashboard-period-select"><select aria-label="Revenue chart date range" className="input" value={salesPeriod} onChange={event => setSalesPeriod(event.target.value)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="12m">Last 12 months</option></select></div>
          </div>
          <div className="dashboard-revenue-summary"><strong>{formatMoney(revenueSummary.current)}</strong><span className={revenueSummary.difference > 0 ? 'positive' : revenueSummary.difference < 0 ? 'negative' : ''}>{comparisonText}</span></div>
          <div className={`sales-chart ${salesPeriod === '30d' ? 'sales-chart-compact' : ''}`} role="img" aria-label={`Revenue chart for ${SALES_PERIODS[salesPeriod].label}`}>
            {revenueSummary.buckets.map((bucket, index) => <div className="sales-bar-wrap" key={`${bucket.start.toISOString()}-${index}`} title={`${bucket.label}: ${formatMoney(bucket.total)}`}><div className="sales-bar" style={{ height: `${bucket.total ? Math.max((bucket.total / maxSale) * 100, 6) : 0}%` }} /><span>{bucket.label}</span></div>)}
          </div>
          {revenueSummary.buckets.every(bucket => bucket.total === 0) && <p className="dashboard-chart-empty">No recorded sales in this period.</p>}
        </section>

        <section className="card dashboard-chart-card">
          <div className="chart-heading"><div><p className="eyebrow"><Users size={15} /> Team capacity</p><h4>Active jobs by technician</h4></div></div>
          <div className="workload-list">
            {technicianWorkload.length ? technicianWorkload.map(technician => <div className="workload-row" key={technician._id}><div><span>{technician.name}</span><strong>{technician.activeCount} active jobs - {technician.status}</strong></div><div className="workload-track"><i style={{ width: `${(technician.activeCount / maxWorkload) * 100}%` }} /></div></div>) : <p className="dashboard-chart-empty">No technicians are configured.</p>}
          </div>
          <div className="stock-health"><span><Package size={15} /> Inventory</span><strong>{Math.max((stats.totalProducts || 0) - (stats.lowStockCount || 0), 0)} healthy product types</strong></div>
        </section>
      </div>

      <div className="dashboard-alert-grid">
        <section className="card dashboard-alert-card">
          <div className="dashboard-section-heading"><div><p className="eyebrow"><Package size={15} /> Stock health</p><h4>Parts to reorder</h4></div><a className="btn btn-outline" href="/admin/purchase-orders">Create order</a></div>
          {stats.lowStockItems?.length ? <div className="dashboard-alert-list">{stats.lowStockItems.map(product => <div className="dashboard-alert-row" key={product._id}><span><strong>{product.name}</strong><small>{product.category}</small></span><span className="dashboard-stock-quantity">{product.quantity} left <small>Alert at {product.lowStockThreshold ?? 5}</small></span></div>)}</div> : <p className="dashboard-clear-state"><CheckCircle2 size={16} /> All tracked parts are above their low-stock alerts.</p>}
          {stats.lowStockCount > (stats.lowStockItems?.length || 0) && <p className="dashboard-more-alerts">Showing {stats.lowStockItems.length} of {stats.lowStockCount} low-stock parts. <a href="/admin/inventory">View all</a></p>}
        </section>

        <section className="card dashboard-alert-card">
          <div className="dashboard-section-heading"><div><p className="eyebrow"><Wrench size={15} /> Needs attention</p><h4>Repair alerts</h4></div><a className="btn btn-outline" href="/admin/repairs">Open jobs</a></div>
          {attentionJobs.length ? <div className="dashboard-alert-list">{attentionJobs.map(job => <a className="dashboard-alert-row dashboard-job-alert" href="/admin/repairs" key={job._id}><span><strong>{job.jobCardNumber} - {job.customerName}</strong><small>{job.vehicleMake} {job.vehicleModel} - {job.issueDescription}</small></span><span className="dashboard-alert-tags">{job.urgent && <i className="urgent">Urgent</i>}{job.high && <i className="high">High priority</i>}{job.overdue && <i className="overdue">Overdue</i>}{job.unassigned && <i className="unassigned">Unassigned</i>}</span></a>)}</div> : <p className="dashboard-clear-state"><CheckCircle2 size={16} /> No urgent, overdue, or unassigned repairs.</p>}
        </section>
      </div>

      <section className="card dashboard-quick-actions">
        <div className="dashboard-section-heading"><div><p className="eyebrow">Shortcuts</p><h4>Quick actions</h4></div></div>
        <div className="dashboard-action-links">
          <a className="btn btn-primary" href="/admin/inventory?action=add"><Plus size={16} /> Add part</a>
          <a className="btn btn-primary" href="/admin/sales"><ShoppingCart size={16} /> New sale</a>
          <a className="btn btn-primary" href="/admin/repairs?action=new-job"><Wrench size={16} /> New repair job</a>
          <a className="btn btn-outline" href="/admin/inventory"><Package size={16} /> Inventory</a>
          <a className="btn btn-outline" href="/admin/suppliers"><Building2 size={16} /> Suppliers</a>
          <a className="btn btn-outline" href="/admin/purchase-orders"><ClipboardList size={16} /> Purchase orders</a>
        </div>
      </section>

      <section className="card dashboard-orders-card">
        <div className="dashboard-section-heading"><div><h4>Recent purchase orders</h4><p className="page-subtitle">Orders shared with registered suppliers.</p></div><a href="/admin/purchase-orders" className="btn btn-outline">View all orders</a></div>
        {purchaseOrders.length === 0 ? <p className="dashboard-table-empty">No purchase orders created yet.</p> : <div className="table-container"><table><thead><tr><th>PO ID</th><th>Supplier</th><th>Amount</th><th>Status</th></tr></thead><tbody>{purchaseOrders.slice(0, 5).map(order => <tr key={order._id}><td><strong>{order.orderNumber}</strong></td><td>{order.supplier?.name || 'Unknown supplier'}</td><td>{formatMoney(order.total)}</td><td><span className={`status-badge ${String(order.status || '').toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span></td></tr>)}</tbody></table></div>}
      </section>

      <section className="card dashboard-orders-card">
        <div className="dashboard-section-heading"><div><h4>Repair operations</h4><p className="page-subtitle">Active jobs, closed service history, and technician assignments.</p></div><a href="/admin/repairs" className="btn btn-outline">Open job cards</a></div>
        <div className="dashboard-repair-summary"><div><span>Active repairs</span><strong>{activeJobs.length}</strong></div><div><span>Completed</span><strong>{completedRepairs}</strong></div><div><span>Unassigned</span><strong>{unassignedCount}</strong></div><div><span>Technicians</span><strong>{technicians.length}</strong></div></div>
        {repairJobs.length > 0 && <div className="table-container dashboard-repair-table"><table><thead><tr><th>Job Card</th><th>Customer</th><th>Vehicle</th><th>Technician</th><th>Status</th></tr></thead><tbody>{repairJobs.slice(0, 6).map(job => <tr key={job._id}><td><strong>{job.jobCardNumber}</strong></td><td>{job.customerName}</td><td>{job.vehicleMake || ''} {job.vehicleModel} - {job.registrationNumber || job.licensePlate}</td><td>{job.technician?.name || 'Unassigned'}</td><td><span className={`badge ${isCompleted(job) ? 'badge-success' : 'badge-info'}`}>{job.status}</span></td></tr>)}</tbody></table></div>}
        {!repairJobs.length && !loading && <p className="dashboard-table-empty">No repair jobs have been created yet.</p>}
      </section>
    </div>
  );
};

export default Dashboard;
