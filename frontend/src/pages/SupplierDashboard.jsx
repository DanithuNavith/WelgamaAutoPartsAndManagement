import React, { useEffect, useState } from 'react';
import { Car, CheckCircle, ClipboardList, LogOut, Package, Truck, UserRound, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:5000/api';
const statusClass = value => value.toLowerCase().replaceAll(' ', '-');

const SupplierDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState({ contactPerson: '', phone: '', address: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([fetch(`${API_BASE_URL}/purchase-orders`, { headers }), fetch(`${API_BASE_URL}/suppliers/me`, { headers })])
      .then(async ([ordersResponse, profileResponse]) => {
        if (!ordersResponse.ok || !profileResponse.ok) throw new Error('Unable to load supplier data');
        return [await ordersResponse.json(), await profileResponse.json()];
      })
      .then(([supplierOrders, supplierProfile]) => { setOrders(supplierOrders); setProfile({ contactPerson: supplierProfile.contactPerson, phone: supplierProfile.phone, address: supplierProfile.address }); })
      .catch(err => setError(err.message));
  }, []);

  const saveProfile = async event => {
    event.preventDefault();
    const response = await fetch(`${API_BASE_URL}/suppliers/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` }, body: JSON.stringify(profile) });
    setProfileMessage(response.ok ? 'Profile updated successfully.' : 'Could not update your profile.');
  };

  const updateOrderStatus = async (order, status) => {
    if (status === 'Rejected' && !window.confirm(`Reject order ${order.orderNumber}?`)) return;
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${order._id}/supplier-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` },
      body: JSON.stringify({ status })
    });
    if (!response.ok) { setError('Could not update this order.'); return; }
    setOrders(current => current.map(item => item._id === order._id ? { ...item, status, deliveryStatus: status === 'Received' ? 'Delivered' : item.deliveryStatus } : item));
  };

  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); sessionStorage.removeItem('token'); sessionStorage.removeItem('user'); navigate('/supplier/login'); };
  const totalItems = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

  return <div className="supplier-portal">
    <header className="supplier-portal-header"><div className="portal-brand"><span><Car size={19} /></span><strong>Welgama Auto</strong><small>Supplier portal</small></div><div className="portal-user"><UserRound size={17} /> {user?.name || 'Supplier'}<button className="portal-logout" onClick={logout}><LogOut size={15} /> Sign out</button></div></header>
    <main className="supplier-portal-main">
      <section className="supplier-welcome"><div><p className="portal-kicker">SUPPLIER WORKSPACE</p><h1>Welcome, {user?.name || 'Supplier'}.</h1><p>Track the orders and deliveries connected to your Welgama Auto Parts account.</p></div><Truck size={58} /></section>
      {error && <div className="portal-error" role="alert">{error}</div>}
      <section className="portal-profile"><div><p className="portal-kicker">ACCOUNT DETAILS</p><h2>Keep your contact details current</h2></div><form onSubmit={saveProfile}><input required value={profile.contactPerson} onChange={event => setProfile({ ...profile, contactPerson: event.target.value })} placeholder="Contact person" /><input required value={profile.phone} onChange={event => setProfile({ ...profile, phone: event.target.value })} placeholder="Phone number" /><input required value={profile.address} onChange={event => setProfile({ ...profile, address: event.target.value })} placeholder="Address" /><button className="portal-save" type="submit">Save profile</button>{profileMessage && <span className="profile-message">{profileMessage}</span>}</form></section>
      <div className="portal-stats"><div><ClipboardList size={20} /><span>Purchase orders</span><strong>{orders.length}</strong></div><div><Package size={20} /><span>Products ordered</span><strong>{totalItems}</strong></div><div><Truck size={20} /><span>In transit</span><strong>{orders.filter(order => order.deliveryStatus === 'In transit').length}</strong></div></div>
      <section className="portal-orders"><div className="portal-section-heading"><div><p className="portal-kicker">ORDER HISTORY</p><h2>Orders from Welgama Auto Parts</h2></div><span className="portal-live">Live account data</span></div><div className="portal-table-wrap"><table><thead><tr><th>Order</th><th>Products & quantities</th><th>Order status</th><th>Delivery status</th><th>Order date</th><th>Actions</th></tr></thead><tbody>{orders.length === 0 ? <tr><td colSpan="6" className="portal-empty">No purchase orders have been received yet.</td></tr> : orders.map(order => <tr key={order._id}><td><strong>{order.orderNumber}</strong></td><td><div className="order-items">{order.items.map(item => <span key={`${order._id}-${item.productName}`}>{item.productName} <b>× {item.quantity}</b></span>)}</div></td><td><span className={`status-badge ${statusClass(order.status)}`}>{order.status}</span></td><td><span className={`status-badge ${statusClass(order.deliveryStatus)}`}>{order.deliveryStatus}</span></td><td>{new Date(order.orderDate).toLocaleDateString()}</td><td>{['Received', 'Rejected'].includes(order.status) ? <span className="order-closed">Closed</span> : <div className="order-actions"><button className="order-complete" onClick={() => updateOrderStatus(order, 'Received')}><CheckCircle size={14} /> Complete</button><button className="order-reject" onClick={() => updateOrderStatus(order, 'Rejected')}><XCircle size={14} /> Reject</button></div>}</td></tr>)}</tbody></table></div></section>
    </main>
  </div>;
};

export default SupplierDashboard;
