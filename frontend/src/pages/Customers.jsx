import React, { useState, useEffect } from 'react';
import { Car, Edit, Plus, Trash2, X } from 'lucide-react';
import { validateCustomerForm } from '../utils/repairFormValidation';

const API_BASE_URL = 'http://localhost:5000/api';
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` });
const blankCustomer = { name: '', phone: '', email: '', address: '', vehicles: [] };
const blankVehicle = { licensePlate: '', make: '', model: '', year: '' };

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState(blankCustomer);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const res = await fetch(`${API_BASE_URL}/customers`, { headers: authHeaders() });
    const data = await res.json();
    setCustomers(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const errors = validateCustomerForm(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const response = await fetch(`${API_BASE_URL}/customers${editingCustomer ? `/${editingCustomer._id}` : ''}`, {
      method: editingCustomer ? 'PUT' : 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        ...formData,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        vehicles: formData.vehicles.map(vehicle => ({
          ...vehicle,
          licensePlate: vehicle.licensePlate.trim().toUpperCase(),
          make: vehicle.make.trim(),
          model: vehicle.model.trim(),
          year: Number(vehicle.year)
        }))
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setFormError(data.error || 'Could not save customer.');
      return;
    }
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(blankCustomer);
    setFieldErrors({});
    fetchCustomers();
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setFormData(blankCustomer);
    setFieldErrors({});
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      vehicles: (customer.vehicles || []).map(vehicle => ({
        ...vehicle,
        year: vehicle.year ? String(vehicle.year) : ''
      }))
    });
    setFieldErrors({});
    setFormError('');
    setShowModal(true);
  };

  const deleteCustomer = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    await fetch(`${API_BASE_URL}/customers/${id}`, { method: 'DELETE', headers: authHeaders() });
    fetchCustomers();
  };

  const updateField = (field, value) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    if (Object.keys(fieldErrors).length) setFieldErrors(validateCustomerForm(next));
  };

  const updateVehicle = (index, field, value) => {
    const next = {
      ...formData,
      vehicles: formData.vehicles.map((vehicle, vehicleIndex) =>
        vehicleIndex === index ? { ...vehicle, [field]: value } : vehicle
      )
    };
    setFormData(next);
    if (Object.keys(fieldErrors).length) setFieldErrors(validateCustomerForm(next));
  };

  const addVehicle = () => setFormData(current => ({
    ...current,
    vehicles: [...current.vehicles, { ...blankVehicle }]
  }));

  const removeVehicle = index => {
    const next = {
      ...formData,
      vehicles: formData.vehicles.filter((_, vehicleIndex) => vehicleIndex !== index)
    };
    setFormData(next);
    setFieldErrors(validateCustomerForm(next));
  };

  return (
    <div>
      <div className="flex justify-between align-center mb-6">
        <h3>Customer Management</h3>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> Add Customer
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Vehicles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan="6">No customers found.</td></tr>
              ) : (
                customers.map(c => (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.email || 'N/A'}</td>
                    <td>{c.address || 'N/A'}</td>
                    <td>
                      {(c.vehicles || []).length
                        ? c.vehicles.map(vehicle => (
                          <div key={`${c._id}-${vehicle.licensePlate}`}>
                            {vehicle.make ? `${vehicle.make} ` : ''}{vehicle.model} · {vehicle.licensePlate}{vehicle.year ? ` (${vehicle.year})` : ''}
                          </div>
                        ))
                        : 'No vehicles'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn" title="Edit customer" onClick={() => openEdit(c)}><Edit size={16} /></button>
                        <button className="btn" title="Delete customer" onClick={() => deleteCustomer(c._id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="mb-4">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
            <form noValidate onSubmit={handleSubmit} className="flex" style={{ flexDirection: 'column', gap: '1rem' }}>
              <div>
                <input required className={`input${fieldErrors.name ? ' input-validation-error' : ''}`} placeholder="Name" value={formData.name} onChange={e => updateField('name', e.target.value)} aria-invalid={Boolean(fieldErrors.name)} />
                {fieldErrors.name && <small className="field-validation-error">{fieldErrors.name}</small>}
              </div>
              <div>
                <input required className={`input${fieldErrors.phone ? ' input-validation-error' : ''}`} placeholder="Phone" value={formData.phone} onChange={e => updateField('phone', e.target.value)} aria-invalid={Boolean(fieldErrors.phone)} />
                {fieldErrors.phone && <small className="field-validation-error">{fieldErrors.phone}</small>}
              </div>
              <div>
                <input className={`input${fieldErrors.email ? ' input-validation-error' : ''}`} type="email" placeholder="Email (Optional)" value={formData.email} onChange={e => updateField('email', e.target.value)} aria-invalid={Boolean(fieldErrors.email)} />
                {fieldErrors.email && <small className="field-validation-error">{fieldErrors.email}</small>}
              </div>
              <div>
                <textarea className={`input${fieldErrors.address ? ' input-validation-error' : ''}`} placeholder="Address (Optional)" rows="2" value={formData.address} onChange={e => updateField('address', e.target.value)} aria-invalid={Boolean(fieldErrors.address)} />
                {fieldErrors.address && <small className="field-validation-error">{fieldErrors.address}</small>}
              </div>
              <div>
                <div className="flex justify-between align-center mb-3">
                  <h4><Car size={16} /> Vehicles</h4>
                  <button type="button" className="btn" onClick={addVehicle}><Plus size={16} /> Add vehicle</button>
                </div>
                {formData.vehicles.map((vehicle, index) => (
                  <div key={index} className="customer-vehicle-editor">
                    <div>
                      <input required className={`input${fieldErrors[`vehicles.${index}.licensePlate`] ? ' input-validation-error' : ''}`} placeholder="Registration (AB-1234)" value={vehicle.licensePlate} onChange={event => updateVehicle(index, 'licensePlate', event.target.value)} aria-invalid={Boolean(fieldErrors[`vehicles.${index}.licensePlate`])} />
                      {fieldErrors[`vehicles.${index}.licensePlate`] && <small className="field-validation-error">{fieldErrors[`vehicles.${index}.licensePlate`]}</small>}
                    </div>
                    <div>
                      <input required className={`input${fieldErrors[`vehicles.${index}.model`] ? ' input-validation-error' : ''}`} placeholder="Model" value={vehicle.model} onChange={event => updateVehicle(index, 'model', event.target.value)} aria-invalid={Boolean(fieldErrors[`vehicles.${index}.model`])} />
                      {fieldErrors[`vehicles.${index}.model`] && <small className="field-validation-error">{fieldErrors[`vehicles.${index}.model`]}</small>}
                    </div>
                    <div>
                      <input required className={`input${fieldErrors[`vehicles.${index}.year`] ? ' input-validation-error' : ''}`} type="number" min="1900" max={new Date().getFullYear() + 1} placeholder="Year" value={vehicle.year} onChange={event => updateVehicle(index, 'year', event.target.value)} aria-invalid={Boolean(fieldErrors[`vehicles.${index}.year`])} />
                      {fieldErrors[`vehicles.${index}.year`] && <small className="field-validation-error">{fieldErrors[`vehicles.${index}.year`]}</small>}
                    </div>
                    <button type="button" className="btn" aria-label={`Remove vehicle ${index + 1}`} onClick={() => removeVehicle(index)}><X size={16} /></button>
                  </div>
                ))}
              </div>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              
              <div className="flex justify-between mt-4">
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }} onClick={() => { setShowModal(false); setEditingCustomer(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingCustomer ? 'Update Customer' : 'Save Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
