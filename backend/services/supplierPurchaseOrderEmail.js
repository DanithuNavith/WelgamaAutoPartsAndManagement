const nodemailer = require('nodemailer');

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const formatMoney = value => `Rs. ${Number(value || 0).toFixed(2)}`;

const createSupplierPurchaseOrderEmail = (order, supplier) => {
  const items = order.items || [];
  const itemRows = items.map(item => (
    `<tr><td>${escapeHtml(item.productName)}</td><td>${Number(item.quantity)}</td><td>${formatMoney(item.unitPrice)}</td><td>${formatMoney(Number(item.quantity) * Number(item.unitPrice))}</td></tr>`
  )).join('');
  const textItems = items.map(item => (
    `${item.productName} — ${item.quantity} × ${formatMoney(item.unitPrice)} = ${formatMoney(Number(item.quantity) * Number(item.unitPrice))}`
  )).join('\n');

  return {
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: supplier.email,
    subject: `New parts purchase order ${order.orderNumber} - Welgama Auto Parts`,
    text: `Dear ${supplier.contactPerson},\n\nPlease supply the following items for purchase order ${order.orderNumber}:\n\n${textItems}\n\nOrder date: ${new Date(order.orderDate).toLocaleDateString()}\nTotal: ${formatMoney(order.total)}\n\nPlease sign in to the supplier portal to review and update this order.\n\nWelgama Auto Parts`,
    html: `<p>Dear ${escapeHtml(supplier.contactPerson)},</p><p>Please supply the following items for purchase order <strong>${escapeHtml(order.orderNumber)}</strong>:</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Part</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table><p>Order date: ${escapeHtml(new Date(order.orderDate).toLocaleDateString())}<br><strong>Total: ${formatMoney(order.total)}</strong></p><p>Please sign in to the supplier portal to review and update this order.</p><p>Welgama Auto Parts</p>`
  };
};

const sendSupplierPurchaseOrderEmail = async (order, supplier) => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in the backend environment.');
  }
  if (!supplier.email) throw new Error('This supplier does not have a registered email address.');

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000
  });

  await transporter.sendMail(createSupplierPurchaseOrderEmail(order, supplier));
};

module.exports = { createSupplierPurchaseOrderEmail, sendSupplierPurchaseOrderEmail };
