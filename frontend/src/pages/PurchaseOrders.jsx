import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Search, Trash2, X } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';
const emptyItem = { product: null, productName: '', category: '', quantity: 1, unitPrice: '' };
const statuses = ['Pending', 'Ordered', 'Partially Received', 'Received', 'Rejected'];
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` });

const PurchaseOrders = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const reorderApplied = useRef(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [supplier, setSupplier] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [productSearch, setProductSearch] = useState('');
  const [status, setStatus] = useState('Pending');
  const [error, setError] = useState('');
  const [emailNotice, setEmailNotice] = useState(null);
  const [retryingOrderId, setRetryingOrderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reorderNotice, setReorderNotice] = useState('');

  const loadData = async () => {
    try {
      const headers = authHeaders();
      const [supplierResponse, productResponse, orderResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/suppliers`, { headers }), fetch(`${API_BASE_URL}/products`, { headers }), fetch(`${API_BASE_URL}/purchase-orders`, { headers })
      ]);
      if (!supplierResponse.ok || !productResponse.ok || !orderResponse.ok) throw new Error('Unable to load purchase order data');
      setSuppliers(await supplierResponse.json()); setProducts(await productResponse.json()); setOrders(await orderResponse.json());
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const reorder = location.state?.reorder;
    if (!reorder || loading || reorderApplied.current) return;
    const product = products.find(item => item._id === reorder.productId);
    if (product) {
      setItems([{
        ...emptyItem,
        product,
        productName: product.name,
        category: product.category,
        quantity: Math.max(1, Number(reorder.quantity) || 1),
        unitPrice: product.costPrice ?? product.price
      }]);
      setReorderNotice(reorder.quantity > 0
        ? `${product.name} is prefilled using the model's suggested quantity.`
        : `${product.name} is prefilled; the model suggested no immediate reorder, so review the quantity.`);
    } else {
      setReorderNotice(`${reorder.productName} is not in your live inventory. Select a product manually.`);
    }
    reorderApplied.current = true;
    navigate(location.pathname, { replace: true, state: null });
  }, [loading, location, navigate, products]);

  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return query ? products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(query)) : products;
  }, [productSearch, products]);

  const selectProduct = (index, product) => {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, product, productName: product.name, category: product.category, unitPrice: product.price } : item));
    setProductSearch('');
  };
  const updateItem = (index, field, value) => setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = index => setItems(items.filter((_, itemIndex) => itemIndex !== index));

  const createOrder = async event => {
    event.preventDefault(); setError(''); setEmailNotice(null);
    if (!supplier || items.some(item => !item.product || Number(item.quantity) < 1 || Number(item.unitPrice) < 0)) { setError('Choose a supplier and complete every item with a product, quantity, and unit price.'); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-orders`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ supplier, orderDate, status, orderNumber: `PO-${Date.now()}`, items: items.map(item => ({ product: item.product._id, productName: item.productName, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to create purchase order');
      setEmailNotice(data.emailStatus || { sent: false, error: 'Email status was not returned by the backend. Restart the backend and try again.' });
      setItems([{ ...emptyItem }]); setSupplier(''); setStatus('Pending'); setProductSearch(''); await loadData();
    } catch (err) { setError(err.message); }
  };
  const retryOrderEmail = async order => {
    setRetryingOrderId(order._id); setEmailNotice(null); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-orders/${order._id}/email`, { method: 'POST', headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.emailStatus?.error || data.error || 'Unable to send purchase order email');
      setEmailNotice(data.emailStatus);
      await loadData();
    } catch (err) {
      setEmailNotice({ sent: false, error: err.message, orderNumber: order.orderNumber });
    } finally {
      setRetryingOrderId(null);
    }
  };
  const changeStatus = async (id, nextStatus) => { await fetch(`${API_BASE_URL}/purchase-orders/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: nextStatus }) }); loadData(); };
  const money = value => `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return <div className="purchase-page">
    <div className="purchase-heading"><div><div className="eyebrow"><ClipboardList size={16} /> Procurement workspace</div><h3>Purchase Orders</h3><p className="page-subtitle">Create and track parts orders for your supplier network.</p></div><div className="supplier-count"><strong>{orders.length}</strong><span>orders</span></div></div>
    {error && <p className="form-error purchase-error" role="alert">{error}</p>}
    {reorderNotice && <p className="purchase-reorder-notice" role="status">{reorderNotice}</p>}
    {emailNotice && <div className={`invoice-email-status ${emailNotice.sent ? 'sent' : 'failed'}`} role={emailNotice.sent ? 'status' : 'alert'}><span>{emailNotice.sent ? `Purchase order email sent to ${emailNotice.to}.` : `Purchase order${emailNotice.orderNumber ? ` ${emailNotice.orderNumber}` : ''} created, but email was not sent: ${emailNotice.error}`}</span></div>}
    <section className="card purchase-create-card"><div className="section-heading"><span className="section-icon"><Plus size={18} /></span><div><h4>Create purchase order</h4><p>Choose a supplier, then add the parts and quantities required.</p></div></div><form onSubmit={createOrder}>
      <div className="purchase-top-fields"><label>Supplier<select required className="input" value={supplier} onChange={event => setSupplier(event.target.value)}><option value="">Select supplier</option>{suppliers.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label>Purchase order date<input required type="date" className="input" value={orderDate} onChange={event => setOrderDate(event.target.value)} /></label></div>
      <div className="items-heading"><div><h4>Order items</h4><p>Select multiple auto parts for this order.</p></div><button type="button" className="btn btn-outline" onClick={addItem}><Plus size={16} /> Add item</button></div>
      <div className="purchase-items">{items.map((item, index) => <div className="purchase-item-row" key={index}><div className="product-picker"><label>Product</label>{item.product ? <div className="selected-product"><span><strong>{item.productName}</strong><small>{item.category}</small></span><button type="button" className="icon-button" title="Change product" onClick={() => updateItem(index, 'product', null)}><X size={15} /></button></div> : <><div className="supplier-search product-search"><Search size={16} /><input required value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Search product or category" /></div>{productSearch && <div className="product-results">{filteredProducts.map(product => <button type="button" key={product._id} onClick={() => selectProduct(index, product)}><strong>{product.name}</strong><span>{product.category} · Stock {product.quantity}</span></button>)}</div>}</>}</div><label>Quantity<input required min="1" type="number" className="input" value={item.quantity} onChange={event => updateItem(index, 'quantity', event.target.value)} /></label><label>Unit purchase price<input required min="0" step="0.01" type="number" className="input" value={item.unitPrice} onChange={event => updateItem(index, 'unitPrice', event.target.value)} placeholder="0.00" /></label><div className="item-subtotal"><span>Subtotal</span><strong>{money(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</strong></div><button type="button" className="icon-button danger" title="Remove item" disabled={items.length === 1} onClick={() => removeItem(index)}><Trash2 size={17} /></button></div>)}</div>
      <div className="purchase-submit"><div><span>Total purchase amount</span><strong>{money(subtotal)}</strong></div><button type="submit" className="btn btn-primary">Create Purchase Order</button></div>
    </form></section>
    <section className="card purchase-history-card"><div className="list-heading"><div><h4>Purchase order history</h4><p>Orders are automatically visible to their selected supplier.</p></div></div><div className="table-container"><table><thead><tr><th>Purchase Order ID</th><th>Supplier</th><th>Items</th><th>Amount</th><th>Date</th><th>Supplier email</th><th>Status</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="empty-state">Loading orders...</td></tr> : orders.length === 0 ? <tr><td colSpan="7" className="empty-state">No purchase orders created yet.</td></tr> : orders.map(order => <tr key={order._id}><td><strong>{order.orderNumber}</strong></td><td>{order.supplier?.name || 'Unknown supplier'}</td><td>{order.items.map(item => <span className="order-line" key={`${order._id}-${item.productName}`}>{item.productName} × {item.quantity}</span>)}</td><td>{money(order.total)}</td><td>{new Date(order.orderDate).toLocaleDateString()}</td><td>{order.supplierEmailSent ? <span>Sent{order.supplierEmailSentAt ? ` ${new Date(order.supplierEmailSentAt).toLocaleDateString()}` : ''}</span> : <button type="button" className="btn btn-outline" onClick={() => retryOrderEmail(order)} disabled={retryingOrderId === order._id}>{retryingOrderId === order._id ? 'Sending...' : 'Retry email'}</button>}</td><td><select className={`status-select status-${order.status.toLowerCase().replaceAll(' ', '-')}`} value={order.status} onChange={event => changeStatus(order._id, event.target.value)}>{statuses.map(item => <option key={item}>{item}</option>)}</select></td></tr>)}</tbody></table></div></section>
  </div>;
};
export default PurchaseOrders;
