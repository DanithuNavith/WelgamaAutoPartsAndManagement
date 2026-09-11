import React, { useEffect, useState } from 'react';
import { CheckCircle, ClipboardList, Clock, LogOut, Package, User, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:5000/api';
const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` });
const nextStatus = { ASSIGNED: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED' };

const TechnicianDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [form, setForm] = useState({ diagnosis: '', repairNotes: '', technicianHours: 0, technicianRate: 1000, partsUsed: [] });
  const [part, setPart] = useState({ product: '', productName: '', quantity: 1, unitPrice: '' });
  const [error, setError] = useState('');

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
    setForm({ diagnosis: job.diagnosis || '', repairNotes: job.repairNotes || '', technicianHours: job.technicianHours || 0, technicianRate: job.technicianRate || job.technician?.hourlyRate || 1000, partsUsed: job.partsUsed || [] });
  };

  const addPart = event => {
    event.preventDefault();
    if (!part.product || Number(part.quantity) < 1) return;
    setForm({ ...form, partsUsed: [...form.partsUsed, { product: part.product, productName: part.productName, quantity: Number(part.quantity), unitPrice: Number(part.unitPrice) }] });
    setPart({ product: '', productName: '', quantity: 1, unitPrice: '' });
  };

  const updateJob = async () => {
    const response = await fetch(`${API}/jobCards/${activeJob._id}/progress`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ status: nextStatus[activeJob.status], ...form }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Unable to update job.'); return; }
    setActiveJob(null); loadJobs();
  };

  const logout = () => { localStorage.clear(); sessionStorage.clear(); navigate('/login'); };
  const count = status => jobs.filter(job => job.status === status).length;

  return <div className="technician-portal">
    <header className="technician-header"><div className="tech-brand"><span><Wrench size={18} /></span><strong>Welgama Auto</strong><small>Technician workspace</small></div><div className="tech-user"><User size={16} /> {user?.name || 'Technician'}<button onClick={logout}><LogOut size={15} /> Sign out</button></div></header>
    <main className="technician-main">
      <section className="technician-welcome"><div><p className="portal-kicker">MY ASSIGNED WORK</p><h1>Good to see you, {user?.name || 'Technician'}.</h1><p>Review assigned repairs and keep each job card up to date.</p></div><Wrench size={54} /></section>
      <div className="tech-stats"><div><ClipboardList size={19} /><span>Assigned</span><strong>{count('ASSIGNED')}</strong></div><div><Clock size={19} /><span>In progress</span><strong>{count('IN_PROGRESS')}</strong></div><div><CheckCircle size={19} /><span>Completed</span><strong>{count('COMPLETED')}</strong></div></div>
      {error && <div className="portal-error">{error}</div>}
      <section className="assigned-jobs"><div className="portal-section-heading"><div><p className="portal-kicker">PRIVATE WORK QUEUE</p><h2>My repair jobs</h2></div><span className="portal-live">Only your assignments</span></div>
          {jobs.length === 0 ? <div className="portal-empty"><ClipboardList size={35} /><p>No repair jobs assigned to you yet.</p></div> : <div className="tech-job-grid">{jobs.map(job => <article className="tech-job-card" key={job._id}><div className="tech-job-top"><strong>{job.jobCardNumber}</strong><span className={`status-badge ${job.status.toLowerCase().replaceAll('_', '-')}`}>{job.status}</span></div><h3>{job.customerName}</h3><p className="tech-vehicle">{job.vehicleMake || ''} {job.vehicleModel} · {job.registrationNumber || job.licensePlate}</p><p className="tech-issue">{job.issueDescription}</p><div className="tech-job-meta"><span>Priority: <b>{job.priority || 'Medium'}</b></span><span>{job.appointmentDate ? new Date(job.appointmentDate).toLocaleDateString() : 'No date'}</span></div>{job.invoice && <p className="repair-bill-total">Repair bill: Rs. {Number(job.repairCost || 0).toLocaleString()}</p>}<button className="btn btn-primary tech-open" onClick={() => openJob(job)}>{job.status === 'COMPLETED' ? 'View completed job' : 'Open job card'}</button></article>)}</div>}
      </section>
    </main>
    {activeJob && <div className="modal-backdrop" onClick={() => setActiveJob(null)}><div className="card tech-modal" onClick={event => event.stopPropagation()}><div className="modal-heading"><div><span className="section-icon"><ClipboardList size={18} /></span><div><h4>{activeJob.jobCardNumber}</h4><p>{activeJob.customerName} · {activeJob.registrationNumber || activeJob.licensePlate}</p></div></div><button className="icon-button" title="Close" onClick={() => setActiveJob(null)}>×</button></div><div className="job-customer-detail"><span>Vehicle</span><strong>{activeJob.vehicleMake} {activeJob.vehicleModel} {activeJob.vehicleYear || ''}</strong><span>Issue</span><strong>{activeJob.issueDescription}</strong></div>{activeJob.status !== 'COMPLETED' && <><label className="tech-label">Diagnosis<textarea className="input" rows="3" value={form.diagnosis} onChange={event => setForm({ ...form, diagnosis: event.target.value })} /></label><label className="tech-label">Repair notes<textarea className="input" rows="3" value={form.repairNotes} onChange={event => setForm({ ...form, repairNotes: event.target.value })} /></label><form className="parts-form" onSubmit={addPart}><select className="input" required value={part.product} onChange={event => { const product = products.find(item => item._id === event.target.value); setPart({ ...part, product: event.target.value, productName: product?.name || '', unitPrice: product?.price || '' }); }}><option value="">Select inventory part</option>{products.filter(product => product.quantity > 0).map(product => <option key={product._id} value={product._id}>{product.name} · Stock {product.quantity}</option>)}</select><input className="input" min="1" type="number" required value={part.quantity} onChange={event => setPart({ ...part, quantity: event.target.value })} /><input className="input" min="0" step="0.01" type="number" required placeholder="Unit price" value={part.unitPrice} onChange={event => setPart({ ...part, unitPrice: event.target.value })} /><button className="btn btn-outline" type="submit"><Package size={15} /> Add part</button></form>{form.partsUsed.length > 0 && <div className="used-parts">{form.partsUsed.map((usedPart, index) => <span key={index}>{usedPart.productName} × {usedPart.quantity} · Rs. {usedPart.unitPrice}</span>)}</div>}<button className="btn btn-primary tech-save" onClick={updateJob}>Move to {nextStatus[activeJob.status]}</button></>}</div></div>}
  </div>;
};

export default TechnicianDashboard;
