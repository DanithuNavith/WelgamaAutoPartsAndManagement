import React, { useCallback, useEffect, useState } from 'react';
import { Edit, Plus, Trash2, X } from 'lucide-react';
import { API_BASE_URL } from '../services/apiBase';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  specialty: '',
  hourlyRate: '1000',
  status: 'Available'
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`
});

const TechnicianProfiles = () => {
  const [technicians, setTechnicians] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTechnicians = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/technicians/management`, { headers: getHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || `Could not load technician profiles (HTTP ${response.status}).`);
      if (!Array.isArray(data)) throw new Error('The server returned an unexpected technician list.');
      setTechnicians(data);
      return null;
    } catch (loadError) {
      return loadError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTechnicians().then(loadError => {
      if (loadError) setError(loadError.message);
    });
  }, [loadTechnicians]);

  const openCreate = () => {
    setEditingTechnician(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
    setNotice('');
  };

  const openEdit = technician => {
    setEditingTechnician(technician);
    setForm({
      name: technician.name || '',
      email: technician.email || '',
      phone: technician.phone || '',
      password: '',
      specialty: technician.specialty || '',
      hourlyRate: String(technician.hourlyRate ?? 0),
      status: technician.status || 'Available'
    });
    setShowForm(true);
    setError('');
    setNotice('');
  };

  const updateField = event => {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const submitForm = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = { ...form, hourlyRate: Number(form.hourlyRate) };
      if (editingTechnician && !payload.password) delete payload.password;
      const response = await fetch(
        `${API_BASE_URL}/technicians${editingTechnician ? `/${editingTechnician._id}` : ''}`,
        {
          method: editingTechnician ? 'PUT' : 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || `Could not save technician (HTTP ${response.status}).`);
      setShowForm(false);
      setEditingTechnician(null);
      setNotice(editingTechnician ? 'Technician profile updated.' : 'Technician profile and login created.');
      const loadError = await loadTechnicians();
      if (loadError) setError(loadError.message);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTechnician = async technician => {
    if (!window.confirm(`Delete ${technician.name}'s profile and login account?`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/technicians/${technician._id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || `Could not delete technician (HTTP ${response.status}).`);
      setNotice('Technician profile and login deleted.');
      const loadError = await loadTechnicians();
      if (loadError) setError(loadError.message);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <section>
      <div className="flex justify-between align-center mb-6">
        <div>
          <h3>Technician Profiles</h3>
          <p className="text-muted">Create staff profiles and manage their login accounts, specialties, rates, and availability.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openCreate}><Plus size={18} /> Add Technician</button>
      </div>

      {error && <div className="form-error mb-4" role="alert">{error}</div>}
      {notice && <div className="success-message mb-4" role="status">{notice}</div>}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Name</th><th>Login email</th><th>Phone</th><th>Specialty</th><th>Hourly rate</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="7">Loading technician profiles…</td></tr> : technicians.length === 0 ? <tr><td colSpan="7">No technician profiles found.</td></tr> : technicians.map(technician => (
                <tr key={technician._id}>
                  <td>{technician.name}</td>
                  <td>{technician.email || 'No linked login'}</td>
                  <td>{technician.phone || '—'}</td>
                  <td>{technician.specialty || 'General'}</td>
                  <td>Rs. {Number(technician.hourlyRate || 0).toLocaleString()}</td>
                  <td>{technician.status}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn" type="button" title={`Edit ${technician.name}`} onClick={() => openEdit(technician)}><Edit size={16} /></button>
                      <button className="btn" type="button" title={`Delete ${technician.name}`} onClick={() => deleteTechnician(technician)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.55)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between align-center mb-4">
              <h3>{editingTechnician ? 'Edit Technician' : 'Create Technician'}</h3>
              <button className="btn" type="button" aria-label="Close form" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitForm} className="flex" style={{ flexDirection: 'column', gap: '1rem' }}>
              <label>Name<input className="input" name="name" value={form.name} onChange={updateField} required maxLength="100" /></label>
              <label>Login email<input className="input" type="email" name="email" value={form.email} onChange={updateField} required /></label>
              <label>Phone<input className="input" type="tel" name="phone" value={form.phone} onChange={updateField} /></label>
              <label>Password{editingTechnician && <small> Leave blank to keep the current password.</small>}<input className="input" type="password" name="password" value={form.password} onChange={updateField} required={!editingTechnician} minLength="8" autoComplete="new-password" /></label>
              <label>Specialty<input className="input" name="specialty" value={form.specialty} onChange={updateField} placeholder="General" /></label>
              <label>Hourly rate (Rs.)<input className="input" type="number" name="hourlyRate" value={form.hourlyRate} onChange={updateField} min="0" step="0.01" required /></label>
              <label>Status<select className="input" name="status" value={form.status} onChange={updateField}><option>Available</option><option>Busy</option><option>Offline</option></select></label>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="flex justify-between mt-4">
                <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingTechnician ? 'Save Changes' : 'Create Profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default TechnicianProfiles;
