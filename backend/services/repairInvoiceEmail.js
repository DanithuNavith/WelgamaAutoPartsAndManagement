const nodemailer = require('nodemailer');
const {
  createCustomerInvoiceHtml,
  createCustomerInvoicePdf,
  formatMoney,
  getInvoiceDocumentData,
  getInvoiceNumber
} = require('./customerInvoiceDocument');

const optionalText = value => String(value || '')
  .replace(/\bnot provided\b/gi, '')
  .replace(/\s+/g, ' ')
  .replace(/^[\s·,–—-]+|[\s·,–—-]+$/g, '')
  .trim();

const getVehicleDetails = job => ({
  name: [job.vehicleMake, job.vehicleModel].map(optionalText).filter(Boolean).join(' '),
  registration: [job.registrationNumber, job.licensePlate].map(optionalText).find(Boolean) || ''
});

const getRepairInvoiceDocumentData = (invoice, job) => {
  const vehicle = getVehicleDetails(job);
  const repairItems = (invoice.items || [])
    .filter(item => item.productName?.toLowerCase() !== 'repair labor')
    .map(item => item.toObject ? item.toObject() : item);
  if (Number(invoice.technicianCost || 0) > 0) {
    repairItems.push({
      productName: 'Repair labor',
      quantity: 1,
      priceAtSale: Number(invoice.technicianCost)
    });
  }

  return getInvoiceDocumentData({
    invoice: { ...(invoice.toObject ? invoice.toObject() : invoice), items: repairItems },
    type: 'Repair',
    customerName: job.customerName || job.customer?.name,
    customerPhone: job.customerPhone || job.customer?.phone,
    customerEmail: job.customerEmail || job.customer?.email,
    details: [
      { label: 'Job Card', value: job.jobCardNumber },
      { label: 'Vehicle', value: [vehicle.name, vehicle.registration].filter(Boolean).join(' · ') }
    ]
  });
};

const createInvoicePdf = (invoice, job) => createCustomerInvoicePdf(getRepairInvoiceDocumentData(invoice, job));

const sendRepairInvoiceEmail = async (invoice, job, recipient) => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in the backend environment.');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  const documentData = getRepairInvoiceDocumentData(invoice, job);
  const invoiceNumber = getInvoiceNumber(invoice);
  const pdf = await createCustomerInvoicePdf(documentData);

  await transporter.sendMail({
    from: process.env.MAIL_FROM || SMTP_USER,
    to: recipient,
    subject: `Repair invoice ${invoiceNumber} - Welgama Auto Parts`,
    text: `Dear ${job.customerName},\n\nYour repair (${job.jobCardNumber}) is complete. Your invoice total is ${formatMoney(invoice.total)} and the payment status is ${invoice.paymentStatus}.\n\nThe repair invoice is attached as a PDF.\n\nWelgama Auto Parts`,
    html: createCustomerInvoiceHtml(documentData),
    attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' }]
  });
};

module.exports = { createInvoicePdf, getRepairInvoiceDocumentData, getVehicleDetails, sendRepairInvoiceEmail };
