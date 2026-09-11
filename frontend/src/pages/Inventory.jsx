import React, { useState, useEffect } from 'react';
import { getProducts, createProduct, deleteProduct, updateProduct } from '../services/api';
import { AlertCircle, Edit, Plus, Trash2 } from 'lucide-react';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [formData, setFormData] = useState({ name: '', category: '', price: '', quantity: '', lowStockThreshold: 5, image: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        quantity: Number(formData.quantity)
      };
      if (editingProduct) await updateProduct(editingProduct._id, payload);
      else await createProduct(payload);
      setShowModal(false);
      setEditingProduct(null);
      setFormData({ name: '', category: '', price: '', quantity: '', lowStockThreshold: 5, image: '' });
      fetchProducts();
    } catch (err) {
      console.error(err);
      setSaveError(err.message || 'Could not save this part.');
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setSaveError('');
    setFormData({ name: '', category: '', price: '', quantity: '', lowStockThreshold: 5, image: '' });
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setSaveError('');
    setFormData({ name: product.name, category: product.category, price: product.price, quantity: product.quantity, lowStockThreshold: product.lowStockThreshold, image: product.image || '' });
    setShowModal(true);
  };

  const removeProduct = async (id) => {
    if (!window.confirm('Delete this part?')) return;
    await deleteProduct(id);
    fetchProducts();
  };

  const lowStockCount = products.filter(p => p.quantity <= p.lowStockThreshold).length;

  return (
    <div>
      {/* Metrics Row */}
      <div className="flex gap-4 mb-6">
        <div className="card" style={{ flex: 1 }}>
          <h3 className="mb-2" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Items</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{products.length}</div>
        </div>
        <div className="card" style={{ flex: 1, borderLeft: lowStockCount > 0 ? '4px solid var(--danger)' : '' }}>
          <h3 className="mb-2" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Low Stock Alerts</h3>
          <div className="flex align-center gap-2" style={{ fontSize: '2rem', fontWeight: 'bold', color: lowStockCount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            {lowStockCount > 0 && <AlertCircle size={24} />}
            {lowStockCount}
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex justify-between align-center mb-4">
          <h3>Inventory Management</h3>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> Add Part
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price (LKR)</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="7">No parts found.</td></tr>
              ) : (
                products.map(product => (
                  <tr key={product._id}>
                    <td>{product.image ? <img src={product.image} alt={product.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} /> : <span style={{ color: 'var(--text-muted)' }}>No image</span>}</td>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.price.toLocaleString()}</td>
                    <td>{product.quantity}</td>
                    <td>
                      {product.quantity <= product.lowStockThreshold ? (
                        <span className="badge badge-danger">Low Stock</span>
                      ) : (
                        <span className="badge badge-success">In Stock</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn" title="Edit part" onClick={() => openEdit(product)}><Edit size={16} /></button>
                        <button className="btn" title="Delete part" onClick={() => removeProduct(product._id)}><Trash2 size={16} /></button>
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
            <h3 className="mb-4">{editingProduct ? 'Edit Auto Part' : 'Add New Auto Part'}</h3>
            {saveError && <div className="mb-4" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.875rem' }}>{saveError}</div>}
            <form onSubmit={handleSubmit} className="flex" style={{ flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Part Name</label>
                <input required className="input" type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Category</label>
                <input required className="input" type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Part Image</label>
                <input className="input" type="file" accept="image/*" onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { window.alert('Please choose an image smaller than 5 MB.'); e.target.value = ''; return; }
                  const reader = new FileReader();
                  reader.onload = () => setFormData(current => ({ ...current, image: reader.result }));
                  reader.readAsDataURL(file);
                }} />
                {formData.image && <img src={formData.image} alt="Part preview" style={{ marginTop: '0.75rem', width: '96px', height: '72px', objectFit: 'cover', borderRadius: '6px' }} />}
              </div>
              <div className="flex gap-4">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Price (LKR)</label>
                  <input required className="input" type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Quantity</label>
                  <input required className="input" type="number" min="0" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }} onClick={() => { setShowModal(false); setEditingProduct(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">{editingProduct ? 'Update Part' : 'Save Part'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
