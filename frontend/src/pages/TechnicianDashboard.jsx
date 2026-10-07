import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle, ClipboardList, Clock, LogOut, Package, User, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { API_BASE_URL } from '../services/apiBase';

const API = API_BASE_URL;
const auth = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
});
const nextStatus = { ASSIGNED: 'IN_PROGRESS', Pending: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', 'In Progress': 'COMPLETED' };
const completedStatuses = ['COMPLETED', 'Completed'];
const validateDiagnosis = value => {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Diagnosis is required before completing the job.';
  if (trimmed.length < 10) return 'Diagnosis must be at least 10 characters.';
  return '';
};
const jobColumns = [
  { id: 'assigned', title: 'Assigned', icon: ClipboardList, statuses: ['ASSIGNED', 'Pending'] },
  { id: 'in-progress', title: 'In progress', icon: Clock, statuses: ['IN_PROGRESS', 'In Progress'] },
  { id: 'done', title: 'Done', icon: CheckCircle, statuses: completedStatuses }
];

const getAppointmentTimestamp = job => {
  if (!job.appointmentDate) return null;
  const timestamp = new Date(job.appointmentDate).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const formatAppointmentDate = job => {
  const timestamp = getAppointmentTimestamp(job);
  if (timestamp === null) return 'Date not set';
  return new Date(timestamp).toLocaleString(undefined, {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const matchesDateFilter = (job, filter, today = new Date()) => {
  if (filter === 'all') return true;
  const timestamp = getAppointmentTimestamp(job);
  if (timestamp === null) return false;

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
  if (filter === 'today') return timestamp >= startOfToday && timestamp < startOfTomorrow;
  if (filter === 'upcoming') return timestamp >= startOfTomorrow;
  return timestamp < startOfToday;
};

const TechnicianDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [form, setForm] = useState({ diagnosis: '', repairNotes: '', technicianHours: 0, technicianRate: 1000, partsUsed: [] });
  const [part, setPart] = useState({ product: '', productName: '', quantity: 1, unitPrice: '' });
  const [partSearch, setPartSearch] = useState('');
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateSort, setDateSort] = useState('earliest');

  const loadJobs = async () => {
    const response = await fetch(`${API}/jobCards`, { headers: auth() });
    if (response.ok) setJobs(await response.json());
    else setError('Unable to load your assigned jobs.');
  };

  useEffect(() => {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    loadJobs();
    fetch(`${API}/products`, { headers: auth() }).then(response => response.ok ? response.json() : []).then(setProducts);
  }, []);

  const openJob = job => {
    setActiveJob(job);
    setForm({
      diagnosis: job.diagnosis || '',
      repairNotes: job.repairNotes || '',
      technicianHours: job.technicianHours || 0,
      technicianRate: job.technicianRate || job.technician?.hourlyRate || 1000,
      partsUsed: (job.partsUsed || []).map(item => ({ ...item, product: item.product?._id || item.product }))
    });
  };

  const addPart = event => {
    event.preventDefault();
    if (!part.product || Number(part.quantity) < 1) return;
    setForm({
      ...form,
      partsUsed: [...form.partsUsed, {
        product: part.product,
        productName: part.productName,
        quantity: Number(part.quantity),
        unitPrice: Number(part.unitPrice)
      }]
    });
    setPart({ product: '', productName: '', quantity: 1, unitPrice: '' });
    setPartSearch('');
  };

  const updateJob = async () => {
    const completionStatus = nextStatus[activeJob.status];
    const diagnosisError = completionStatus === 'COMPLETED' ? validateDiagnosis(form.diagnosis) : '';
    if (diagnosisError) {
      setError(diagnosisError);
      return;
    }
    const response = await fetch(`${API}/jobCards/${activeJob._id}/progress`, {
      method: 'PATCH',
      headers: auth(),
      body: JSON.stringify({ status: completionStatus, ...form })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Unable to update job.');
      return;
    }
    setError('');
    setActiveJob(null);
    loadJobs();
  };

  const logout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
  };

  return <div className="technician-portal">
    <header className="technician-header">
      <div className="tech-brand"><BrandLogo width={100} style={{ height: 'auto' }} /><small>Technician workspace</small></div>
      <div className="tech-user"><User size={16} /> {user?.name || 'Technician'}<button onClick={logout}><LogOut size={15} /> Sign out</button></div>
    </header>

    <main className="technician-main">
      <section className="technician-welcome">
        <div>
          <p className="portal-kicker">MY ASSIGNED WORK</p>
          <h1>Good to see you, {user?.name || 'Technician'}.</h1>
          <p>Review assigned repairs and keep each job card up to date.</p>
        </div>
        <Wrench size={54} />
      </section>
      {error && <div className="portal-error">{error}</div>}

      <section className="assigned-jobs">
        <div className="portal-section-heading">
          <div><p className="portal-kicker">PRIVATE WORK QUEUE</p><h2>My repair jobs</h2></div>
          <span className="portal-live">Only your assignments</span>
        </div>
        <div className="tech-board-controls">
          <label>
            <CalendarDays size={15} />
            <span>Appointments</span>
            <select value={dateFilter} onChange={event => setDateFilter(event.target.value)} aria-label="Filter appointments by date">
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </label>
          <label>
            <span>Sort by date</span>
            <select value={dateSort} onChange={event => setDateSort(event.target.value)} aria-label="Sort jobs by appointment date">
              <option value="earliest">Soonest first</option>
              <option value="latest">Latest first</option>
            </select>
          </label>
        </div>
        <div className="tech-board">
          {jobColumns.map(column => {
            const ColumnIcon = column.icon;
            const columnJobs = jobs
              .filter(job => column.statuses.includes(job.status) && matchesDateFilter(job, dateFilter))
              .sort((first, second) => {
                const firstTime = getAppointmentTimestamp(first);
                const secondTime = getAppointmentTimestamp(second);
                if (firstTime === null) return secondTime === null ? 0 : 1;
                if (secondTime === null) return -1;
                return dateSort === 'earliest' ? firstTime - secondTime : secondTime - firstTime;
              });
            return <section className={`tech-board-column ${column.id}`} key={column.id} aria-labelledby={`tech-column-${column.id}`}>
              <header className="tech-column-heading">
                <h3 id={`tech-column-${column.id}`}><ColumnIcon size={17} /> {column.title}</h3>
                <span className="tech-column-count">{columnJobs.length}</span>
              </header>
              <div className="tech-column-jobs">
                {columnJobs.length === 0 ? <div className="tech-column-empty">No {column.title.toLowerCase()} jobs</div> : columnJobs.map(job => {
                  const isCompleted = completedStatuses.includes(job.status);
                  const statusClass = job.status.toLowerCase().replaceAll(/[_ ]/g, '-');
                  return <article className="tech-job-card" key={job._id}>
                    <div className="tech-job-top">
                      <strong>{job.jobCardNumber}</strong>
                      <span className={`status-badge ${statusClass}`}>{isCompleted ? 'Done' : column.title}</span>
                    </div>
                    <h3>{job.customerName}</h3>
                    <p className="tech-vehicle">{job.vehicleMake || ''} {job.vehicleModel} · {job.registrationNumber || job.licensePlate}</p>
                    <p className="tech-issue">{job.issueDescription}</p>
                    <div className="tech-job-meta"><span>Priority: <b>{job.priority || 'Medium'}</b></span></div>
                    <div className="tech-appointment"><CalendarDays size={15} /><span><strong>Booked appointment</strong>{formatAppointmentDate(job)}</span></div>
                    {job.invoice && <p className="repair-bill-total">Repair bill: Rs. {Number(job.repairCost || 0).toLocaleString()}</p>}
                    <button className="btn btn-primary tech-open" onClick={() => openJob(job)}>
                      {isCompleted ? 'View completed job' : 'Open job card'}
                    </button>
                  </article>;
                })}
              </div>
            </section>;
          })}
        </div>
      </section>
    </main>

    {activeJob && <div className="modal-backdrop" onClick={() => setActiveJob(null)}>
      <div className="card tech-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="section-icon"><ClipboardList size={18} /></span>
            <div><h4>{activeJob.jobCardNumber}</h4><p>{activeJob.customerName} · {activeJob.registrationNumber || activeJob.licensePlate}</p></div>
          </div>
          <button className="icon-button" title="Close" onClick={() => setActiveJob(null)}>×</button>
        </div>
        <div className="job-customer-detail">
          <span>Vehicle</span><strong>{activeJob.vehicleMake} {activeJob.vehicleModel} {activeJob.vehicleYear || ''}</strong>
          <span>Issue</span><strong>{activeJob.issueDescription}</strong>
        </div>
        {!completedStatuses.includes(activeJob.status) && <>
          <label className="tech-label">Diagnosis
            <textarea className="input" rows="3" value={form.diagnosis} onChange={event => setForm({ ...form, diagnosis: event.target.value })} />
            {nextStatus[activeJob.status] === 'COMPLETED' && validateDiagnosis(form.diagnosis) && <small className="portal-error" style={{ display: 'block', marginTop: '0.5rem' }}>{validateDiagnosis(form.diagnosis)}</small>}
          </label>
          <label className="tech-label">Repair notes
            <textarea className="input" rows="3" value={form.repairNotes} onChange={event => setForm({ ...form, repairNotes: event.target.value })} />
          </label>
          <form className="parts-form" onSubmit={addPart}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
              <input
                className="input"
                type="text"
                placeholder="Search part"
                value={partSearch}
                onChange={event => {
                  const nextValue = event.target.value;
                  setPartSearch(nextValue);
                  if (!nextValue.trim()) {
                    setPart({ ...part, product: '', productName: '', unitPrice: '' });
                  }
                }}
              />
              {partSearch.trim() && (
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #dfe7f1', borderRadius: '10px', background: '#f8fafc' }}>
                  {products
                    .filter(product => product.quantity > 0)
                    .filter(product => product.name.toLowerCase().includes(partSearch.trim().toLowerCase()))
                    .map(product => (
                      <button
                        type="button"
                        key={product._id}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          background: part.product === product._id ? '#e0f2fe' : 'transparent',
                          border: 'none',
                          padding: '0.55rem 0.75rem',
                          cursor: 'pointer',
                          color: '#111827'
                        }}
                        onMouseDown={() => {
                          setPart({ ...part, product: product._id, productName: product.name, unitPrice: product.price });
                          setPartSearch(product.name);
                        }}
                      >
                        {product.name}
                      </button>
                    ))}
                  {products.filter(product => product.quantity > 0 && product.name.toLowerCase().includes(partSearch.trim().toLowerCase())).length === 0 && (
                    <div style={{ padding: '0.55rem 0.75rem', color: '#6b7280' }}>No matching part found</div>
                  )}
                </div>
              )}
            </div>
            <input className="input" min="1" type="number" required value={part.quantity} onChange={event => setPart({ ...part, quantity: event.target.value })} />
            <button className="btn btn-outline" type="submit"><Package size={15} /> Add part</button>
          </form>
          {form.partsUsed.length > 0 && <div className="used-parts">
            {form.partsUsed.map((usedPart, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <span>{usedPart.productName} × {usedPart.quantity} · Rs. {usedPart.unitPrice}</span>
                <button type="button" className="btn btn-outline" onClick={() => setForm({ ...form, partsUsed: form.partsUsed.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
              </div>
            ))}
          </div>}
          <button className="btn btn-primary tech-save" disabled={nextStatus[activeJob.status] === 'COMPLETED' && Boolean(validateDiagnosis(form.diagnosis))} onClick={updateJob}>Move to {nextStatus[activeJob.status]}</button>
        </>}
      </div>
    </div>}
  </div>;
};

export default TechnicianDashboard;
