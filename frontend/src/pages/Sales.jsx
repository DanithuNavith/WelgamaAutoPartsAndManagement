import React, { useEffect, useState } from 'react';
import { BadgeDollarSign, Car, Check, ClipboardList, FileText, Printer, User } from 'lucide-react';
import { getProducts } from '../services/api';

const API = 'http://localhost:5000/api';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` });
const money = value => `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cleanVehicleText = value => String(value || '').replace(/^Not provided\s*/i, '').trim();

const Sales = () => {
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [vehicleIndex, setVehicleIndex] = useState('');
  const [manualTechnicianCost, setManualTechnicianCost] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [createdBill, setCreatedBill] = useState(null);
  const [cart, setCart] = useState([]);
  const [posSale, setPosSale] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const auth = { headers: headers() };
      const [jobResponse, customerResponse] = await Promise.all([fetch(`${API}/jobCards`, auth), fetch(`${API}/customers`, auth)]);
      const jobData = await jobResponse.json();
      setJobs(jobData.filter(job => ['COMPLETED', 'Completed'].includes(job.status)));
      setCustomers(await customerResponse.json());
      setProducts(await getProducts());
    } catch { setError('Unable to load repair billing data.'); }
  };
  useEffect(() => { load(); }, []);

  const selectedJob = jobs.find(job => job._id === selectedJobId);
  const selectedCustomer = customers.find(customer => customer._id === selectedCustomerId);
  const selectedVehicle = vehicleIndex === 'job' ? selectedJob : selectedCustomer?.vehicles?.[Number(vehicleIndex)];
  const parts = selectedJob?.partsUsed || [];
  const invoiceParts = (createdBill?.items || []).filter(item => item.productName?.toLowerCase() !== 'repair labor');
  const partsCost = parts.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || item.product?.price || 0), 0);
  const technicianCost = Number(manualTechnicianCost || 0);
  const finalTotal = partsCost + technicianCost;

  const chooseJob = event => {
    const job = jobs.find(item => item._id === event.target.value);
    setSelectedJobId(event.target.value); setSelectedCustomerId(job?.customer?._id || job?.customer || ''); setVehicleIndex('job'); setManualTechnicianCost(job?.laborCost || job?.estimatedCost || ''); setCreatedBill(null);
  };
  const createBill = async () => {
    if (!selectedJob) { setError('Select a completed repair job to create a bill.'); return; }
    setError('');
    const response = await fetch(`${API}/sales/repair/${selectedJob._id}`, { method: 'POST', headers: headers(), body: JSON.stringify({ paymentStatus, technicianCost }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Could not create the repair bill.'); return; }
    setCreatedBill(data); setJobs(current => current.map(job => job._id === selectedJob._id ? { ...job, invoice: data._id, repairCost: data.total } : job));
  };
  const addProduct = product => { if (!product.quantity) return; setCart(current => current.some(item => item.product._id === product._id) ? current : [...current, { product, quantity: 1 }]); };
  const posTotal = cart.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
  const createPosSale = async () => {
    if (!cart.length) return;
    const response = await fetch(`${API}/sales`, { method: 'POST', headers: headers(), body: JSON.stringify({ items: cart.map(item => ({ product: item.product._id, quantity: item.quantity, priceAtSale: item.product.price })), subtotal: posTotal, tax: posTotal * .15, total: posTotal * 1.15, paymentStatus: 'Paid' }) });
    if (response.ok) { setPosSale(await response.json()); setCart([]); load(); }
  };

  return <div className="sales-module">
    <div className="sales-page-heading"><div><div className="eyebrow"><BadgeDollarSign size={16} /> Workshop billing</div><h3>Sales & Billing</h3><p className="page-subtitle">Create a complete repair invoice from the job card.</p></div><span className="badge badge-info">Parts + labor</span></div>
    {error && <div className="form-error sales-error">{error}</div>}
    <section className="repair-billing-layout">
      <div className="sales-main-column">
        <section className="card billing-card">
          <div className="billing-section-heading"><div><span className="section-icon"><ClipboardList size={18} /></span><div><h4>Repair job</h4><p>Select a completed job to load its customer, vehicle, technician, and used parts.</p></div></div><span className={`badge ${selectedJob?.invoice ? 'badge-success' : 'badge-warning'}`}>{selectedJob?.invoice ? 'Billed' : 'Not billed'}</span></div>
          <div className="billing-select-grid"><label>Repair job<select className="input" value={selectedJobId} onChange={chooseJob}><option value="">Select completed job card</option>{jobs.map(job => <option key={job._id} value={job._id}>{job.jobCardNumber} · {job.customerName} · {job.registrationNumber || job.licensePlate}{job.invoice ? ' · Billed' : ''}</option>)}</select></label><label>Customer<select className="input" value={selectedCustomerId} onChange={event => { setSelectedCustomerId(event.target.value); setVehicleIndex(''); }}><option value="">Select customer</option>{customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name} · {customer.phone}</option>)}</select></label><label>Vehicle<select className="input" value={vehicleIndex} onChange={event => setVehicleIndex(event.target.value)}><option value="">Select vehicle</option>{selectedJob && <option value="job">{selectedJob.vehicleMake} {selectedJob.vehicleModel} · {selectedJob.registrationNumber || selectedJob.licensePlate}</option>}{(selectedCustomer?.vehicles || []).map((vehicle, index) => <option key={index} value={index}>{vehicle.make} {vehicle.model} · {vehicle.licensePlate}</option>)}</select></label><label>Sale date<input className="input" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Payment status<select className="input" value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)}><option>Pending</option><option>Paid</option></select></label></div>
        </section>
        <section className="card billing-card"><div className="section-heading"><span className="section-icon"><FileText size={18} /></span><div><h4>Parts Used</h4><p>Loaded directly from the repair job card. Inventory is not reduced again at billing.</p></div></div><div className="table-container"><table><thead><tr><th>Product</th><th>Quantity</th><th>Unit price (Rs.)</th><th>Subtotal (Rs.)</th></tr></thead><tbody>{parts.length ? parts.map((item, index) => { const price = Number(item.unitPrice || item.product?.price || 0); return <tr key={`${item.product?._id || item.productName}-${index}`}><td>{item.productName || item.product?.name || 'Used part'}</td><td>{item.quantity}</td><td>{money(price)}</td><td>{money(Number(item.quantity) * price)}</td></tr>; }) : <tr><td colSpan="4" className="empty-state">Select a completed repair job to view its parts.</td></tr>}</tbody></table></div><div className="section-total"><span>Total Parts Cost</span><strong>{money(partsCost)}</strong></div></section>
      </div>
      <aside className="sales-side-column"><section className="card cost-card"><div className="section-heading"><span className="section-icon"><User size={18} /></span><div><h4>Technician Cost</h4><p>Enter the repair cost manually.</p></div></div><div className="cost-detail"><div><span>Technician</span><strong>{selectedJob?.technician?.name || 'Not assigned'}</strong></div><label><span>Repair cost (Rs.)</span><input className="input" min="0" step="0.01" type="number" value={manualTechnicianCost} onChange={event => setManualTechnicianCost(event.target.value)} placeholder="Enter technician cost" /></label></div><div className="section-total"><span>Total Technician Cost</span><strong>{money(technicianCost)}</strong></div></section><section className="card summary-card"><div className="section-heading"><span className="section-icon"><BadgeDollarSign size={18} /></span><div><h4>Final Summary</h4><p>Repair bill total</p></div></div><div className="summary-lines"><div><span>Parts Cost</span><strong>{money(partsCost)}</strong></div><div><span>Technician Cost</span><strong>{money(technicianCost)}</strong></div><div className="summary-total"><span>Total Sale Amount</span><strong>{money(finalTotal)}</strong></div></div><div className="billing-actions"><button className="btn btn-outline" onClick={() => window.print()}><Printer size={16} /> Print Invoice</button><button className="btn btn-primary" disabled={!selectedJob} onClick={createBill}><Check size={16} /> {selectedJob?.invoice ? 'Update Bill' : 'Create Sale / Bill'}</button></div></section></aside>
    </section>
    {createdBill && <section className="card bill repair-invoice"><div className="bill-header"><div><strong>Welgama Auto Parts</strong><span>Repair invoice</span></div></div><div className="invoice-customer"><div><span>Customer</span><strong>{selectedCustomer?.name || createdBill.customer?.name || 'Customer'}</strong></div><div><span>Vehicle</span><strong>{selectedVehicle && selectedVehicle.vehicleMake ? `${cleanVehicleText(selectedVehicle.vehicleMake)} ${cleanVehicleText(selectedVehicle.vehicleModel)} · ${selectedVehicle.registrationNumber || selectedVehicle.licensePlate}` : selectedVehicle ? `${cleanVehicleText(selectedVehicle.make)} ${cleanVehicleText(selectedVehicle.model)} · ${selectedVehicle.licensePlate}` : 'Vehicle'}</strong></div></div><h4>Parts Used</h4><div className="table-container"><table><thead><tr><th>Part</th><th>Quantity</th><th>Subtotal</th></tr></thead><tbody>{invoiceParts.map((item, index) => <tr key={`${item.productName}-${index}`}><td>{item.productName}</td><td>{item.quantity}</td><td>{money(item.quantity * item.priceAtSale)}</td></tr>)}</tbody></table></div><div className="summary-lines"><div><span>Technician</span><strong>{createdBill.technician?.name || selectedJob?.technician?.name || 'Not assigned'}</strong></div><div><span>Technician Cost</span><strong>{money(technicianCost)}</strong></div><div className="summary-total"><span>Total Cost</span><strong>{money(finalTotal)}</strong></div></div></section>}
    <section className="card pos-card"><div className="section-heading"><span className="section-icon"><Car size={18} /></span><div><h4>Parts counter</h4><p>For standalone parts sales unrelated to a repair job.</p></div></div><div className="pos-products">{products.slice(0, 8).map(product => <button className="pos-product" key={product._id} disabled={!product.quantity} onClick={() => addProduct(product)}><span>{product.name}</span><small>{money(product.price)} · Stock {product.quantity}</small></button>)}</div>{cart.length > 0 && <div className="pos-checkout"><span>{cart.length} item(s) · {money(posTotal)}</span><button className="btn btn-outline" onClick={createPosSale}>Checkout parts sale</button></div>}{posSale && <span className="badge badge-success">Parts sale {posSale._id} created</span>}</section>
  </div>;
};

export default Sales;
