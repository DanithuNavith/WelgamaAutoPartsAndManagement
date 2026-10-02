import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Car, ClipboardList, CircleDollarSign, Edit, Eye, LayoutGrid, List, Plus, Search, Trash2, Wrench, X } from 'lucide-react';
import { validateJobForm } from '../utils/repairFormValidation';

const API = 'http://localhost:5000/api';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` });
const blankJob = { customer: '', vehicleIndex: '', issueDescription: '', appointmentDate: '', appointmentTime: '', priority: 'Medium', repairNotes: '', technician: '' };
const emptyAvailability = { loading: false, holiday: null, availableTimes: [], error: '' };
const getSriLankaToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const getSriLankaDateTime = value => {
  if (!value) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
};
const formatTimeSlot = time => {
  const [hour, minute] = time.split(':').map(Number);
  const formatTime = totalMinutes => {
    const slotHour = Math.floor(totalMinutes / 60);
    const suffix = slotHour >= 12 ? 'p.m.' : 'a.m.';
    return `${slotHour % 12 || 12}:${String(totalMinutes % 60).padStart(2, '0')} ${suffix}`;
  };
  const start = hour * 60 + minute;
  return `${formatTime(start)} – ${formatTime(start + 60)}`;
};
const matchesExistingAppointment = (job, editingJob) => {
  if (!editingJob) return false;
  const originalAppointment = getSriLankaDateTime(editingJob.appointmentDate);
  const originalTechnician = editingJob.technician?._id || editingJob.technician || '';
  return job.appointmentDate === originalAppointment.date
    && job.appointmentTime === originalAppointment.time
    && job.technician === originalTechnician;
};
const cleanVehicleText = value => String(value || '')
  .replace(/\bnot provided\b/gi, '')
  .replace(/\s+/g, ' ')
  .replace(/^[\s·,–—-]+|[\s·,–—-]+$/g, '')
  .trim();
const normalizeStatus = status => status === 'Pending' ? 'ASSIGNED' : status === 'In Progress' ? 'IN_PROGRESS' : status;
const statusTone = status => normalizeStatus(status) === 'COMPLETED' ? 'badge-success' : normalizeStatus(status) === 'IN_PROGRESS' ? 'badge-info' : 'badge-warning';
const formatAppointment = value => value
  ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  : 'No appointment scheduled';

const Repairs = () => {
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]); const [technicians, setTechnicians] = useState([]); const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState(() => searchParams.get('action') === 'new-job' ? 'new-job' : 'jobs'); const [jobForm, setJobForm] = useState(blankJob); const [editingJob, setEditingJob] = useState(null);
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('ALL'); const [error, setError] = useState('');
  const [jobFieldErrors, setJobFieldErrors] = useState({});
  const [availability, setAvailability] = useState(emptyAvailability);
  const [today] = useState(getSriLankaToday);
  const [technicianFilter, setTechnicianFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [appointmentFilter, setAppointmentFilter] = useState('');
  const [billingFilter, setBillingFilter] = useState('ALL');
  const [jobView, setJobView] = useState('list');
  const [selectedJob, setSelectedJob] = useState(null);
  const [notice, setNotice] = useState('');
  const load = async () => {
    try {
      const auth = { headers: headers() };
      const [customerRes, techRes, jobRes] = await Promise.all([
        fetch(`${API}/customers`, auth),
        fetch(`${API}/technicians`, auth),
        fetch(`${API}/jobCards`, auth)
      ]);
      if (!customerRes.ok || !techRes.ok || !jobRes.ok) throw new Error('Unable to load repair management data');
      const customerData = await customerRes.json();
      setCustomers(customerData.map(customer => ({
        ...customer,
        vehicles: (customer.vehicles || []).map(vehicle => ({
          ...vehicle,
          make: cleanVehicleText(vehicle.make),
          model: cleanVehicleText(vehicle.model),
          licensePlate: cleanVehicleText(vehicle.licensePlate)
        }))
      })));
      setTechnicians(await techRes.json());
      const jobData = await jobRes.json();
      setJobs(jobData.map(job => ({
        ...job,
        vehicleMake: cleanVehicleText(job.vehicleMake),
        vehicleModel: cleanVehicleText(job.vehicleModel),
        registrationNumber: cleanVehicleText(job.registrationNumber),
        licensePlate: cleanVehicleText(job.licensePlate)
      })));
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (tab !== 'new-job' || !jobForm.appointmentDate || !jobForm.technician) {
      setAvailability(emptyAvailability);
      return undefined;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      date: jobForm.appointmentDate,
      technician: jobForm.technician
    });
    if (editingJob?._id) params.set('excludeJob', editingJob._id);
    setAvailability({ ...emptyAvailability, loading: true });

    fetch(`${API}/jobCards/availability?${params}`, {
      headers: headers(),
      signal: controller.signal
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not check appointment availability.');
      setAvailability({
        loading: false,
        holiday: data.holiday,
        availableTimes: data.availableTimes,
        error: ''
      });
      setJobForm(current => {
        if (data.holiday || (!data.availableTimes.includes(current.appointmentTime) && !matchesExistingAppointment(current, editingJob))) {
          return { ...current, appointmentTime: '' };
        }
        return current;
      });
    }).catch(fetchError => {
      if (fetchError.name !== 'AbortError') {
        setAvailability({ ...emptyAvailability, error: fetchError.message });
      }
    });

    return () => controller.abort();
  }, [tab, jobForm.appointmentDate, jobForm.technician, editingJob]);
  useEffect(() => {
    if (searchParams.get('action') === 'new-job') {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [searchParams]);
  useEffect(() => {
    if (!selectedJob) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setSelectedJob(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedJob]);
  const filteredJobs = useMemo(() => jobs.filter(job => {
    const normalizedStatus = normalizeStatus(job.status);
    const technicianId = job.technician?._id || job.technician || '';
    const appointmentDate = job.appointmentDate ? new Date(job.appointmentDate).toLocaleDateString('en-CA') : '';
    const query = search.trim().toLowerCase();
    const searchable = `${job.jobCardNumber} ${job.customerName} ${job.registrationNumber || job.licensePlate} ${job.vehicleMake} ${job.vehicleModel}`.toLowerCase();
    return (filter === 'ALL' || normalizedStatus === filter)
      && (technicianFilter === 'ALL' || technicianId === technicianFilter)
      && (priorityFilter === 'ALL' || (job.priority || 'Medium') === priorityFilter)
      && (!appointmentFilter || appointmentDate === appointmentFilter)
      && (billingFilter === 'ALL' || (billingFilter === 'UNBILLED' ? normalizedStatus === 'COMPLETED' && !job.invoice : Boolean(job.invoice)))
      && (!query || searchable.includes(query));
  }), [jobs, filter, technicianFilter, priorityFilter, appointmentFilter, billingFilter, search]);
  const repairCounts = useMemo(() => ({
    assigned: jobs.filter(job => normalizeStatus(job.status) === 'ASSIGNED').length,
    inProgress: jobs.filter(job => normalizeStatus(job.status) === 'IN_PROGRESS').length,
    completed: jobs.filter(job => normalizeStatus(job.status) === 'COMPLETED').length,
    unbilled: jobs.filter(job => normalizeStatus(job.status) === 'COMPLETED' && !job.invoice).length
  }), [jobs]);
  const boardColumns = [
    { status: 'ASSIGNED', title: 'Assigned', description: 'Waiting to start', jobs: filteredJobs.filter(job => normalizeStatus(job.status) === 'ASSIGNED') },
    { status: 'IN_PROGRESS', title: 'In progress', description: 'Currently in the workshop', jobs: filteredJobs.filter(job => normalizeStatus(job.status) === 'IN_PROGRESS') },
    { status: 'COMPLETED', title: 'Completed', description: 'Ready for billing or collection', jobs: filteredJobs.filter(job => normalizeStatus(job.status) === 'COMPLETED') }
  ];
  const submitJob = async event => {
    event.preventDefault();
    setError('');
    setNotice('');
    const customer = customers.find(item => item._id === jobForm.customer);
    const unchangedAppointment = matchesExistingAppointment(jobForm, editingJob);
    const validationErrors = validateJobForm(jobForm, customer, new Date(), { allowPastAppointment: unchangedAppointment });
    if (!unchangedAppointment && jobForm.appointmentTime && !availability.availableTimes.includes(jobForm.appointmentTime)) {
      validationErrors.appointmentTime = 'Choose an available appointment time.';
    }
    setJobFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      setError('Please correct the highlighted job card details.');
      return;
    }
    const vehicle = jobForm.vehicleIndex === 'existing-job-vehicle' && editingJob
      ? {
        licensePlate: editingJob.registrationNumber || editingJob.licensePlate,
        make: cleanVehicleText(editingJob.vehicleMake),
        model: cleanVehicleText(editingJob.vehicleModel),
        year: editingJob.vehicleYear
      }
      : jobForm.vehicleIndex !== ''
        ? customer?.vehicles?.[Number(jobForm.vehicleIndex)]
        : null;
    if (!customer || !vehicle) {
      setError('Select a customer and a vehicle registered to that customer.');
      return;
    }
    const payload = {
      ...jobForm,
      appointmentDate: `${jobForm.appointmentDate}T${jobForm.appointmentTime}`,
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerAddress: customer.address,
      registrationNumber: cleanVehicleText(vehicle.licensePlate),
      licensePlate: cleanVehicleText(vehicle.licensePlate),
      vehicleMake: cleanVehicleText(vehicle.make) || 'Not provided',
      vehicleModel: cleanVehicleText(vehicle.model),
      vehicleYear: vehicle.year,
      jobCardNumber: editingJob?.jobCardNumber
    };
    if (unchangedAppointment) {
      delete payload.appointmentDate;
      delete payload.technician;
    }
    delete payload.vehicleIndex;
    const response = await fetch(`${API}/jobCards${editingJob ? `/${editingJob._id}` : ''}`, {
      method: editingJob ? 'PUT' : 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Could not save job card.');
      return;
    }
    setJobForm(blankJob);
    setJobFieldErrors({});
    setEditingJob(null);
    setNotice(editingJob ? 'Job card updated successfully.' : 'Job card created successfully.');
    load();
  };
  const editJob = job => {
    setEditingJob(job);
    setJobFieldErrors({});
    const customerId = job.customer?._id || job.customer || '';
    const customer = customers.find(item => item._id === customerId);
    const vehicleIndex = (customer?.vehicles || []).findIndex(vehicle => (
      vehicle.licensePlate?.trim().toLowerCase()
      === (job.registrationNumber || job.licensePlate || '').trim().toLowerCase()
    ));
    setJobForm({
      customer: customerId,
      vehicleIndex: vehicleIndex >= 0 ? String(vehicleIndex) : 'existing-job-vehicle',
      issueDescription: job.issueDescription,
      ...getSriLankaDateTime(job.appointmentDate),
      priority: job.priority || 'Medium',
      repairNotes: job.repairNotes || '',
      technician: job.technician?._id || ''
    });
    setTab('new-job');
  };
  const deleteJob = async id => {
    if (!window.confirm('Delete this job card?')) return;
    setError('');
    setNotice('');
    const response = await fetch(`${API}/jobCards/${id}`, { method: 'DELETE', headers: headers() });
    if (!response.ok) {
      setError('Could not delete the job card. Refresh the page and try again.');
      return;
    }
    setSelectedJob(null);
    setNotice('Job card deleted.');
    load();
  };
  const updateJobField = (field, value) => {
    const next = field === 'customer'
      ? { ...jobForm, customer: value, vehicleIndex: '' }
      : field === 'appointmentDate' || field === 'technician'
        ? { ...jobForm, [field]: value, appointmentTime: '' }
        : { ...jobForm, [field]: value };
    setJobForm(next);
    if (Object.keys(jobFieldErrors).length) {
      setJobFieldErrors(validateJobForm(next, customers.find(customer => customer._id === next.customer)));
    }
  };
  const selectedCustomer = customers.find(customer => customer._id === jobForm.customer);
  const retainingExistingAppointment = matchesExistingAppointment(jobForm, editingJob);
  const selectableAppointmentTimes = retainingExistingAppointment && !availability.availableTimes.includes(jobForm.appointmentTime)
    ? [...availability.availableTimes, jobForm.appointmentTime]
    : availability.availableTimes;
  const hasExistingJobVehicle = jobForm.vehicleIndex === 'existing-job-vehicle'
    && editingJob
    && (editingJob.vehicleMake || editingJob.vehicleModel || editingJob.registrationNumber || editingJob.licensePlate);

  return <div className="repair-module">
    <div className="repair-heading">
    <div>
    <div className="eyebrow">
    <Car size={16} /> Workshop operations</div>
    <h3>Customer & Repair Management</h3>
    <p className="page-subtitle">Manage customer vehicles, job cards, and technician workload.</p>
    </div>
    <div className="repair-stats">
    <span>
    <strong>{jobs.filter(job => job.status !== 'COMPLETED').length}</strong> active repairs</span>
    </div>
    </div>{error && <div className="form-error repair-error" role="alert">{error}</div>}
    {notice && <div className="repair-notice" role="status">{notice}</div>}
    <section className="repair-overview" aria-label="Repair workload overview">
    <div className="repair-overview-card">
    <span><ClipboardList size={17} /> Assigned</span>
    <strong>{repairCounts.assigned}</strong>
    <small>Waiting to start</small>
    </div>
    <div className="repair-overview-card">
    <span><Wrench size={17} /> In progress</span>
    <strong>{repairCounts.inProgress}</strong>
    <small>In the workshop</small>
    </div>
    <div className="repair-overview-card">
    <span><Car size={17} /> Completed</span>
    <strong>{repairCounts.completed}</strong>
    <small>Repair work finished</small>
    </div>
    <div className="repair-overview-card is-highlight">
    <span><CircleDollarSign size={17} /> Needs billing</span>
    <strong>{repairCounts.unbilled}</strong>
    <small>Completed, not invoiced</small>
    </div>
    </section>
    <div className="repair-tabs">
    <button className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>
    <ClipboardList size={16} /> Job cards</button>
    <button className={tab === 'new-job' ? 'active' : ''} onClick={() => { setEditingJob(null); setJobForm(blankJob); setJobFieldErrors({}); setTab('new-job'); }}>
    <Plus size={16} /> New job card</button>
    </div>
    {tab === 'jobs' && <section className="card">
    <div className="list-heading">
    <div>
    <h4>Repair job cards</h4>
    <p>{filteredJobs.length} of {jobs.length} job cards shown</p>
    </div>
    <div className="repair-list-tools">
    <div className="repair-filters">
    <div className="supplier-search">
    <Search size={16} />
    <input placeholder="Search job, customer, registration" value={search} onChange={event => setSearch(event.target.value)} />
    </div>
    <select className="input" value={filter} onChange={event => setFilter(event.target.value)}>
    <option value="ALL">All statuses</option>
    <option value="ASSIGNED">Assigned</option>
    <option value="IN_PROGRESS">In progress</option>
    <option value="COMPLETED">Completed</option>
    </select>
    <select className="input" aria-label="Filter by technician" value={technicianFilter} onChange={event => setTechnicianFilter(event.target.value)}>
    <option value="ALL">All technicians</option>
    {technicians.filter(tech => ['Technician 1', 'Technician 2'].includes(tech.name)).map(tech => <option key={tech._id} value={tech._id}>{tech.name}</option>)}
    </select>
    <select className="input" aria-label="Filter by priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}>
    <option value="ALL">All priorities</option>
    <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
    </select>
    <input className="input repair-date-filter" type="date" aria-label="Filter by appointment date" value={appointmentFilter} onChange={event => setAppointmentFilter(event.target.value)} />
    <select className="input" aria-label="Filter by billing status" value={billingFilter} onChange={event => setBillingFilter(event.target.value)}>
    <option value="ALL">All billing</option>
    <option value="UNBILLED">Needs billing</option>
    <option value="BILLED">Billed</option>
    </select>
    <button className="repair-clear-filters" type="button" onClick={() => { setSearch(''); setFilter('ALL'); setTechnicianFilter('ALL'); setPriorityFilter('ALL'); setAppointmentFilter(''); setBillingFilter('ALL'); }}>Clear filters</button>
    </div>
    <div className="repair-view-switch" role="group" aria-label="Job card view">
    <button type="button" className={jobView === 'list' ? 'active' : ''} aria-pressed={jobView === 'list'} onClick={() => setJobView('list')}><List size={16} /> List</button>
    <button type="button" className={jobView === 'board' ? 'active' : ''} aria-pressed={jobView === 'board'} onClick={() => setJobView('board')}><LayoutGrid size={16} /> Board</button>
    </div>
    </div>
    </div>
    {jobView === 'board' ? <div className="repair-board">
    {boardColumns.map(column => <section className="repair-board-column" key={column.status}>
    <div className="repair-board-heading">
    <div><h5>{column.title}</h5><p>{column.description}</p></div>
    <span>{column.jobs.length}</span>
    </div>
    <div className="repair-board-cards">
    {column.jobs.length === 0 ? <p className="repair-board-empty">No job cards</p> : column.jobs.map(job => <article className="repair-job-card" key={job._id}>
    <div className="repair-job-card-top"><strong>{job.jobCardNumber}</strong><span className={`priority-chip priority-${(job.priority || 'Medium').toLowerCase()}`}>{job.priority || 'Medium'}</span></div>
    <h6>{job.customerName}</h6>
    <p className="repair-job-vehicle">{job.vehicleMake} {job.vehicleModel} · {job.registrationNumber || job.licensePlate}</p>
    <p className="repair-job-issue">{job.issueDescription}</p>
    <div className="repair-job-card-meta"><span><Wrench size={14} /> {job.technician?.name || 'Unassigned'}</span><span><CalendarDays size={14} /> {formatAppointment(job.appointmentDate)}</span></div>
    {normalizeStatus(job.status) === 'COMPLETED' && !job.invoice && <span className="repair-unbilled-label">Needs billing</span>}
    <div className="repair-job-card-actions">
    <button type="button" onClick={() => setSelectedJob(job)}><Eye size={15} /> Details</button>
    <button type="button" onClick={() => editJob(job)}><Edit size={15} /> Edit</button>
    <button type="button" className="danger" onClick={() => deleteJob(job._id)} aria-label={`Delete ${job.jobCardNumber}`}><Trash2 size={15} /></button>
    </div>
    </article>)}
    </div>
    </section>)}
    </div> : <>
    <div className="table-container">
    <table>
    <thead>
    <tr>
    <th>Job Card</th>
    <th>Customer / Vehicle</th>
    <th>Issue</th>
    <th>Technician</th>
    <th>Priority</th>
    <th>Status</th>
    <th>Repair bill</th>
    <th>Actions</th>
    </tr>
    </thead>
    <tbody>{filteredJobs.length === 0 ? <tr>
    <td colSpan="8" className="empty-state">No job cards match this view.</td>
    </tr> : filteredJobs.map(job => <tr key={job._id}>
    <td>
    <strong>{job.jobCardNumber}</strong>
    <small className="table-muted">{formatAppointment(job.appointmentDate)}</small>
    </td>
    <td>
    <strong>{job.customerName}</strong>
    <small className="table-muted">{job.vehicleMake || ''} {job.vehicleModel} · {job.registrationNumber || job.licensePlate}</small>
    </td>
    <td>{job.issueDescription}</td>
    <td>{job.technician?.name || 'Unassigned'}</td>
    <td>
    <span className={`priority-${(job.priority || 'Medium').toLowerCase()}`}>{job.priority || 'Medium'}</span>
    </td>
    <td>
    <span className={`badge ${statusTone(job.status)}`}>{normalizeStatus(job.status).replace('_', ' ')}</span>
    </td>
    <td>{job.invoice ? <strong>Rs. {Number(job.repairCost || 0).toLocaleString()}</strong> : <span className="table-muted">Not billed</span>}</td>
    <td>
    <div className="table-actions">
    <button className="icon-button" title="View job details" onClick={() => setSelectedJob(job)}>
    <Eye size={16} />
    </button>
    <button className="icon-button" title="Edit job card" onClick={() => editJob(job)}>
    <Edit size={16} />
    </button>
    <button className="icon-button danger" title="Delete job card" onClick={() => deleteJob(job._id)}>
    <Trash2 size={16} />
    </button>
    </div>
    </td>
    </tr>)}</tbody>
    </table>
    </div>
    <div className="repair-mobile-cards">
    {filteredJobs.length === 0 ? <p className="repair-board-empty">No job cards match this view.</p> : filteredJobs.map(job => <article className="repair-mobile-job" key={job._id}>
    <div className="repair-mobile-job-heading"><strong>{job.jobCardNumber}</strong><span className={`badge ${statusTone(job.status)}`}>{normalizeStatus(job.status).replace('_', ' ')}</span></div>
    <h5>{job.customerName}</h5>
    <p>{job.vehicleMake} {job.vehicleModel} · {job.registrationNumber || job.licensePlate}</p>
    <p>{job.issueDescription}</p>
    <div className="repair-mobile-job-meta"><span>{job.technician?.name || 'Unassigned'}</span><span>{formatAppointment(job.appointmentDate)}</span></div>
    <div className="repair-job-card-actions">
    <button type="button" onClick={() => setSelectedJob(job)}><Eye size={15} /> Details</button>
    <button type="button" onClick={() => editJob(job)}><Edit size={15} /> Edit</button>
    <button type="button" className="danger" onClick={() => deleteJob(job._id)} aria-label={`Delete ${job.jobCardNumber}`}><Trash2 size={15} /></button>
    </div>
    </article>)}
    </div>
    </>}
    </section>}
    {selectedJob && <div className="repair-detail-overlay" onClick={event => { if (event.target === event.currentTarget) setSelectedJob(null); }}>
    <section className="repair-detail-panel" role="dialog" aria-modal="true" aria-labelledby="repair-detail-title">
    <div className="repair-detail-heading">
    <div><p>Repair job card</p><h4 id="repair-detail-title">{selectedJob.jobCardNumber}</h4></div>
    <button className="icon-button" type="button" aria-label="Close job details" onClick={() => setSelectedJob(null)}><X size={18} /></button>
    </div>
    <div className="repair-detail-badges"><span className={`badge ${statusTone(selectedJob.status)}`}>{normalizeStatus(selectedJob.status).replace('_', ' ')}</span><span className={`priority-chip priority-${(selectedJob.priority || 'Medium').toLowerCase()}`}>{selectedJob.priority || 'Medium'} priority</span></div>
    <div className="repair-detail-grid">
    <div><span>Customer</span><strong>{selectedJob.customerName}</strong></div>
    <div><span>Phone</span><strong>{selectedJob.customerPhone || 'Not provided'}</strong></div>
    <div><span>Vehicle</span><strong>{[selectedJob.vehicleMake, selectedJob.vehicleModel, selectedJob.vehicleYear].filter(Boolean).join(' ') || 'Not provided'}</strong></div>
    <div><span>Registration</span><strong>{selectedJob.registrationNumber || selectedJob.licensePlate || 'Not provided'}</strong></div>
    <div><span>Appointment</span><strong>{formatAppointment(selectedJob.appointmentDate)}</strong></div>
    <div><span>Technician</span><strong>{selectedJob.technician?.name || 'Unassigned'}</strong></div>
    <div><span>Estimated cost</span><strong>{selectedJob.estimatedCost ? `Rs. ${Number(selectedJob.estimatedCost).toLocaleString()}` : 'Not estimated'}</strong></div>
    <div><span>Repair bill</span><strong>{selectedJob.invoice ? `Rs. ${Number(selectedJob.repairCost || 0).toLocaleString()}` : normalizeStatus(selectedJob.status) === 'COMPLETED' ? 'Needs billing' : 'Not billed'}</strong></div>
    </div>
    <div className="repair-detail-notes"><h5>Reported issue</h5><p>{selectedJob.issueDescription || 'No issue description provided.'}</p></div>
    {selectedJob.diagnosis && <div className="repair-detail-notes"><h5>Diagnosis</h5><p>{selectedJob.diagnosis}</p></div>}
    {selectedJob.repairNotes && <div className="repair-detail-notes"><h5>Repair notes</h5><p>{selectedJob.repairNotes}</p></div>}
    {selectedJob.partsUsed?.length > 0 && <div className="repair-detail-notes"><h5>Parts used</h5><ul>{selectedJob.partsUsed.map((part, index) => <li key={`${part.product?._id || part.product || part.productName}-${index}`}>{part.productName || part.product?.name || 'Part'} × {part.quantity}</li>)}</ul></div>}
    <div className="repair-detail-actions"><button className="btn btn-outline" type="button" onClick={() => { const job = selectedJob; setSelectedJob(null); editJob(job); }}><Edit size={15} /> Edit job card</button></div>
    </section>
    </div>}
    {tab === 'new-job' && <section className="card job-form-card">
    <div className="section-heading">
    <span className="section-icon">
    <ClipboardList size={18} />
    </span>
    <div>
    <h4>{editingJob ? 'Edit job card' : 'Create digital job card'}</h4>
    <p>Assign the repair to Technician 1 or Technician 2.</p>
    </div>
    </div>
    <form noValidate className="job-form" onSubmit={submitJob}>
    <label>Customer<select required className={`input${jobFieldErrors.customer ? ' input-validation-error' : ''}`} value={jobForm.customer} aria-invalid={Boolean(jobFieldErrors.customer)} onChange={event => updateJobField('customer', event.target.value)}>
    <option value="">Select customer</option>{customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name} · {customer.phone}</option>)}</select>
    {jobFieldErrors.customer && <small className="field-validation-error">{jobFieldErrors.customer}</small>}
    </label>
    <label>Vehicle<select required className={`input${jobFieldErrors.vehicleIndex ? ' input-validation-error' : ''}`} value={jobForm.vehicleIndex} aria-invalid={Boolean(jobFieldErrors.vehicleIndex)} onChange={event => updateJobField('vehicleIndex', event.target.value)}>
    <option value="">Select vehicle</option>{hasExistingJobVehicle && <option value="existing-job-vehicle">{editingJob.registrationNumber || editingJob.licensePlate} · {editingJob.vehicleMake} {editingJob.vehicleModel}{editingJob.vehicleYear ? ` (${editingJob.vehicleYear})` : ''}</option>}{(selectedCustomer?.vehicles || []).map((vehicle, index) => <option key={index} value={String(index)}>{vehicle.licensePlate} · {vehicle.make} {vehicle.model}{vehicle.year ? ` (${vehicle.year})` : ''}</option>)}</select>
    {jobFieldErrors.vehicleIndex && <small className="field-validation-error">{jobFieldErrors.vehicleIndex}</small>}
    </label>
    <label>Issue description<textarea required maxLength="500" className={`input${jobFieldErrors.issueDescription ? ' input-validation-error' : ''}`} rows="4" value={jobForm.issueDescription} aria-invalid={Boolean(jobFieldErrors.issueDescription)} onChange={event => updateJobField('issueDescription', event.target.value)} placeholder="Describe the customer's reported issue" />
    {jobFieldErrors.issueDescription && <small className="field-validation-error">{jobFieldErrors.issueDescription}</small>}
    </label>
    <div className="job-fields">
    <label>Appointment date<input required type="date" min={today} className={`input${jobFieldErrors.appointmentDate ? ' input-validation-error' : ''}`} value={jobForm.appointmentDate} aria-invalid={Boolean(jobFieldErrors.appointmentDate)} onChange={event => updateJobField('appointmentDate', event.target.value)} />
    {jobFieldErrors.appointmentDate && <small className="field-validation-error">{jobFieldErrors.appointmentDate}</small>}
    </label>
    <label>Priority<select className="input" value={jobForm.priority} onChange={event => updateJobField('priority', event.target.value)}>
    <option>Low</option>
    <option>Medium</option>
    <option>High</option>
    <option>Urgent</option>
    </select>
    </label>
    <label>Available one-hour time slot<select required className={`input${jobFieldErrors.appointmentTime ? ' input-validation-error' : ''}`} value={jobForm.appointmentTime} aria-invalid={Boolean(jobFieldErrors.appointmentTime)} disabled={!jobForm.appointmentDate || !jobForm.technician || availability.loading || Boolean(availability.holiday) || Boolean(availability.error) || (!availability.availableTimes.length && !retainingExistingAppointment)} onChange={event => updateJobField('appointmentTime', event.target.value)}>
    <option value="">Select a time slot</option>{selectableAppointmentTimes.map(time => <option key={time} value={time}>{formatTimeSlot(time)}{retainingExistingAppointment && time === jobForm.appointmentTime && !availability.availableTimes.includes(time) ? ' (current booking)' : ''}</option>)}
    </select>
    {jobFieldErrors.appointmentTime && <small className="field-validation-error">{jobFieldErrors.appointmentTime}</small>}
    </label>
    <label>Assign technician<select required className={`input${jobFieldErrors.technician ? ' input-validation-error' : ''}`} value={jobForm.technician} aria-invalid={Boolean(jobFieldErrors.technician)} onChange={event => updateJobField('technician', event.target.value)}>
    <option value="">Select technician</option>{technicians.filter(tech => ['Technician 1', 'Technician 2'].includes(tech.name)).map(tech => <option key={tech._id} value={tech._id}>{tech.name} · {tech.status}</option>)}</select>
    {jobFieldErrors.technician && <small className="field-validation-error">{jobFieldErrors.technician}</small>}
    </label>
    </div>
    {availability.loading && <p className="booking-hint">Checking public holidays and available times…</p>}
    {availability.holiday && <p className="form-error" role="alert">No bookings on {availability.holiday.name}, a Sri Lankan public holiday.</p>}
    {availability.error && <p className="form-error" role="alert">{availability.error}</p>}
    {!availability.loading && !availability.holiday && !availability.error && jobForm.appointmentDate && jobForm.technician && availability.availableTimes.length === 0 && !retainingExistingAppointment && <p className="booking-hint">No appointment times are available for this date. Please choose another date.</p>}
    <p className="booking-hint">One-hour appointments start hourly from 9:00 a.m. to 4:00 p.m. on available Sri Lankan working days.</p>
    <label>Repair notes<textarea className="input" rows="3" value={jobForm.repairNotes} onChange={event => updateJobField('repairNotes', event.target.value)} placeholder="Initial notes for the assigned technician" />
    </label>
    <div className="form-actions">
    <button type="submit" className="btn btn-primary" disabled={availability.loading || Boolean(availability.holiday) || Boolean(availability.error) || (!availability.availableTimes.length && !retainingExistingAppointment)}>{editingJob ? 'Update Job Card' : 'Create Job Card'}</button>
    <button type="button" className="btn btn-outline" onClick={() => setTab('jobs')}>Cancel</button>
    </div>
    </form>
    </section>}
  </div>;
};
export default Repairs;
