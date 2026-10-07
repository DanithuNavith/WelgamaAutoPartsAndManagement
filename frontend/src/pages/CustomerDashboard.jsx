import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Car, ChevronLeft, ChevronRight, Filter, LogOut, Package, Search, User, Wrench, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { API_BASE_URL } from '../services/apiBase';

const emptyRepair = { vehicleModel: '', licensePlate: '', issueDescription: '', appointmentDate: '', appointmentTime: '', technician: '' };
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

const formatTimeSlot = time => {
  const [hour, minute] = time.split(':').map(Number);
  const formatTime = totalMinutes => {
    const slotHour = Math.floor(totalMinutes / 60);
    const slotMinute = totalMinutes % 60;
    const suffix = slotHour >= 12 ? 'p.m.' : 'a.m.';
    const displayHour = slotHour % 12 || 12;
    return `${displayHour}:${String(slotMinute).padStart(2, '0')} ${suffix}`;
  };
  const start = hour * 60 + minute;
  return `${formatTime(start)} – ${formatTime(start + 60)}`;
};

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [showRepair, setShowRepair] = useState(false);
  const [repair, setRepair] = useState(emptyRepair);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [availability, setAvailability] = useState(emptyAvailability);
  const [today] = useState(getSriLankaToday);
  const [fieldErrors, setFieldErrors] = useState({});

  const validateRepairFields = (draft = repair) => {
    const nextErrors = {};
    const vehicleModel = draft.vehicleModel?.trim();
    if (!vehicleModel) {
      nextErrors.vehicleModel = 'Vehicle model is required.';
    } else if (vehicleModel.length < 2) {
      nextErrors.vehicleModel = 'Vehicle model must be at least 2 characters.';
    } else if (vehicleModel.length > 80) {
      nextErrors.vehicleModel = 'Vehicle model cannot exceed 80 characters.';
    }

    const licensePlate = draft.licensePlate?.trim();
    if (!licensePlate) {
      nextErrors.licensePlate = 'License plate is required.';
    } else if (!/^[A-Z]{2,3}-?[0-9]{3,4}$/i.test(licensePlate)) {
      nextErrors.licensePlate = 'Please enter a valid license plate like ABC-1234 or AB-1234.';
    }

    const issueDescription = draft.issueDescription?.trim();
    if (!issueDescription) {
      nextErrors.issueDescription = 'Please describe the issue.';
    } else if (issueDescription.length < 10) {
      nextErrors.issueDescription = 'Issue description must be at least 10 characters.';
    } else if (issueDescription.length > 500) {
      nextErrors.issueDescription = 'Issue description cannot exceed 500 characters.';
    }

    if (!draft.technician) {
      nextErrors.technician = 'Please select a technician.';
    }

    if (!draft.appointmentDate) {
      nextErrors.appointmentDate = 'Please choose an appointment date.';
    } else {
      const selectedDate = new Date(`${draft.appointmentDate}T00:00:00`);
      const todayDate = new Date(`${today}T00:00:00`);
      if (selectedDate < todayDate) {
        nextErrors.appointmentDate = 'Appointment date must be in the future.';
      }
    }

    if (!draft.appointmentTime) {
      nextErrors.appointmentTime = 'Choose an available appointment time.';
    } else if (!availability.availableTimes.includes(draft.appointmentTime)) {
      nextErrors.appointmentTime = 'Choose an available appointment time.';
    }

    return nextErrors;
  };

  const updateRepairField = (field, value) => {
    const nextRepair = { ...repair, [field]: value };
    setRepair(nextRepair);
    setFieldErrors(currentErrors => {
      const updatedErrors = { ...currentErrors };
      delete updatedErrors[field];
      if (field === 'appointmentDate' || field === 'technician') {
        delete updatedErrors.appointmentTime;
      }
      return updatedErrors;
    });
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token || ''}` };
    const loadJson = async (url, label) => {
      const response = await fetch(url, { headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || `Could not load ${label} (HTTP ${response.status}).`);
      }
      return data;
    };
    Promise.all([
      loadJson(`${API_BASE_URL}/products`, 'available parts'),
      fetch(`${API_BASE_URL}/technicians`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` } }).then(response => response.ok ? response.json() : Promise.reject(new Error('Could not load technicians')))
    ]).then(([parts, staff]) => {
      if (!Array.isArray(parts) || !Array.isArray(staff)) {
        throw new Error('The server returned an unexpected response while loading parts and technicians.');
      }
      setProducts(parts.filter(part => part.quantity > 0));
      setTechnicians(staff.filter(technician => ['Technician 1', 'Technician 2'].includes(technician.name)));
    }).catch(loadError => setError(loadError.message || 'Could not load available parts and technicians.'));
  }, []);

  useEffect(() => {
    if (!showRepair || !repair.appointmentDate) {
      setAvailability(emptyAvailability);
      return undefined;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ date: repair.appointmentDate });
    if (repair.technician) params.set('technician', repair.technician);
    setAvailability({ ...emptyAvailability, loading: true });

    fetch(`${API_BASE_URL}/jobCards/availability?${params}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`
      },
      signal: controller.signal
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || `Could not check appointment availability (HTTP ${response.status}).`);
      }
      setAvailability({ loading: false, holiday: data.holiday, availableTimes: data.availableTimes, error: '' });
    }).catch(fetchError => {
      if (fetchError.name !== 'AbortError') {
        setAvailability({ ...emptyAvailability, error: fetchError.message });
      }
    });

    return () => controller.abort();
  }, [showRepair, repair.appointmentDate, repair.technician]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter(part => (category === 'All Categories' || part.category === category) && (!query || `${part.name} ${part.category}`.toLowerCase().includes(query)));
  }, [products, search, category]);
  const categories = useMemo(() => ['All Categories', ...new Set(products.map(product => product.category))], [products]);
  const submitRepair = async (event) => {
    event.preventDefault();
    setBookingError('');
    const nextErrors = validateRepairFields();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setError('');
    const response = await fetch(`${API_BASE_URL}/jobCards`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` },
      body: JSON.stringify({
        ...repair,
        appointmentDate: `${repair.appointmentDate}T${repair.appointmentTime}`,
        customerName: user?.name
      })
    });
    const data = await response.json();
    if (!response.ok) { setBookingError(data.error || 'Could not book the repair appointment.'); return; }
    setRepair(emptyRepair); setFieldErrors({}); setShowRepair(false); setMessage('Repair appointment requested successfully.');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <div className="customer-portal" style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}><BrandLogo width={100} style={{ height: 'auto' }} /><span style={styles.portal}>Customer portal</span></div>
        <div style={styles.user}><User size={17} /> {user?.name || 'Customer'} <button onClick={logout} style={styles.logout}><LogOut size={15} /> Logout</button></div>
      </header>
      <main style={styles.main}>
        <section style={styles.hero}><div><p style={styles.kicker}>CUSTOMER SERVICE DESK</p><h1>Find parts and book a technician.</h1><p style={styles.subtle}>Search available products and choose a technician time slot for your vehicle.</p></div><div style={styles.heroMark}><Wrench size={46} /></div></section>
        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        <section className="customer-parts-section">
          <div className="customer-parts-heading"><div><p className="customer-kicker"><Package size={15} /> SHOP PARTS</p><h2>Available Parts</h2><p>Browse our wide range of quality auto parts at competitive prices.</p></div><div className="customer-filters"><div className="customer-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by part or category" /></div><div className="customer-category"><Filter size={16} /><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter by category">{categories.map(item => <option key={item}>{item}</option>)}</select></div></div></div>
          <div className="customer-product-rail-wrap"><button className="customer-rail-button customer-rail-prev" type="button" aria-label="Previous parts" onClick={() => document.querySelector('.customer-product-rail')?.scrollBy({ left: -320, behavior: 'smooth' })}><ChevronLeft size={19} /></button><div className="customer-product-rail">
            {visibleProducts.length === 0 ? <div className="customer-empty">No available parts match your search.</div> : visibleProducts.map(product => (
              <article className="customer-product-card" key={product._id}><div className="customer-product-image">{product.image ? <img src={product.image} alt={product.name} /> : <Package size={42} />}</div><div className="customer-product-copy"><h3>{product.name}</h3><span className="customer-category-pill">{product.category}</span><strong>Rs. {product.price.toLocaleString()}</strong><p className="customer-stock"><i /> In Stock ({product.quantity})</p></div></article>
            ))}
          </div><button className="customer-rail-button customer-rail-next" type="button" aria-label="Next parts" onClick={() => document.querySelector('.customer-product-rail')?.scrollBy({ left: 320, behavior: 'smooth' })}><ChevronRight size={19} /></button></div>
        </section>

        <section style={styles.actions}><div><p style={styles.kicker}>TECHNICIAN BOOKING</p><h2>Choose a repair time</h2><p style={styles.muted}>Book an available time slot with Technician 1 or Technician 2.</p></div><button onClick={() => setShowRepair(true)} style={styles.primaryButton}><Calendar size={17} /> Book technician</button></section>
      </main>

      {showRepair && <Modal title="Book a repair appointment" onClose={() => setShowRepair(false)}>
        <form onSubmit={submitRepair}>
          <label style={styles.label}>Vehicle model
            <input required value={repair.vehicleModel} onChange={event => updateRepairField('vehicleModel', event.target.value)} onBlur={() => setFieldErrors(validateRepairFields())} style={{ ...styles.input, borderColor: fieldErrors.vehicleModel ? '#f87171' : undefined }} />
            {fieldErrors.vehicleModel && <small style={{ display: 'block', color: '#fca5a5', marginTop: '0.35rem' }}>{fieldErrors.vehicleModel}</small>}
          </label>
          <label style={styles.label}>License plate
            <input required value={repair.licensePlate} onChange={event => updateRepairField('licensePlate', event.target.value)} onBlur={() => setFieldErrors(validateRepairFields())} style={{ ...styles.input, borderColor: fieldErrors.licensePlate ? '#f87171' : undefined }} />
            {fieldErrors.licensePlate && <small style={{ display: 'block', color: '#fca5a5', marginTop: '0.35rem' }}>{fieldErrors.licensePlate}</small>}
          </label>
          <label style={styles.label}>Problem description
            <textarea required value={repair.issueDescription} onChange={event => updateRepairField('issueDescription', event.target.value)} onBlur={() => setFieldErrors(validateRepairFields())} style={{ ...styles.input, minHeight: '80px', borderColor: fieldErrors.issueDescription ? '#f87171' : undefined }} />
            {fieldErrors.issueDescription && <small style={{ display: 'block', color: '#fca5a5', marginTop: '0.35rem' }}>{fieldErrors.issueDescription}</small>}
          </label>
          <label style={styles.label}>Technician
            <select required value={repair.technician} onChange={event => {
              updateRepairField('technician', event.target.value);
              if (event.target.value) {
                setAvailability({ ...emptyAvailability, loading: false });
              }
            }} style={{ ...styles.input, borderColor: fieldErrors.technician ? '#f87171' : undefined }}>
              <option value="">Choose Technician 1 or 2</option>
              {technicians.map(technician => <option key={technician._id} value={technician._id}>{technician.name} · {technician.status}</option>)}
            </select>
            {fieldErrors.technician && <small style={{ display: 'block', color: '#fca5a5', marginTop: '0.35rem' }}>{fieldErrors.technician}</small>}
          </label>
          <label style={styles.label}>Appointment date
            <input required type="date" min={today} value={repair.appointmentDate} onChange={event => updateRepairField('appointmentDate', event.target.value)} onBlur={() => setFieldErrors(validateRepairFields())} style={{ ...styles.input, borderColor: fieldErrors.appointmentDate ? '#f87171' : undefined }} />
            {fieldErrors.appointmentDate && <small style={{ display: 'block', color: '#fca5a5', marginTop: '0.35rem' }}>{fieldErrors.appointmentDate}</small>}
          </label>
          {availability.loading && <p className="booking-hint">Checking public holidays and available times…</p>}
          {availability.holiday && <p role="alert" style={styles.error}>No bookings on {availability.holiday.name}, a Sri Lankan public holiday.</p>}
          {availability.error && <p role="alert" style={styles.error}>{availability.error}</p>}
          <label style={styles.label}>Available one-hour time slot
            <select required value={repair.appointmentTime} disabled={!repair.appointmentDate || !repair.technician || availability.loading || Boolean(availability.holiday) || Boolean(availability.error)} onChange={event => updateRepairField('appointmentTime', event.target.value)} onBlur={() => setFieldErrors(validateRepairFields())} style={{ ...styles.input, borderColor: fieldErrors.appointmentTime ? '#f87171' : undefined }}>
              <option value="">Select a time slot</option>
              {availability.availableTimes.map(time => <option key={time} value={time}>{formatTimeSlot(time)}</option>)}
            </select>
            {fieldErrors.appointmentTime && <small style={{ display: 'block', color: '#fca5a5', marginTop: '0.35rem' }}>{fieldErrors.appointmentTime}</small>}
          </label>
          <p className="booking-hint">One-hour appointments start hourly from 9:00 a.m. to 4:00 p.m. The workshop is open until 5:30 p.m. on Sri Lankan working days.</p>
          {!availability.loading && !availability.holiday && repair.appointmentDate && repair.technician && availability.availableTimes.length === 0 && <p className="booking-hint">No appointment times are available for this date. Please choose another date.</p>}
          {bookingError && <p role="alert" style={styles.error}>{bookingError}</p>}
          <button type="submit" disabled={availability.loading || Boolean(availability.holiday) || Boolean(availability.error)} style={styles.primaryButton}>Request repair time</button>
        </form>
      </Modal>}
    </div>
  );
};

const Modal = ({ title, onClose, children }) => <div style={styles.overlay}><div style={styles.modal}><button onClick={onClose} style={styles.close}><X size={18} /></button><h2>{title}</h2>{children}</div></div>;

const styles = {
  page: { minHeight: '100vh', background: '#080d18', color: '#f8fafc' }, header: { minHeight: '68px', padding: '0 5vw', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#0c1322' }, brand: { display: 'flex', alignItems: 'center', gap: '0.7rem', fontSize: '1.05rem' }, brandIcon: { display: 'grid', placeItems: 'center', width: '34px', height: '34px', borderRadius: '9px', background: '#3b82f6' }, portal: { color: '#60a5fa', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }, user: { display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#cbd5e1', fontSize: '0.88rem' }, logout: { display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.8rem', padding: '0.5rem 0.7rem', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }, main: { maxWidth: '1180px', margin: '0 auto', padding: '2rem 5vw' }, hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2.2rem', background: 'linear-gradient(120deg, #102b52, #101827)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '14px', marginBottom: '2.5rem' }, heroMark: { display: 'grid', placeItems: 'center', width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }, kicker: { margin: 0, color: '#60a5fa', fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700 }, subtle: { color: '#9aa8bd', lineHeight: 1.6, maxWidth: '620px' }, sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', marginBottom: '1rem' }, search: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.9rem', minWidth: '280px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', background: '#101827', color: '#8492a8' }, partsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.8rem', marginBottom: '2.5rem' }, partCard: { display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem', background: '#101827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }, partIcon: { display: 'grid', placeItems: 'center', width: '42px', height: '42px', borderRadius: '8px', background: 'rgba(16,185,129,0.14)', color: '#34d399' }, price: { display: 'block', marginTop: '0.35rem', color: '#f8fafc' }, muted: { color: '#8b99ad', fontSize: '0.84rem', margin: '0.3rem 0' }, actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }, actionButtons: { display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }, primaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: 'none', borderRadius: '7px', padding: '0.65rem 0.85rem', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600 }, secondaryButton: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(96,165,250,0.45)', borderRadius: '7px', padding: '0.65rem 0.85rem', background: 'transparent', color: '#93c5fd', cursor: 'pointer' }, success: { padding: '0.8rem 1rem', marginBottom: '1rem', color: '#86efac', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px' }, error: { padding: '0.8rem 1rem', marginBottom: '1rem', color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }, empty: { gridColumn: '1 / -1', padding: '2rem', color: '#8b99ad', textAlign: 'center' }, overlay: { position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.7)' }, modal: { position: 'relative', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto', padding: '1.5rem', borderRadius: '12px', background: '#111b2d', border: '1px solid rgba(255,255,255,0.12)' }, close: { position: 'absolute', top: '1rem', right: '1rem', display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', color: '#a8b3c5', cursor: 'pointer' }, label: { display: 'grid', gap: '0.4rem', margin: '0.8rem 0', color: '#b8c4d5', fontSize: '0.85rem' }, input: { boxSizing: 'border-box', width: '100%', padding: '0.7rem', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.13)', background: '#0c1322', color: '#f8fafc' }, cartRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }, quantity: { width: '25px', height: '25px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', background: 'transparent', color: '#f8fafc', cursor: 'pointer' }
};

export default CustomerDashboard;
