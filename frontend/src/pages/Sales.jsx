import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, BarChart3, Check, ClipboardList, FileText, History, Mail, Package, Percent, Plus, Printer, Search, ShoppingCart, Trash2, User, Wrench, X } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { API_BASE_URL } from '../services/apiBase';

const API = API_BASE_URL;
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` });
const money = value => `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const getTechnicianCostError = value => {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) return 'Repair cost is required.';
  if (normalizedValue.startsWith('-')) return 'Repair cost must be zero or greater.';
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedValue) || !Number.isFinite(Number(normalizedValue))) {
    return 'Enter a valid amount with no more than 2 decimal places.';
  }
  return '';
};
const getPartsCustomerErrors = customer => {
  const errors = {};
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const email = String(customer.email || '').trim();

  if (!name) errors.name = 'Customer name is required.';
  else if (name.length < 2 || name.length > 80) errors.name = 'Customer name must be between 2 and 80 characters.';
  if (!phone) errors.phone = 'Phone number is required.';
  else if (!/^(?:0|94|\+94)\d{9}$/.test(phone.replace(/[\s()-]/g, ''))) {
    errors.phone = 'Enter a valid Sri Lankan phone number.';
  }
  if (!email) errors.email = 'Email address is required.';
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  return errors;
};
const compactMoney = value => {
  const amount = Number(value || 0);
  const magnitude = Math.abs(amount);
  const compact = magnitude >= 1_000_000
    ? `${(magnitude / 1_000_000).toFixed(1)}m`
    : magnitude >= 10_000
      ? `${(magnitude / 1_000).toFixed(0)}k`
      : magnitude >= 1_000
        ? `${(magnitude / 1_000).toFixed(1)}k`
        : magnitude.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${amount < 0 ? '-' : ''}Rs.${compact}`;
};
const cleanVehicleText = value => String(value || '')
  .replace(/\bnot provided\b/gi, '')
  .replace(/\s+/g, ' ')
  .replace(/^[\s·,–—-]+|[\s·,–—-]+$/g, '')
  .trim();
const calculatePartsProfit = (items, discount, invoiceSubtotal) => {
  const normalized = items.map(item => ({
    quantity: Number(item.quantity || 0),
    price: Number(item.priceAtSale ?? item.unitPrice ?? item.product?.price ?? 0),
    cost: item.unitCostAtSale ?? item.product?.costPrice
  }));
  if (normalized.some(item => item.cost === null || item.cost === undefined || !Number.isFinite(Number(item.cost)))) return null;
  const partsRevenue = normalized.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discountShare = Number(invoiceSubtotal) > 0 ? Number(discount || 0) * partsRevenue / Number(invoiceSubtotal) : 0;
  return normalized.map(item => (
    (item.price - Number(item.cost)) * item.quantity
    - (partsRevenue > 0 ? discountShare * item.quantity * item.price / partsRevenue : 0)
  ));
};
const invoiceNumber = sale => `INV-${String(sale._id || '').slice(-8).toUpperCase()}`;
const saleCustomerName = sale => sale.customer?.name || sale.customerName || 'Walk-in customer';
const formatPurchaseDate = date => date ? new Date(date).toLocaleString(undefined, { timeZone: 'Asia/Colombo' }) : 'Date unavailable';
const formatInvoiceDate = date => date ? new Date(date).toLocaleDateString(undefined, { timeZone: 'Asia/Colombo' }) : 'Date unavailable';
const monthKeyForDate = date => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
};
const buildMonthlyPerformance = (sales, now = new Date()) => {
  const currentMonth = monthKeyForDate(now);
  const [year, month] = currentMonth.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (11 - index), 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(date),
      totalSales: 0,
      netProfit: 0,
      billsMissingProfit: 0
    };
  });
  const monthsByKey = new Map(months.map(monthEntry => [monthEntry.key, monthEntry]));

  sales.forEach(sale => {
    const createdAt = new Date(sale.createdAt);
    if (!Number.isFinite(createdAt.getTime())) return;
    const monthEntry = monthsByKey.get(monthKeyForDate(createdAt));
    if (!monthEntry) return;
    monthEntry.totalSales += Number(sale.total || 0);
    if (sale.netProfit === null || sale.netProfit === undefined || !Number.isFinite(Number(sale.netProfit))) {
      monthEntry.billsMissingProfit += 1;
    } else {
      monthEntry.netProfit += Number(sale.netProfit);
    }
  });

  return months;
};
const readApiResponse = async response => {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    const routeHint = response.status === 404
      ? " Restart the backend from this project's backend folder so the email route is loaded."
      : ' Check that the backend is running and restart it.';
    throw new Error(`Backend returned a non-JSON response (HTTP ${response.status}).${routeHint}`);
  }
  return response.json();
};

const InvoiceDocument = ({ invoice, type, customerName, customerPhone, customerEmail, items, details = [], variant }) => (
  <section className={`card bill customer-invoice ${variant}`}>
    <header className="customer-invoice-brand">
      <BrandLogo width={180} />
      <h2>Welgama Auto Parts</h2>
      <p>{type} Invoice</p>
    </header>
    <table className="customer-invoice-details"><tbody>
      <tr><th>Invoice No.</th><td>{invoiceNumber(invoice)}</td><th>Date</th><td>{formatInvoiceDate(invoice.createdAt)}</td></tr>
      <tr><th>Customer</th><td>{customerName || 'Customer'}</td><th>Payment Status</th><td><strong className={`invoice-payment-text ${invoice.paymentStatus?.toLowerCase() || 'pending'}`}>{invoice.paymentStatus || 'Pending'}</strong></td></tr>
      <tr><th>Phone</th><td>{customerPhone || 'Not provided'}</td><th>Email</th><td>{customerEmail || 'Not provided'}</td></tr>
      {details.filter(detail => detail.value).map(detail => <tr key={detail.label}><th>{detail.label}</th><td colSpan="3">{detail.value}</td></tr>)}
    </tbody></table>
    <h4 className="customer-invoice-items-heading">{type === 'Parts' ? 'Parts Purchased' : 'Repair Services'}</h4>
    <div className="table-container customer-invoice-table"><table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>
      {items.map((item, index) => <tr key={`${item.productName}-${index}`}><td className="invoice-number-cell">{index + 1}</td><td>{item.productName}</td><td className="invoice-number-cell">{item.quantity}</td><td className="invoice-amount-cell">{money(item.priceAtSale)}</td><td className="invoice-amount-cell">{money(Number(item.quantity) * Number(item.priceAtSale))}</td></tr>)}
    </tbody></table></div>
    <div className="customer-invoice-totals">
      <div><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></div>
      {Number(invoice.discount) > 0 && <div><span>Discount</span><strong>- {money(invoice.discount)}</strong></div>}
      {Number(invoice.tax) > 0 && <div><span>Tax</span><strong>{money(invoice.tax)}</strong></div>}
      <div className="customer-invoice-total"><span>Total</span><strong>{money(invoice.total)}</strong></div>
    </div>
    <div className="customer-invoice-payment"><span><strong>Payment Status:</strong> {invoice.paymentStatus || 'Pending'}</span><span>Thank you for your purchase!</span></div>
    <footer className="customer-invoice-footer">Welgama Auto Parts | {type} Invoice</footer>
  </section>
);

const Sales = () => {
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [billingType, setBillingType] = useState('repair');
  const [partsCustomer, setPartsCustomer] = useState({ name: '', phone: '', email: '' });
  const [partsCustomerTouched, setPartsCustomerTouched] = useState({});
  const [partsCustomerSubmitAttempted, setPartsCustomerSubmitAttempted] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partsProductSearch, setPartsProductSearch] = useState('');
  const [selectedPartQuantity, setSelectedPartQuantity] = useState(1);
  const [partsCart, setPartsCart] = useState([]);
  const [partsDiscount, setPartsDiscount] = useState('');
  const [partsPaymentStatus, setPartsPaymentStatus] = useState('Paid');
  const [partsBill, setPartsBill] = useState(null);
  const [partsEmailStatus, setPartsEmailStatus] = useState(null);
  const [creatingPartsBill, setCreatingPartsBill] = useState(false);
  const [retryingPartsEmail, setRetryingPartsEmail] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [vehicleIndex, setVehicleIndex] = useState('');
  const [manualTechnicianCost, setManualTechnicianCost] = useState('');
  const [repairDiscount, setRepairDiscount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [createdBill, setCreatedBill] = useState(null);
  const [invoiceEmailStatus, setInvoiceEmailStatus] = useState(null);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [salesHistory, setSalesHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyEmailStatus, setHistoryEmailStatus] = useState({});
  const [resendingHistoryEmailId, setResendingHistoryEmailId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const auth = { headers: headers() };
      const [jobResponse, customerResponse, salesResponse, productResponse] = await Promise.all([
        fetch(`${API}/jobCards/billable`, auth),
        fetch(`${API}/customers`, auth),
        fetch(`${API}/sales`, auth),
        fetch(`${API}/products`, auth)
      ]);
      const jobData = await jobResponse.json();
      if (!jobResponse.ok) throw new Error(jobData.error || 'Could not load repairs awaiting billing.');
      const customerData = await customerResponse.json();
      if (!customerResponse.ok) throw new Error(customerData.error || 'Could not load customers.');
      const salesData = await salesResponse.json();
      if (!salesResponse.ok) throw new Error(salesData.error || 'Could not load purchase history.');
      const productData = await productResponse.json();
      if (!productResponse.ok) throw new Error(productData.error || 'Could not load inventory parts.');
      setJobs(jobData);
      setCustomers(customerData);
      setSalesHistory(salesData);
      setProducts(productData);
    } catch (err) { setError(err.message || 'Unable to load billing data.'); }
  };
  useEffect(() => { load(); }, []);

  const selectedJob = jobs.find(job => job._id === selectedJobId);
  const selectedCustomer = customers.find(customer => customer._id === selectedCustomerId);
  const selectedPart = products.find(product => product._id === selectedPartId);
  const partsCustomerErrors = getPartsCustomerErrors(partsCustomer);
  const matchingParts = useMemo(() => {
    const query = partsProductSearch.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter(product => Number(product.quantity) > 0 && `${product.name} ${product.category}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [products, partsProductSearch]);
  const parts = selectedJob?.partsUsed || [];
  const invoiceParts = (createdBill?.items || []).filter(item => item.productName?.toLowerCase() !== 'repair labor');
  const partsCost = parts.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice ?? item.product?.price ?? 0), 0);
  const technicianCost = Number(manualTechnicianCost || 0);
  const technicianCostError = selectedJob ? getTechnicianCostError(manualTechnicianCost) : '';
  const repairSubtotal = partsCost + technicianCost;
  const appliedRepairDiscount = Math.min(Math.max(Number(repairDiscount || 0), 0), repairSubtotal);
  const finalTotal = repairSubtotal - appliedRepairDiscount;
  const partsSubtotal = partsCart.reduce((total, item) => total + item.quantity * Number(item.product.price), 0);
  const appliedPartsDiscount = Math.min(Math.max(Number(partsDiscount || 0), 0), partsSubtotal);
  const partsTotal = Number((partsSubtotal - appliedPartsDiscount).toFixed(2));
  const repairPartProfits = calculatePartsProfit(parts.map(item => ({
    quantity: item.quantity,
    priceAtSale: item.unitPrice ?? item.product?.price ?? 0,
    product: item.product
  })), appliedRepairDiscount, repairSubtotal);
  const repairNetProfit = repairPartProfits?.reduce((sum, profit) => sum + profit, 0) ?? null;
  const monthlyPerformance = buildMonthlyPerformance(salesHistory);
  const performanceTotals = monthlyPerformance.reduce((totals, month) => ({
    totalSales: totals.totalSales + month.totalSales,
    knownNetProfit: totals.knownNetProfit + month.netProfit,
    billsMissingProfit: totals.billsMissingProfit + month.billsMissingProfit
  }), { totalSales: 0, knownNetProfit: 0, billsMissingProfit: 0 });
  const maxMonthlyValue = Math.max(
    ...monthlyPerformance.flatMap(month => [month.totalSales, Math.abs(month.netProfit)]),
    1
  );
  const normalizedHistorySearch = historySearch.trim().toLowerCase();
  const filteredSalesHistory = salesHistory.filter(sale => {
    if (!normalizedHistorySearch) return true;
    const customer = sale.customer || {};
    const queryValues = [
      invoiceNumber(sale),
      String(sale._id || ''),
      customer.name,
      customer.email,
      customer.phone,
      sale.customerName,
      sale.customerEmail,
      sale.customerPhone,
      sale.jobCard?.jobCardNumber,
      sale.vehicle?.licensePlate
    ].filter(Boolean).join(' ').toLowerCase();
    return queryValues.includes(normalizedHistorySearch);
  });

  const chooseJob = event => {
    const job = jobs.find(item => item._id === event.target.value);
    setSelectedJobId(event.target.value); setSelectedCustomerId(job?.customer?._id || job?.customer || ''); setVehicleIndex('job'); setManualTechnicianCost(job?.laborCost || job?.estimatedCost || ''); setRepairDiscount(''); setCreatedBill(null); setInvoiceEmailStatus(null);
  };
  const addPartToBill = () => {
    if (!selectedPart) return;
    const quantity = Math.max(1, Number(selectedPartQuantity) || 1);
    const existingQuantity = partsCart.find(item => item.product._id === selectedPart._id)?.quantity || 0;
    if (existingQuantity + quantity > Number(selectedPart.quantity)) {
      setError(`Only ${selectedPart.quantity} ${selectedPart.name} available in stock.`);
      return;
    }
    setError('');
    setPartsCart(current => {
      const existing = current.find(item => item.product._id === selectedPart._id);
      return existing
        ? current.map(item => item.product._id === selectedPart._id ? { ...item, quantity: item.quantity + quantity } : item)
        : [...current, { product: selectedPart, quantity }];
    });
    setSelectedPartId('');
    setPartsProductSearch('');
    setSelectedPartQuantity(1);
  };
  const choosePartsProduct = product => {
    setSelectedPartId(product._id);
    setPartsProductSearch('');
    setSelectedPartQuantity(1);
  };
  const updatePartsQuantity = (productId, value) => {
    const quantity = Number(value);
    const item = partsCart.find(entry => entry.product._id === productId);
    if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > Number(item.product.quantity)) return;
    setPartsCart(current => current.map(entry => entry.product._id === productId ? { ...entry, quantity } : entry));
  };
  const createPartsBill = async event => {
    event.preventDefault();
    setError('');
    setPartsCustomerSubmitAttempted(true);
    if (Object.keys(partsCustomerErrors).length) return;
    if (!partsCart.length) {
      setError('Add at least one part to the bill.');
      return;
    }
    setCreatingPartsBill(true);
    try {
      const response = await fetch(`${API}/sales/parts`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          customerName: partsCustomer.name,
          customerPhone: partsCustomer.phone,
          customerEmail: partsCustomer.email,
          items: partsCart.map(item => ({ product: item.product._id, quantity: item.quantity })),
          discount: appliedPartsDiscount,
          paymentStatus: partsPaymentStatus
        })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Could not create the parts bill.');
      setPartsBill(data);
      setPartsEmailStatus(data.emailStatus || { sent: false, error: 'Email status was not returned by the backend.' });
      setSalesHistory(current => [data, ...current.filter(sale => sale._id !== data._id)]);
      setPartsCart([]);
      setPartsDiscount('');
      setPartsCustomer({ name: '', phone: '', email: '' });
      setPartsCustomerTouched({});
      setPartsCustomerSubmitAttempted(false);
      setProducts(current => current.map(product => {
        const soldQuantity = partsCart.find(item => item.product._id === product._id)?.quantity || 0;
        return soldQuantity ? { ...product, quantity: Number(product.quantity) - soldQuantity } : product;
      }));
    } catch (err) {
      setError(err.message || 'Could not create the parts bill.');
    } finally {
      setCreatingPartsBill(false);
    }
  };
  const retryPartsInvoiceEmail = async () => {
    if (!partsBill?._id) return;
    setRetryingPartsEmail(true);
    try {
      const response = await fetch(`${API}/sales/parts/${partsBill._id}/email`, { method: 'POST', headers: headers() });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Could not email the parts invoice.');
      setPartsEmailStatus(data.emailStatus || { sent: false, error: 'Email status was not returned by the backend.' });
    } catch (err) {
      setPartsEmailStatus({ sent: false, error: err.message || 'Could not email the parts invoice.' });
    } finally {
      setRetryingPartsEmail(false);
    }
  };
  const createBill = async () => {
    if (!selectedJob) { setError('Select a completed repair job to create a bill.'); return; }
    if (technicianCostError) { setError(technicianCostError); return; }
    setError('');
    try {
      const response = await fetch(`${API}/sales/repair/${selectedJob._id}`, { method: 'POST', headers: headers(), body: JSON.stringify({ paymentStatus, technicianCost: manualTechnicianCost, discount: appliedRepairDiscount }) });
      const data = await readApiResponse(response);
      if (!response.ok) { setError(data.error || 'Could not create the repair bill.'); return; }
      setCreatedBill(data);
      setInvoiceEmailStatus(data.emailStatus || { sent: false, error: 'Email status was not returned by the backend. Restart the backend and try again.' });
      setJobs(current => current.filter(job => job._id !== selectedJob._id));
      setSelectedJobId('');
      setSelectedCustomerId('');
      setVehicleIndex('');
      setManualTechnicianCost('');
      setRepairDiscount('');
      setSalesHistory(current => [data, ...current.filter(sale => sale._id !== data._id)]);
    } catch (err) {
      setError(err.message || 'Could not create the repair bill.');
    }
  };
  const retryInvoiceEmail = async () => {
    const jobId = createdBill?.jobCard?._id || createdBill?.jobCard;
    if (!jobId) return;
    setRetryingEmail(true);
    setError('');
    try {
      const response = await fetch(`${API}/sales/repair/${jobId}/email`, { method: 'POST', headers: headers() });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Could not email the repair bill.');
      setInvoiceEmailStatus(data.emailStatus || { sent: false, error: 'Email status was not returned by the backend. Restart the backend and try again.' });
    } catch (err) {
      setInvoiceEmailStatus({ sent: false, error: err.message });
    } finally {
      setRetryingEmail(false);
    }
  };
  const resendHistoryInvoice = async sale => {
    const endpoint = sale.billType === 'REPAIR'
      ? sale.jobCard?._id && `${API}/sales/repair/${sale.jobCard._id}/email`
      : `${API}/sales/parts/${sale._id}/email`;
    if (!endpoint) return;
    setResendingHistoryEmailId(sale._id);
    setHistoryEmailStatus(current => ({ ...current, [sale._id]: null }));
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: headers() });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Could not resend the repair bill.');
      setHistoryEmailStatus(current => ({ ...current, [sale._id]: data.emailStatus || { sent: false, error: 'Email status was not returned by the backend.' } }));
    } catch (err) {
      setHistoryEmailStatus(current => ({ ...current, [sale._id]: { sent: false, error: err.message || 'Could not resend the repair bill.' } }));
    } finally {
      setResendingHistoryEmailId('');
    }
  };
  return <div className="sales-module">
    <div className="sales-page-heading"><div><div className="eyebrow"><BadgeDollarSign size={16} /> Workshop billing</div><h3>Sales & Billing</h3><p className="page-subtitle">Create repair bills or email invoices for customers buying parts only.</p></div><span className="badge badge-info">Repair + parts-only</span></div>
    {error && <div className="form-error sales-error">{error}</div>}
    <div className="sales-history-toolbar">
      <div><strong>Purchase history</strong><span>Search bills by customer or invoice number.</span></div>
      <button className="btn btn-outline" onClick={() => setShowHistory(true)}><History size={16} /> Search purchase history</button>
    </div>
    <div className="sales-billing-tabs" role="tablist" aria-label="Billing type">
      <button type="button" role="tab" aria-selected={billingType === 'repair'} className={billingType === 'repair' ? 'active' : ''} onClick={() => setBillingType('repair')}><Wrench size={16} /> Repair bill</button>
      <button type="button" role="tab" aria-selected={billingType === 'parts'} className={billingType === 'parts' ? 'active' : ''} onClick={() => setBillingType('parts')}><Package size={16} /> Parts-only sale</button>
    </div>
    {billingType === 'parts' && <div className="parts-only-workspace">
      <form onSubmit={createPartsBill} className="parts-only-form" noValidate>
        <section className="card billing-card">
          <div className="billing-section-heading"><div><span className="section-icon"><User size={18} /></span><div><h4>Customer details</h4><p>Enter the details to include on and email with this parts invoice.</p></div></div></div>
          <div className="parts-contact-fields">
            <label>Customer name<input required maxLength="80" className={`input${(partsCustomerTouched.name || partsCustomerSubmitAttempted) && partsCustomerErrors.name ? ' input-validation-error' : ''}`} aria-invalid={Boolean((partsCustomerTouched.name || partsCustomerSubmitAttempted) && partsCustomerErrors.name)} aria-describedby={(partsCustomerTouched.name || partsCustomerSubmitAttempted) && partsCustomerErrors.name ? 'parts-customer-name-error' : undefined} autoComplete="name" value={partsCustomer.name} onChange={event => { setPartsCustomer(current => ({ ...current, name: event.target.value })); setPartsCustomerTouched(current => ({ ...current, name: true })); }} placeholder="Customer name" />{(partsCustomerTouched.name || partsCustomerSubmitAttempted) && partsCustomerErrors.name && <small id="parts-customer-name-error" className="field-validation-error">{partsCustomerErrors.name}</small>}</label>
            <label>Phone number<input required maxLength="20" className={`input${(partsCustomerTouched.phone || partsCustomerSubmitAttempted) && partsCustomerErrors.phone ? ' input-validation-error' : ''}`} aria-invalid={Boolean((partsCustomerTouched.phone || partsCustomerSubmitAttempted) && partsCustomerErrors.phone)} aria-describedby={(partsCustomerTouched.phone || partsCustomerSubmitAttempted) && partsCustomerErrors.phone ? 'parts-customer-phone-error' : undefined} type="tel" autoComplete="tel" value={partsCustomer.phone} onChange={event => { setPartsCustomer(current => ({ ...current, phone: event.target.value })); setPartsCustomerTouched(current => ({ ...current, phone: true })); }} placeholder="Phone number" />{(partsCustomerTouched.phone || partsCustomerSubmitAttempted) && partsCustomerErrors.phone && <small id="parts-customer-phone-error" className="field-validation-error">{partsCustomerErrors.phone}</small>}</label>
            <label>Email address<input required maxLength="254" className={`input${(partsCustomerTouched.email || partsCustomerSubmitAttempted) && partsCustomerErrors.email ? ' input-validation-error' : ''}`} aria-invalid={Boolean((partsCustomerTouched.email || partsCustomerSubmitAttempted) && partsCustomerErrors.email)} aria-describedby={(partsCustomerTouched.email || partsCustomerSubmitAttempted) && partsCustomerErrors.email ? 'parts-customer-email-error' : undefined} type="email" autoComplete="email" value={partsCustomer.email} onChange={event => { setPartsCustomer(current => ({ ...current, email: event.target.value })); setPartsCustomerTouched(current => ({ ...current, email: true })); }} placeholder="customer@example.com" />{(partsCustomerTouched.email || partsCustomerSubmitAttempted) && partsCustomerErrors.email && <small id="parts-customer-email-error" className="field-validation-error">{partsCustomerErrors.email}</small>}</label>
          </div>
        </section>
        <section className="card billing-card">
          <div className="billing-section-heading"><div><span className="section-icon"><ShoppingCart size={18} /></span><div><h4>Parts to bill</h4><p>Select in-stock items. The current inventory selling price is used on the invoice.</p></div></div></div>
          <div className="parts-picker-row">
            <div className="parts-product-picker">
              <label htmlFor="parts-product-search">Search parts</label>
              <div className="supplier-search"><Search size={16} aria-hidden="true" /><input id="parts-product-search" type="search" autoComplete="off" aria-label="Search parts by name or category" value={partsProductSearch} onChange={event => { setPartsProductSearch(event.target.value); setSelectedPartId(''); }} placeholder="Type a part name or category" /></div>
              {partsProductSearch.trim() && <div className="parts-product-results" role="listbox" aria-label="Matching parts">
                {matchingParts.length ? matchingParts.map(product => <button type="button" role="option" aria-selected={selectedPartId === product._id} className={selectedPartId === product._id ? 'selected' : ''} key={product._id} onClick={() => choosePartsProduct(product)}><span><strong>{product.name}</strong><small>{product.category} - Stock {product.quantity}</small></span><strong>{money(product.price)}</strong></button>) : <p>No in-stock parts match that search.</p>}
              </div>}
              {selectedPart && <p className="selected-parts-product"><Check size={14} /> Selected: <strong>{selectedPart.name}</strong> · Stock {selectedPart.quantity} · {money(selectedPart.price)}</p>}
            </div>
            <label>Quantity<input className="input" type="number" min="1" max={selectedPart?.quantity || 1} step="1" value={selectedPartQuantity} onChange={event => setSelectedPartQuantity(event.target.value)} /></label>
            <button type="button" className="btn btn-outline" onClick={addPartToBill} disabled={!selectedPart || Number(selectedPart.quantity) < 1}><Plus size={16} /> Add part</button>
          </div>
          <div className="table-container parts-cart-table"><table><thead><tr><th>Part</th><th>In stock</th><th>Unit price</th><th>Quantity</th><th>Subtotal</th><th>Action</th></tr></thead><tbody>
            {partsCart.length ? partsCart.map(item => <tr key={item.product._id}><td><strong>{item.product.name}</strong><small className="table-muted">{item.product.category}</small></td><td>{item.product.quantity}</td><td>{money(item.product.price)}</td><td><input aria-label={`Quantity for ${item.product.name}`} className="input parts-cart-quantity" type="number" min="1" max={item.product.quantity} step="1" value={item.quantity} onChange={event => updatePartsQuantity(item.product._id, event.target.value)} /></td><td>{money(item.quantity * Number(item.product.price))}</td><td><button type="button" className="icon-button danger" title={`Remove ${item.product.name}`} onClick={() => setPartsCart(current => current.filter(entry => entry.product._id !== item.product._id))}><Trash2 size={16} /></button></td></tr>) : <tr><td colSpan="6" className="empty-state">Add parts to start the invoice.</td></tr>}
          </tbody></table></div>
          <div className="parts-sale-options">
            <label>Discount (Rs.)<input className="input" type="number" min="0" max={partsSubtotal} step="0.01" value={partsDiscount} onChange={event => setPartsDiscount(event.target.value)} placeholder="0.00" /></label>
            <label>Payment status<select className="input" value={partsPaymentStatus} onChange={event => setPartsPaymentStatus(event.target.value)}><option>Paid</option><option>Pending</option></select></label>
          </div>
          <div className="summary-lines parts-sale-summary"><div><span>Subtotal</span><strong>{money(partsSubtotal)}</strong></div><div><span>Discount</span><strong>-{money(appliedPartsDiscount)}</strong></div><div className="summary-total"><span>Total</span><strong>{money(partsTotal)}</strong></div></div>
          <div className="billing-actions"><button className="btn btn-primary" type="submit" disabled={creatingPartsBill || !partsCart.length}><Mail size={16} />{creatingPartsBill ? 'Creating and emailing...' : 'Create bill and email invoice'}</button></div>
        </section>
      </form>
      {partsBill && <div className="invoice-result parts-only-invoice">
        <InvoiceDocument
          invoice={partsBill}
          type="Parts"
          customerName={partsBill.customerName}
          customerPhone={partsBill.customerPhone}
          customerEmail={partsBill.customerEmail}
          items={partsBill.items}
          variant="parts-invoice-document"
        />
        <div className="billing-actions parts-invoice-actions"><button className="btn btn-outline" type="button" onClick={() => window.print()}><Printer size={16} /> Print invoice</button></div>
        {partsEmailStatus && <div className={`invoice-email-status ${partsEmailStatus.sent ? 'sent' : 'failed'}`} role={partsEmailStatus.sent ? 'status' : 'alert'}><span><Mail size={16} />{partsEmailStatus.sent ? `Invoice emailed to ${partsEmailStatus.to || partsBill.customerEmail}.${partsEmailStatus.statusError ? ` ${partsEmailStatus.statusError}` : ''}` : `Bill created, but email was not sent: ${partsEmailStatus.error}${partsEmailStatus.statusError ? ` ${partsEmailStatus.statusError}` : ''}`}</span><button className="btn btn-outline" type="button" onClick={retryPartsInvoiceEmail} disabled={retryingPartsEmail}>{retryingPartsEmail ? 'Sending...' : partsEmailStatus.sent ? 'Resend invoice' : 'Retry email'}</button></div>}
      </div>}
    </div>}
    {billingType === 'repair' && <section className="repair-billing-layout">
      <div className="sales-main-column">
        <section className="card billing-card">
          <div className="billing-section-heading"><div><span className="section-icon"><ClipboardList size={18} /></span><div><h4>Repair job</h4><p>Select a completed job to load its customer, vehicle, technician, and used parts.</p></div></div><span className={`badge ${selectedJob?.invoice ? 'badge-success' : 'badge-warning'}`}>{selectedJob?.invoice ? 'Billed' : 'Not billed'}</span></div>
          <div className="billing-select-grid"><label>Repair job<select className="input" value={selectedJobId} onChange={chooseJob}><option value="">{jobs.length ? 'Select completed, unbilled job card' : 'No completed jobs awaiting billing'}</option>{jobs.map(job => <option key={job._id} value={job._id}>{job.jobCardNumber} · {job.customerName} · {job.registrationNumber || job.licensePlate}</option>)}</select></label><label>Customer<select className="input" value={selectedCustomerId} onChange={event => { setSelectedCustomerId(event.target.value); setVehicleIndex(''); }}><option value="">Select customer</option>{customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name} · {customer.phone}</option>)}</select></label><label>Vehicle<select className="input" value={vehicleIndex} onChange={event => setVehicleIndex(event.target.value)}><option value="">Select vehicle</option>{selectedJob && <option value="job">{[cleanVehicleText(selectedJob.vehicleMake), cleanVehicleText(selectedJob.vehicleModel)].filter(Boolean).join(' ')} · {selectedJob.registrationNumber || selectedJob.licensePlate}</option>}{(selectedCustomer?.vehicles || []).map((vehicle, index) => <option key={index} value={index}>{vehicle.make} {vehicle.model} · {vehicle.licensePlate}</option>)}</select></label><label>Sale date<input className="input" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Payment status<select className="input" value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)}><option>Pending</option><option>Paid</option></select></label></div>
          {!jobs.length && <p className="table-muted">Only completed repairs without an invoice appear here.</p>}
        </section>
        <section className="card billing-card"><div className="section-heading"><span className="section-icon"><FileText size={18} /></span><div><h4>Parts Used</h4><p>Part profit uses its saved cost price; discount is allocated across the full repair subtotal.</p></div></div><div className="table-container"><table><thead><tr><th>Product</th><th>Quantity</th><th>Unit price (Rs.)</th><th>Subtotal (Rs.)</th><th>Net profit (Rs.)</th></tr></thead><tbody>{parts.length ? parts.map((item, index) => { const price = Number(item.unitPrice ?? item.product?.price ?? 0); return <tr key={`${item.product?._id || item.productName}-${index}`}><td>{item.productName || item.product?.name || 'Used part'}</td><td>{item.quantity}</td><td>{money(price)}</td><td>{money(Number(item.quantity) * price)}</td><td>{repairPartProfits ? money(repairPartProfits[index]) : 'Set cost price in Inventory'}</td></tr>; }) : <tr><td colSpan="5" className="empty-state">Select a completed repair job to view its parts.</td></tr>}</tbody></table></div><div className="section-total"><span>Total Parts Cost</span><strong>{money(partsCost)}</strong></div></section>
      </div>
      <aside className="sales-side-column">
        <section className="card cost-card">
          <div className="section-heading"><span className="section-icon"><User size={18} /></span><div><h4>Technician Cost</h4><p>Enter the repair cost manually.</p></div></div>
          <div className="cost-detail">
            <div><span>Technician</span><strong>{selectedJob?.technician?.name || 'Not assigned'}</strong></div>
            <label>
              <span>Repair cost (Rs.)</span>
              <input required className={`input${technicianCostError ? ' input-validation-error' : ''}`} aria-invalid={Boolean(technicianCostError)} aria-describedby={technicianCostError ? 'technician-cost-error' : undefined} min="0" step="0.01" type="number" value={manualTechnicianCost} onChange={event => { setManualTechnicianCost(event.target.value); setError(''); }} placeholder="Enter technician cost" />
              {technicianCostError && <small id="technician-cost-error" className="field-validation-error">{technicianCostError}</small>}
            </label>
          </div>
          <div className="section-total"><span>Total Technician Cost</span><strong>{technicianCostError ? '—' : money(technicianCost)}</strong></div>
        </section>
        <section className="card cost-card discount-card">
          <div className="section-heading"><span className="section-icon"><Percent size={18} /></span><div><h4>Discount</h4><p>Apply a discount to the repair bill.</p></div></div>
          <label className="repair-discount-field">
            <span>Discount (Rs.)</span>
            <input className="input" min="0" max={repairSubtotal} step="0.01" type="number" value={repairDiscount} onChange={event => setRepairDiscount(event.target.value)} placeholder="0.00" />
          </label>
        </section>
        <section className="card summary-card">
          <div className="section-heading"><span className="section-icon"><BadgeDollarSign size={18} /></span><div><h4>Final Summary</h4><p>Repair bill total</p></div></div>
          <div className="summary-lines"><div><span>Parts Cost</span><strong>{money(partsCost)}</strong></div><div><span>Technician Cost</span><strong>{technicianCostError ? '—' : money(technicianCost)}</strong></div><div><span>Subtotal</span><strong>{money(repairSubtotal)}</strong></div><div><span>Discount</span><strong>-{money(appliedRepairDiscount)}</strong></div><div><span>Net Profit (parts only)</span><strong>{repairNetProfit === null ? 'Set cost prices in Inventory' : money(repairNetProfit)}</strong></div><div className="summary-total"><span>Total Sale Amount</span><strong>{money(finalTotal)}</strong></div></div>
          <div className="billing-actions"><button className="btn btn-outline" onClick={() => window.print()}><Printer size={16} /> Print Invoice</button><button className="btn btn-primary" disabled={!selectedJob || Boolean(technicianCostError)} onClick={createBill}><Check size={16} /> {selectedJob?.invoice ? 'Update Bill' : 'Create Sale / Bill'}</button></div>
        </section>
      </aside>
    </section>}
    {billingType === 'repair' && createdBill && <div className="invoice-result repair-invoice">
      <InvoiceDocument
        invoice={createdBill}
        type="Repair"
        customerName={createdBill.customer?.name || selectedCustomer?.name}
        customerPhone={createdBill.customer?.phone || selectedCustomer?.phone}
        customerEmail={createdBill.customer?.email || selectedCustomer?.email}
        details={[
          { label: 'Job Card', value: createdBill.jobCard?.jobCardNumber },
          { label: 'Vehicle', value: [cleanVehicleText(createdBill.vehicle?.make), cleanVehicleText(createdBill.vehicle?.model), cleanVehicleText(createdBill.vehicle?.licensePlate)].filter(Boolean).join(' · ') }
        ]}
        items={[
          ...invoiceParts,
          ...(Number(createdBill.technicianCost) > 0 ? [{ productName: 'Repair labor', quantity: 1, priceAtSale: Number(createdBill.technicianCost) }] : [])
        ]}
        variant="repair-invoice-document"
      />
      <div className="billing-actions parts-invoice-actions"><button className="btn btn-outline" type="button" onClick={() => window.print()}><Printer size={16} /> Print invoice</button></div>
      {invoiceEmailStatus && <div className={`invoice-email-status ${invoiceEmailStatus.sent ? 'sent' : 'failed'}`} role={invoiceEmailStatus.sent ? 'status' : 'alert'}><span><Mail size={16} />{invoiceEmailStatus.sent ? `Bill emailed to ${invoiceEmailStatus.to || 'the customer'}${invoiceEmailStatus.skipped ? ' (already sent)' : ''}.` : `Bill was not emailed: ${invoiceEmailStatus.error}`}</span><button className="btn btn-outline" onClick={retryInvoiceEmail} disabled={retryingEmail}>{retryingEmail ? 'Sending...' : invoiceEmailStatus.sent ? 'Resend updated invoice' : 'Retry email'}</button></div>}
    </div>}
    <section className="card monthly-performance">
      <div className="monthly-performance-heading">
        <div><p className="eyebrow"><BarChart3 size={15} /> Monthly performance</p><h4>Sales and net profit · last 12 months</h4></div>
        <div className="monthly-performance-totals">
          <div><span>Total sales</span><strong>{money(performanceTotals.totalSales)}</strong></div>
          <div><span>Known net profit</span><strong>{money(performanceTotals.knownNetProfit)}</strong></div>
        </div>
      </div>
      {performanceTotals.billsMissingProfit > 0 && <p className="monthly-performance-note">{performanceTotals.billsMissingProfit} bill(s) are excluded from net profit because their part cost was not recorded.</p>}
      <div className="monthly-performance-legend"><span><i className="monthly-sales-key" />Total sales</span><span><i className="monthly-profit-key" />Net profit (known)</span><span className="monthly-performance-scale-note">Shared scale · maximum {compactMoney(maxMonthlyValue)}</span></div>
      <div className="monthly-performance-chart-scroll">
        <div className="monthly-performance-chart" role="img" aria-label={`Grouped monthly bar chart comparing total sales and net profit on a shared scale up to ${money(maxMonthlyValue)}`}>
        {monthlyPerformance.map(month => {
          const salesHeight = month.totalSales ? month.totalSales / maxMonthlyValue * 100 : 0;
          const profitHeight = month.netProfit ? Math.abs(month.netProfit) / maxMonthlyValue * 100 : 0;
          return (
            <div className="monthly-performance-column" key={month.key}>
              <div className="monthly-performance-bars">
                <div className="monthly-performance-bar-slot" title={`${month.label} total sales: ${money(month.totalSales)}`}>
                  <span style={{ bottom: `calc(${salesHeight}% + 4px)` }}>{compactMoney(month.totalSales)}</span>
                  <i className="monthly-sales-bar" style={{ height: `${salesHeight}%` }} />
                </div>
                <div className="monthly-performance-bar-slot" title={`${month.label} net profit: ${money(month.netProfit)}${month.billsMissingProfit ? `; ${month.billsMissingProfit} bill(s) missing cost data` : ''}`}>
                  <span style={{ bottom: `calc(${profitHeight}% + 4px)` }}>{month.billsMissingProfit ? `${compactMoney(month.netProfit)}*` : compactMoney(month.netProfit)}</span>
                  <i className={`monthly-profit-bar ${month.netProfit < 0 ? 'negative' : ''}`} style={{ height: `${profitHeight}%` }} />
                </div>
              </div>
              <strong>{month.label}</strong>
            </div>
          );
        })}
        </div>
      </div>
    </section>
    {showHistory && <div className="modal-backdrop" onClick={() => setShowHistory(false)}>
      <section className="card sales-history-modal" role="dialog" aria-modal="true" aria-labelledby="sales-history-title" onClick={event => event.stopPropagation()}>
        <div className="modal-heading">
          <div><span className="section-icon"><History size={18} /></span><div><h4 id="sales-history-title">Purchase history</h4><p>Search by customer name, phone, email, or bill number.</p></div></div>
          <button className="icon-button" title="Close purchase history" onClick={() => setShowHistory(false)}><X size={18} /></button>
        </div>
        <label className="sales-history-search"><Search size={17} /><input autoFocus value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search customer or bill number..." /></label>
        <div className="sales-history-results">
          {filteredSalesHistory.length === 0 ? <p className="empty-state">{salesHistory.length ? 'No bills match your search.' : 'No purchases have been recorded yet.'}</p> : filteredSalesHistory.map(sale => <article className="sales-history-entry" key={sale._id}>
            <div className="sales-history-entry-heading"><div><strong>{invoiceNumber(sale)}</strong><span>{saleCustomerName(sale)}</span></div><strong>{money(sale.total)}</strong></div>
            <div className="sales-history-meta"><span>{formatPurchaseDate(sale.createdAt)}</span><span>{sale.paymentStatus || 'Pending'} payment</span><span>{sale.billType === 'REPAIR' ? 'Repair bill' : 'Parts sale'}</span></div>
            <div className="sales-history-discount">Net Profit (parts only): {sale.netProfit === null || sale.netProfit === undefined ? 'Cost price not recorded for this bill' : money(sale.netProfit)}</div>
            {sale.jobCard?.jobCardNumber && <p className="sales-history-job">Job card: {sale.jobCard.jobCardNumber}</p>}
            <ul>{(sale.items || []).map((item, index) => <li key={`${sale._id}-${index}`}><span>{item.productName || item.product?.name || 'Item'} × {item.quantity}</span><strong>{money(Number(item.quantity || 0) * Number(item.priceAtSale || 0))}</strong></li>)}</ul>
            {Number(sale.discount || 0) > 0 && <div className="sales-history-discount">Discount: -{money(sale.discount)}</div>}
            {((sale.billType === 'REPAIR' && sale.jobCard?._id) || (sale.billType !== 'REPAIR' && sale.customerEmail)) && <div className="sales-history-resend"><button className="btn btn-outline" onClick={() => resendHistoryInvoice(sale)} disabled={resendingHistoryEmailId === sale._id}>{resendingHistoryEmailId === sale._id ? 'Sending...' : 'Resend invoice email/PDF'}</button>{historyEmailStatus[sale._id] && <span>{historyEmailStatus[sale._id].sent ? `Sent to ${historyEmailStatus[sale._id].to || 'the customer'}.` : `Could not send: ${historyEmailStatus[sale._id].error}`}</span>}</div>}
          </article>)}
        </div>
      </section>
    </div>}
  </div>;
};

export default Sales;
