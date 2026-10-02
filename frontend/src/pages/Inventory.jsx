import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts, createProduct, deleteProduct, updateProduct } from '../services/api';
import { AlertCircle, BellRing, Edit, Plus, Search, Trash2, X } from 'lucide-react';
import StockAlerts from './StockAlerts';
import { validateInventoryProduct } from '../utils/inventoryValidation';

const Inventory = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('inventory');
  const [alertCount, setAlertCount] = useState(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(() => searchParams.get('action') === 'add');
  const [editingProduct, setEditingProduct] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ name: '', category: '', price: '', costPrice: '', quantity: '', lowStockThreshold: 5, image: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [searchParams]);

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
    const errors = validateInventoryProduct(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        costPrice: Number(formData.costPrice),
        quantity: Number(formData.quantity),
        lowStockThreshold: Number(formData.lowStockThreshold)
      };
      if (editingProduct) await updateProduct(editingProduct._id, payload);
      else await createProduct(payload);
      setShowModal(false);
      setEditingProduct(null);
      setFormData({ name: '', category: '', price: '', costPrice: '', quantity: '', lowStockThreshold: 5, image: '' });
      setFieldErrors({});
      fetchProducts();
    } catch (err) {
      console.error(err);
      setSaveError(err.message || 'Could not save this part.');
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setSaveError('');
    setFieldErrors({});
    setFormData({ name: '', category: '', price: '', costPrice: '', quantity: '', lowStockThreshold: 5, image: '' });
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setSaveError('');
    setFieldErrors({});
    setFormData({ name: product.name, category: product.category, price: product.price, costPrice: product.costPrice ?? '', quantity: product.quantity, lowStockThreshold: product.lowStockThreshold ?? 5, image: product.image || '' });
    setShowModal(true);
  };

  const removeProduct = async (id) => {
    if (!window.confirm('Delete this part?')) return;
    await deleteProduct(id);
    fetchProducts();
  };

  const updateFormField = (field, value) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    if (Object.keys(fieldErrors).length) setFieldErrors(validateInventoryProduct(next));
  };

  const lowStockCount = products.filter(p => p.quantity <= (p.lowStockThreshold ?? 5)).length;
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(query))
      : products;
  }, [products, search]);

  return (
    <div className="inventory-page">
      <div className="inventory-page-heading">
        <div>
          <span className="inventory-eyebrow"><BellRing size={15} /> INVENTORY CONTROL</span>
          <h2>Parts inventory</h2>
          <p>Track stock levels and act early on parts at risk.</p>
        </div>
        <span className="inventory-heading-count">{products.length} parts tracked</span>
      </div>
      <div className="inventory-tabs" role="tablist" aria-label="Inventory sections">
        <button
          id="inventory-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'inventory'}
          aria-controls="inventory-panel"
          tabIndex={activeTab === 'inventory' ? 0 : -1}
          className={activeTab === 'inventory' ? 'active' : ''}
          onClick={() => setActiveTab('inventory')}
          onKeyDown={event => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              setActiveTab('alerts');
              document.getElementById('stock-alerts-tab')?.focus();
            }
          }}
        >
          Inventory
        </button>
        <button
          id="stock-alerts-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'alerts'}
          aria-controls="stock-alerts-panel"
          tabIndex={activeTab === 'alerts' ? 0 : -1}
          className={activeTab === 'alerts' ? 'active' : ''}
          onClick={() => setActiveTab('alerts')}
          onKeyDown={event => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setActiveTab('inventory');
              document.getElementById('inventory-tab')?.focus();
            }
          }}
        >
          <BellRing size={16} /> Stock Alerts
          <span className="inventory-tab-badge">{alertCount}</span>
        </button>
      </div>
      <section id="inventory-panel" role="tabpanel" aria-labelledby="inventory-tab" hidden={activeTab !== 'inventory'}>
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

        <div className="inventory-search-row">
          <div className="supplier-search inventory-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              aria-label="Search inventory parts"
              placeholder="Search by part name or category"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            {search && (
              <button type="button" className="icon-button" title="Clear search" aria-label="Clear search" onClick={() => setSearch('')}>
                <X size={15} />
              </button>
            )}
          </div>
          <span className="inventory-search-count">
            {search ? `${filteredProducts.length} of ${products.length} parts` : `${products.length} parts`}
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Cost Price (LKR)</th>
                <th>Price (LKR)</th>
                <th>Profit / Part (LKR)</th>
                <th>Quantity</th>
                <th>Alert At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="empty-state">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="10">No parts found.</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan="10" className="empty-state">No parts match "{search}".</td></tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product._id}>
                    <td>{product.image ? <img src={product.image} alt={product.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} /> : <span style={{ color: 'var(--text-muted)' }}>No image</span>}</td>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.costPrice === undefined || product.costPrice === null ? 'Set cost price' : Number(product.costPrice).toLocaleString()}</td>
                    <td>{product.price.toLocaleString()}</td>
                    <td>{product.costPrice === undefined || product.costPrice === null ? '—' : (Number(product.price) - Number(product.costPrice)).toLocaleString()}</td>
                    <td>{product.quantity}</td>
                    <td>{product.lowStockThreshold ?? 5}</td>
                    <td>
                      {product.quantity <= (product.lowStockThreshold ?? 5) ? (
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
            <form noValidate onSubmit={handleSubmit} className="flex" style={{ flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Part Name</label>
                <input required maxLength="100" className={`input${fieldErrors.name ? ' input-validation-error' : ''}`} type="text" value={formData.name} onChange={e => updateFormField('name', e.target.value)} aria-invalid={Boolean(fieldErrors.name)} />
                {fieldErrors.name && <small className="field-validation-error">{fieldErrors.name}</small>}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Category</label>
                <input required maxLength="60" className={`input${fieldErrors.category ? ' input-validation-error' : ''}`} type="text" value={formData.category} onChange={e => updateFormField('category', e.target.value)} aria-invalid={Boolean(fieldErrors.category)} />
                {fieldErrors.category && <small className="field-validation-error">{fieldErrors.category}</small>}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Part Image</label>
                <input className={`input${fieldErrors.image ? ' input-validation-error' : ''}`} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
                    setFieldErrors(current => ({ ...current, image: 'Choose a JPEG, PNG, GIF, or WebP image.' }));
                    e.target.value = '';
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    setFieldErrors(current => ({ ...current, image: 'Image must be smaller than 5 MB.' }));
                    e.target.value = '';
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const next = { ...formData, image: reader.result };
                    setFormData(next);
                    setFieldErrors(validateInventoryProduct(next));
                  };
                  reader.onerror = () => setFieldErrors(current => ({ ...current, image: 'Could not read this image. Please choose another file.' }));
                  reader.readAsDataURL(file);
                }} />
                {fieldErrors.image && <small className="field-validation-error">{fieldErrors.image}</small>}
                {formData.image && <img src={formData.image} alt="Part preview" style={{ marginTop: '0.75rem', width: '96px', height: '72px', objectFit: 'cover', borderRadius: '6px' }} />}
              </div>
              <div className="flex gap-4">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Price (LKR)</label>
                  <input required className={`input${fieldErrors.price ? ' input-validation-error' : ''}`} type="number" min="0.01" step="0.01" value={formData.price} onChange={e => updateFormField('price', e.target.value)} aria-invalid={Boolean(fieldErrors.price)} />
                  {fieldErrors.price && <small className="field-validation-error">{fieldErrors.price}</small>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Cost Price (LKR)</label>
                  <input required className={`input${fieldErrors.costPrice ? ' input-validation-error' : ''}`} type="number" min="0" step="0.01" value={formData.costPrice} onChange={e => updateFormField('costPrice', e.target.value)} aria-invalid={Boolean(fieldErrors.costPrice)} />
                  {fieldErrors.costPrice && <small className="field-validation-error">{fieldErrors.costPrice}</small>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Quantity</label>
                  <input required className={`input${fieldErrors.quantity ? ' input-validation-error' : ''}`} type="number" min="0" step="1" value={formData.quantity} onChange={e => updateFormField('quantity', e.target.value)} aria-invalid={Boolean(fieldErrors.quantity)} />
                  {fieldErrors.quantity && <small className="field-validation-error">{fieldErrors.quantity}</small>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Low stock alert at</label>
                  <input required className={`input${fieldErrors.lowStockThreshold ? ' input-validation-error' : ''}`} type="number" min="0" step="1" value={formData.lowStockThreshold} onChange={e => updateFormField('lowStockThreshold', e.target.value)} aria-invalid={Boolean(fieldErrors.lowStockThreshold)} />
                  {fieldErrors.lowStockThreshold && <small className="field-validation-error">{fieldErrors.lowStockThreshold}</small>}
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
      </section>
      <section id="stock-alerts-panel" role="tabpanel" aria-labelledby="stock-alerts-tab" hidden={activeTab !== 'alerts'}>
        <StockAlerts active={activeTab === 'alerts'} onCountChange={setAlertCount} />
      </section>
    </div>
  );
};

export default Inventory;
