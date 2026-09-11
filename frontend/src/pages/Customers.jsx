import React, { useState, useEffect } from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` });

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });

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
    await fetch(`${API_BASE_URL}/customers${editingCustomer ? `/${editingCustomer._id}` : ''}`, {
      method: editingCustomer ? 'PUT' : 'POST',
      headers: authHeaders(),
      body: JSON.stringify(formData)
    });
    setShowModal(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '' });
    fetchCustomers();
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '' });
    setShowModal(true);
  };

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, phone: customer.phone, email: customer.email || '', address: customer.address || '' });
    setShowModal(true);
  };

  const deleteCustomer = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    await fetch(`${API_BASE_URL}/customers/${id}`, { method: 'DELETE', headers: authHeaders() });
    fetchCustomers();
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan="4">No customers found.</td></tr>
              ) : (
                customers.map(c => (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.email || 'N/A'}</td>
                    <td>{c.address || 'N/A'}</td>
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
          <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
            <h3 className="mb-4">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
            <form onSubmit={handleSubmit} className="flex" style={{ flexDirection: 'column', gap: '1rem' }}>
              <input required className="input" placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input required className="input" placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <input className="input" type="email" placeholder="Email (Optional)" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <textarea className="input" placeholder="Address (Optional)" rows="2" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              
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
