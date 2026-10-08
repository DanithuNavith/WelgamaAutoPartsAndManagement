import React, { useEffect, useState } from 'react';
import { CheckCircle, ClipboardList, LogOut, Package, Truck, UserRound, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { API_BASE_URL } from '../services/apiBase';

const statusClass = value => value.toLowerCase().replaceAll(' ', '-');
const rejectionOptions = ['Out of stock', 'Price mismatch', 'Cannot deliver', 'Wrong item'];
const isValidPhone = value => {
  const cleaned = String(value || '').trim();
  if (!cleaned) return false;
  const normalized = cleaned.replace(/[\s()-]/g, '');
  return /^(?:\+94|94|0)\d{9}$/.test(normalized);
};

const SupplierDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState({ contactPerson: '', phone: '', address: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [error, setError] = useState('');
  const [rejectionOrder, setRejectionOrder] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token || ''}` };

    Promise.all([
      fetch(`${API_BASE_URL}/purchase-orders`, { headers }),
      fetch(`${API_BASE_URL}/suppliers/me`, { headers })
    ])
      .then(async ([ordersResponse, profileResponse]) => {
        if (!ordersResponse.ok || !profileResponse.ok) throw new Error('Unable to load supplier data');
        return [await ordersResponse.json(), await profileResponse.json()];
      })
      .then(([supplierOrders, supplierProfile]) => {
        setOrders(supplierOrders);
        setProfile({
          contactPerson: supplierProfile.contactPerson || '',
          phone: supplierProfile.phone || '',
          address: supplierProfile.address || ''
        });
      })
      .catch(err => setError(err.message));
  }, []);

  const saveProfile = async event => {
    event.preventDefault();

    const contactPerson = String(profile.contactPerson || '').trim();
    const phone = String(profile.phone || '').trim();
    const address = String(profile.address || '').trim();

    if (!contactPerson) {
      setProfileError('Contact person is required.');
      setProfileMessage('');
      return;
    }

    if (!address) {
      setProfileError('Address is required.');
      setProfileMessage('');
      return;
    }

    if (!isValidPhone(phone)) {
      setProfileError('Please enter a valid phone number.');
      setProfileMessage('');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/suppliers/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
      },
      body: JSON.stringify({ contactPerson, phone, address })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setProfileError(data.error || 'Could not update your profile.');
      setProfileMessage('');
      return;
    }

    setProfileError('');
    setProfileMessage('Profile updated successfully.');
  };

  const updateOrderStatus = async (order, status, reason = null) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${order._id}/supplier-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
      },
      body: JSON.stringify({ status, ...(status === 'Rejected' ? { rejectionReason: reason } : {}) })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error || 'Could not update this order.');
      return false;
    }

    setError('');
    setOrders(current => current.map(item => item._id === order._id ? {
      ...item,
      status: status === 'Received' ? 'Awaiting acceptance' : status,
      rejectionReason: status === 'Rejected' ? reason : null,
      deliveryStatus: status === 'Received' ? 'Delivered' : item.deliveryStatus
    } : item));
    return true;
  };

  const rejectSelectedOrder = async () => {
    if (!rejectionOrder || !rejectionOptions.includes(rejectionReason)) return;
    const updated = await updateOrderStatus(rejectionOrder, 'Rejected', rejectionReason);
    if (updated) {
      setRejectionOrder(null);
      setRejectionReason('');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    navigate('/supplier/login');
  };

  const totalItems = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

  return (
    <div className="supplier-portal">
      <header className="supplier-portal-header">
        <div className="portal-brand">
          <BrandLogo width={100} style={{ height: 'auto' }} />
          <small>Supplier portal</small>
        </div>
        <div className="portal-user">
          <UserRound size={17} /> {user?.name || 'Supplier'}
          <button className="portal-logout" onClick={logout}><LogOut size={15} /> Sign out</button>
        </div>
      </header>

      <main className="supplier-portal-main">
        <section className="supplier-welcome">
          <div>
            <p className="portal-kicker">SUPPLIER WORKSPACE</p>
            <h1>Welcome, {user?.name || 'Supplier'}.</h1>
            <p>Track the orders and deliveries connected to your Welgama Auto Parts account.</p>
          </div>
          <Truck size={58} />
        </section>

        {error && <div className="portal-error" role="alert">{error}</div>}

        <section className="portal-profile">
          <div>
            <p className="portal-kicker">ACCOUNT DETAILS</p>
            <h2>Keep your contact details current</h2>
          </div>

          <form onSubmit={saveProfile}>
            <input
              required
              value={profile.contactPerson}
              onChange={event => setProfile({ ...profile, contactPerson: event.target.value })}
              placeholder="Contact person"
            />
            {profileError && profile.contactPerson.trim() === '' && (
              <span className="profile-message helper-error">Contact person is required.</span>
            )}

            <input
              required
              value={profile.phone}
              onChange={event => setProfile({ ...profile, phone: event.target.value })}
              placeholder="Phone number"
            />
            {profileError && !isValidPhone(profile.phone) && (
              <span className="profile-message helper-error">Please enter a valid phone number.</span>
            )}

            <input
              required
              value={profile.address}
              onChange={event => setProfile({ ...profile, address: event.target.value })}
              placeholder="Address"
            />
            {profileError && profile.address.trim() === '' && (
              <span className="profile-message helper-error">Address is required.</span>
            )}

            <button className="portal-save" type="submit">Save profile</button>
            {profileMessage && <span className="profile-message">{profileMessage}</span>}
          </form>
        </section>

        <div className="portal-stats">
          <div>
            <ClipboardList size={20} />
            <span>Purchase orders</span>
            <strong>{orders.length}</strong>
          </div>
          <div>
            <Package size={20} />
            <span>Products ordered</span>
            <strong>{totalItems}</strong>
          </div>
          <div>
            <Truck size={20} />
            <span>In transit</span>
            <strong>{orders.filter(order => order.deliveryStatus === 'In transit').length}</strong>
          </div>
        </div>

        <section className="portal-orders">
          <div className="portal-section-heading">
            <div>
              <p className="portal-kicker">ORDER HISTORY</p>
              <h2>Orders from Welgama Auto Parts</h2>
            </div>
            <span className="portal-live">Live account data</span>
          </div>

          <div className="portal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Products & quantities</th>
                  <th>Order status</th>
                  <th>Delivery status</th>
                  <th>Order date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="portal-empty">No purchase orders have been received yet.</td>
                  </tr>
                ) : orders.map(order => (
                  <tr key={order._id}>
                    <td>
                      <strong>{order.orderNumber}</strong>
                      {order.status === 'Rejected' && order.rejectionReason && (
                        <div className="rejection-reason">Reason: {order.rejectionReason}</div>
                      )}
                    </td>
                    <td>
                      <div className="order-items">
                        {order.items.map(item => (
                          <span key={`${order._id}-${item.productName}`}>
                            {item.productName} <b>× {item.quantity}</b>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td><span className={`status-badge ${statusClass(order.status)}`}>{order.status}</span></td>
                    <td><span className={`status-badge ${statusClass(order.deliveryStatus)}`}>{order.deliveryStatus}</span></td>
                    <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td>
                      {['Awaiting acceptance', 'Received', 'Rejected'].includes(order.status) ? (
                        <span className="order-closed">{order.status === 'Awaiting acceptance' ? 'Awaiting owner acceptance' : 'Closed'}</span>
                      ) : (
                        <div className="order-actions">
                          <button className="order-complete" onClick={() => updateOrderStatus(order, 'Received')}>
                            <CheckCircle size={14} /> Complete
                          </button>
                          <button className="order-reject" onClick={() => { setError(''); setRejectionOrder(order); setRejectionReason(''); }}>
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {rejectionOrder && (
          <div className="rejection-dialog-backdrop">
            <section
              className="rejection-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rejection-dialog-title"
            >
              <h2 id="rejection-dialog-title">Reject order {rejectionOrder.orderNumber}</h2>
              <label htmlFor="rejection-reason">Choose a reason</label>
              <select
                id="rejection-reason"
                value={rejectionReason}
                onChange={event => setRejectionReason(event.target.value)}
              >
                <option value="" disabled>Select a reason</option>
                {rejectionOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <div className="rejection-dialog-actions">
                <button type="button" className="rejection-cancel" onClick={() => { setRejectionOrder(null); setRejectionReason(''); }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="order-reject"
                  disabled={!rejectionOptions.includes(rejectionReason)}
                  onClick={rejectSelectedOrder}
                >
                  <XCircle size={14} /> Confirm rejection
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default SupplierDashboard;
