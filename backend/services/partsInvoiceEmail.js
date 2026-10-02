const nodemailer = require('nodemailer');
const {
  createCustomerInvoiceHtml,
  createCustomerInvoicePdf,
  formatMoney,
  getInvoiceDocumentData,
  getInvoiceNumber
} = require('./customerInvoiceDocument');

const calculatePartsInvoiceTotal = (subtotal, discount) => Number((Number(subtotal) - Number(discount)).toFixed(2));

const createPartsInvoicePdf = invoice => createCustomerInvoicePdf(getInvoiceDocumentData({
  invoice,
  type: 'Parts',
  customerName: invoice.customerName,
  customerPhone: invoice.customerPhone,
  customerEmail: invoice.customerEmail
}));

const sendPartsInvoiceEmail = async (invoice, recipient) => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in the backend environment.');
  }

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
  const documentData = getInvoiceDocumentData({
    invoice,
    type: 'Parts',
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    customerEmail: invoice.customerEmail
  });
  const invoiceNumber = getInvoiceNumber(invoice);
  const pdf = await createCustomerInvoicePdf(documentData);

  await transporter.sendMail({
    from: process.env.MAIL_FROM || SMTP_USER,
    to: recipient,
    subject: `Parts invoice ${invoiceNumber} - Welgama Auto Parts`,
    text: `Dear ${invoice.customerName},\n\nThank you for shopping with Welgama Auto Parts. Your parts invoice total is ${formatMoney(invoice.total)} and the payment status is ${invoice.paymentStatus}.\n\nYour invoice is attached as a PDF.\n\nWelgama Auto Parts`,
    html: createCustomerInvoiceHtml(documentData),
    attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' }]
  });
};

module.exports = { calculatePartsInvoiceTotal, createPartsInvoicePdf, sendPartsInvoiceEmail };
