const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const path = require('path');

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
    margin: 14,
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

  const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const left = document.page.margins.left;
  const logoPath = path.resolve(__dirname, '../public/welgama-logo.png');
  const borderColor = '#d5dbe3';
  const labelColor = '#f0f2f5';

  const drawCell = ({ x, top, width, height, text, fill = '#fff', color = '#222', bold = false, fontSize = 8.5 }) => {
    document.save().rect(x, top, width, height).fillAndStroke(fill, borderColor).restore();
    document.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
      .text(String(text ?? ''), x + 7, top + (height - fontSize) / 2 - 1, {
        width: Math.max(width - 14, 1),
        height: Math.max(height - 3, 1),
        ellipsis: true,
        lineBreak: false
      });
  };

  const drawDetailsRow = (top, firstLabel, firstValue, secondLabel, secondValue) => {
    const labelWidth = pageWidth * 0.17;
    const valueWidth = pageWidth * 0.33;
    let x = left;
    drawCell({ x, top, width: labelWidth, height: 21, text: firstLabel.toUpperCase(), fill: labelColor, bold: true, fontSize: 7.2 });
    x += labelWidth;
    drawCell({ x, top, width: valueWidth, height: 21, text: firstValue, fontSize: 8.2 });
    x += valueWidth;
    drawCell({ x, top, width: labelWidth, height: 21, text: secondLabel.toUpperCase(), fill: labelColor, bold: true, fontSize: 7.2 });
    x += labelWidth;
    drawCell({ x, top, width: pageWidth - labelWidth - valueWidth - labelWidth, height: 21, text: secondValue, fontSize: 8.2 });
  };

  const logoWidth = 100;
  const logoHeight = logoWidth * 724 / 2171;
  document.image(logoPath, left + (pageWidth - logoWidth) / 2, 18, { width: logoWidth, height: logoHeight });
  document.fillColor('#111827').font('Helvetica-Bold').fontSize(15)
    .text('Welgama Auto Parts', left, 52, { width: pageWidth, align: 'center' });
  document.fillColor('#5d687a').font('Helvetica').fontSize(8)
    .text('SUPPLIER PORTAL WELCOME', left, 70, { width: pageWidth, align: 'center', characterSpacing: 0.7 });

  let y = 91;
  drawDetailsRow(y, 'Supplier', supplier.name, 'Contact Person', supplier.contactPerson);
  y += 21;
  drawDetailsRow(y, 'Email', supplier.email, 'Account Type', 'Registered Supplier');
  y += 34;

  document.fillColor('#222').font('Helvetica-Bold').fontSize(9.2)
    .text('Supplier Login Details', left, y);
  y += 16;
  const labelWidth = pageWidth * 0.25;
  const credentialRows = [
    ['LOGIN EMAIL', supplier.email, '#222'],
    ['TEMPORARY PASSWORD', password, '#0756b8']
  ];
  credentialRows.forEach(([label, value, color]) => {
    drawCell({ x: left, top: y, width: labelWidth, height: 25, text: label, fill: labelColor, bold: true, fontSize: 7.4 });
    drawCell({ x: left + labelWidth, top: y, width: pageWidth - labelWidth, height: 25, text: value, color, bold: true, fontSize: 9 });
    y += 25;
  });

  y += 16;
  document.rect(left, y, pageWidth, 35).fillAndStroke('#f8f9fb', '#cbd2db');
  document.fillColor('#222').font('Helvetica-Bold').fontSize(8)
    .text('PDF password:', left + 8, y + 8);
  document.font('Helvetica').fontSize(8)
    .text('Use the last four digits of the phone number registered to your supplier account.', left + 83, y + 8, {
      width: pageWidth - 92,
      height: 20,
      ellipsis: true
    });

  y += 52;
  document.fillColor('#60656d').font('Helvetica').fontSize(7.5)
    .text('Sign in to the supplier portal and keep these credentials private. Change your temporary password after your first sign-in.', left + 8, y, {
      width: pageWidth - 16,
      align: 'center'
    });
  document.fillColor('#60656d').fontSize(7.3)
    .text('Welgama Auto Parts | Supplier Account', left + 18, y + 34);
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
