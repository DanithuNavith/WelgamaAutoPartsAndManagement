const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const getSupplierPdfPassword = phone => String(phone || '').replace(/\D/g, '').slice(-4);

const createSupplierCredentialsPdf = ({ supplier, password, pdfPassword }) => new Promise((resolve, reject) => {
  const document = new PDFDocument({
    size: 'A4',
    margin: 48,
    userPassword: pdfPassword,
    ownerPassword: crypto.randomBytes(32).toString('hex'),
    permissions: {
      printing: 'lowResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false
    }
  });
  const chunks = [];
  document.on('data', chunk => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);

  document.fontSize(20).text('Welgama Auto Parts');
  document.moveDown(0.3).fontSize(15).text('Supplier portal welcome');
  document.moveDown(0.8).fontSize(10);
  document.text(`Supplier: ${supplier.name}`);
  document.text(`Contact person: ${supplier.contactPerson}`);
  document.text(`Email: ${supplier.email}`);
  document.moveDown();
  document.fontSize(12).text('Supplier login details', { underline: true });
  document.moveDown(0.5).fontSize(10);
  document.text(`Login email: ${supplier.email}`);
  document.text(`Temporary password: ${password}`);
  document.moveDown();
  document.text('Sign in at the supplier portal and keep these credentials private.');
  document.end();
});

const sendSupplierWelcomeEmail = async (supplier, password) => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in the backend environment.');
  }
  const pdfPassword = getSupplierPdfPassword(supplier.phone);
  if (pdfPassword.length !== 4) {
    throw new Error('Supplier phone number must contain at least four digits to protect the credentials PDF.');
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
  const pdf = await createSupplierCredentialsPdf({ supplier, password, pdfPassword });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || SMTP_USER,
    to: supplier.email,
    subject: 'Welcome to the Welgama Auto Parts supplier portal',
    text: `Dear ${supplier.contactPerson},\n\nWelcome to the Welgama Auto Parts supplier portal. Your login email and password are in the attached password-protected PDF.\n\nTo open the PDF, use the last four digits of the phone number registered with your supplier account. Keep the PDF and its password private.\n\nWelgama Auto Parts`,
    html: `<p>Dear ${escapeHtml(supplier.contactPerson)},</p><p>Welcome to the Welgama Auto Parts supplier portal.</p><p>Your login email and password are in the attached password-protected PDF. To open it, use the <strong>last four digits of the phone number</strong> registered with your supplier account. Keep the PDF and its password private.</p><p>Welgama Auto Parts</p>`,
    attachments: [{
      filename: 'Welgama-Supplier-Login.pdf',
      content: pdf,
      contentType: 'application/pdf'
    }]
  });
};

module.exports = { createSupplierCredentialsPdf, getSupplierPdfPassword, sendSupplierWelcomeEmail };
