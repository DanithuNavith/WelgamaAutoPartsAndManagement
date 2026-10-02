import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';
const emptySupplier = { name: '', contactPerson: '', phone: '', email: '', address: '', password: '' };
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` });

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState(emptySupplier);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingWelcomeEmail, setPendingWelcomeEmail] = useState(null);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to load suppliers');
      setSuppliers(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const visibleSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(query) || supplier.phone.toLowerCase().includes(query)
    );
  }, [search, suppliers]);

  const updateField = (event) => setFormData(current => ({ ...current, [event.target.name]: event.target.value }));

  const resetForm = () => {
    setFormData(emptySupplier);
    setEditingSupplier(null);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!editingSupplier && formData.password.length < 8) {
      setError('Supplier login password must be at least 8 characters.');
      return;
    }

    try {
      const payload = editingSupplier ? { ...formData, password: '' } : { ...formData };
      const response = await fetch(`${API_BASE_URL}/suppliers${editingSupplier ? `/${editingSupplier._id}` : ''}`, {
        method: editingSupplier ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save supplier');
      if (!editingSupplier && !data.emailStatus?.sent) {
        setPendingWelcomeEmail({ supplierId: data._id, email: data.email, password: payload.password });
      } else {
        setPendingWelcomeEmail(null);
      }
      resetForm();
      if (!editingSupplier) {
        setSuccess(data.emailStatus?.sent
          ? `Supplier account created. Welcome email sent to ${data.email}. Their password is in the attached protected PDF.`
          : `Supplier account created, but the welcome email could not be sent: ${data.emailStatus?.error || 'Email status was not returned.'}`);
      }
      await fetchSuppliers();
    } catch (err) {
      setError(err.message);
    }
  };

  const retryWelcomeEmail = async () => {
    if (!pendingWelcomeEmail) return;
    setRetryingEmail(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers/${pendingWelcomeEmail.supplierId}/welcome-email`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ password: pendingWelcomeEmail.password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send the welcome email');
      setPendingWelcomeEmail(null);
      setSuccess(`Welcome email sent to ${data.emailStatus.to}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setRetryingEmail(false);
    }
  };

  const startEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      password: ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSupplier = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to delete supplier');
      await fetchSuppliers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="supplier-page">
      <div className="supplier-page-heading">
        <div>
          <div className="eyebrow"><Building2 size={16} /> Supplier directory</div>
          <h3>Supplier Management</h3>
          <p className="page-subtitle">Keep your parts network organized and easy to reach.</p>
        </div>
        <div className="supplier-count"><strong>{suppliers.length}</strong><span>suppliers</span></div>
      </div>

      <div className="supplier-layout">
        <section className="card supplier-form-card">
          <div className="section-heading"><span className="section-icon"><Plus size={18} /></span><div><h4>{editingSupplier ? 'Edit supplier' : 'Add supplier'}</h4><p>Record the supplier's primary contact details.</p></div></div>
          <form onSubmit={handleSubmit} className="supplier-form">
            <label>Supplier Name<input required name="name" className="input" value={formData.name} onChange={updateField} placeholder="e.g. Metro Auto Supplies" /></label>
            <label>Contact Person<input required name="contactPerson" className="input" value={formData.contactPerson} onChange={updateField} placeholder="e.g. Nimal Perera" /></label>
            <label>Phone Number<input required name="phone" className="input" pattern="[0-9+() -]{7,}" title="Enter a valid phone number" value={formData.phone} onChange={updateField} placeholder="e.g. +94 77 123 4567" /></label>
            <label>Email<input required name="email" type="email" className="input" value={formData.email} onChange={updateField} placeholder="supplier@example.com" /></label>
            {!editingSupplier && (
              <label>Supplier login password<input required minLength="8" name="password" type="password" autoComplete="new-password" className="input" value={formData.password} onChange={updateField} placeholder="At least 8 characters" /></label>
            )}
            <label>Address<textarea required name="address" className="input" rows="3" value={formData.address} onChange={updateField} placeholder="Street, city, country" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            {success && <p className="supplier-save-success" role="status">{success}</p>}
            {pendingWelcomeEmail && <div className="form-actions"><button type="button" className="btn btn-outline" onClick={retryWelcomeEmail} disabled={retryingEmail}>{retryingEmail ? 'Sending...' : `Retry welcome email to ${pendingWelcomeEmail.email}`}</button></div>}
            <div className="form-actions"><button type="submit" className="btn btn-primary">{editingSupplier ? 'Update Supplier' : 'Save Supplier'}</button>{editingSupplier && <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>}</div>
          </form>
        </section>

        <section className="card supplier-list-card">
          <div className="list-heading"><div><h4>Supplier list</h4><p>Search by supplier name or phone number.</p></div><div className="supplier-search"><Search size={17} /><input aria-label="Search suppliers" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search suppliers..." /></div></div>
          <div className="table-container supplier-table-wrap">
            <table><thead><tr><th>Supplier Name</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>Orders</th><th>Actions</th></tr></thead><tbody>
              {loading ? <tr><td colSpan="6" className="empty-state">Loading suppliers...</td></tr> : visibleSuppliers.length === 0 ? <tr><td colSpan="6" className="empty-state">{search ? 'No suppliers match your search.' : 'No suppliers added yet.'}</td></tr> : visibleSuppliers.map(supplier => <tr key={supplier._id}><td><strong>{supplier.name}</strong></td><td>{supplier.contactPerson}</td><td>{supplier.phone}</td><td>{supplier.email}</td><td><span className="order-summary">{supplier.orderCount || 0} total · {supplier.activeOrderCount || 0} active</span></td><td><div className="table-actions"><button className="icon-button" title="View supplier" onClick={() => setViewingSupplier(supplier)}><Eye size={16} /></button><button className="icon-button" title="Edit supplier" onClick={() => startEdit(supplier)}><Pencil size={16} /></button><button className="icon-button danger" title="Delete supplier" onClick={() => deleteSupplier(supplier._id)}><Trash2 size={16} /></button></div></td></tr>)}
            </tbody></table>
          </div>
        </section>
      </div>

      {viewingSupplier && <div className="modal-backdrop" onClick={() => setViewingSupplier(null)}><div className="card supplier-modal" onClick={event => event.stopPropagation()}><div className="modal-heading"><div><span className="section-icon"><Building2 size={18} /></span><h4>{viewingSupplier.name}</h4></div><button className="icon-button" title="Close" onClick={() => setViewingSupplier(null)}><X size={18} /></button></div><div className="supplier-details"><div><span>Contact person</span><strong>{viewingSupplier.contactPerson}</strong></div><div><span>Phone</span><strong>{viewingSupplier.phone}</strong></div><div><span>Email</span><strong>{viewingSupplier.email}</strong></div><div><span>Address</span><strong>{viewingSupplier.address}</strong></div><div><span>Order history</span><strong>{viewingSupplier.orderCount || 0} total · {viewingSupplier.activeOrderCount || 0} active</strong></div></div></div></div>}
    </div>
  );
};

export default Suppliers;
