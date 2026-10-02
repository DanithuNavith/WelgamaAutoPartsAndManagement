const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { calculatePartsInvoiceTotal, createPartsInvoicePdf, sendPartsInvoiceEmail } = require('./partsInvoiceEmail');
const { createCustomerInvoiceHtml, getInvoiceDocumentData } = require('./customerInvoiceDocument');

test('calculates parts-only invoice totals without tax', () => {
  assert.equal(calculatePartsInvoiceTotal(3000, 0), 3000);
  assert.equal(calculatePartsInvoiceTotal(3000, 100), 2900);
  assert.equal(calculatePartsInvoiceTotal(10.01, 0.02), 9.99);
});

test('creates a PDF parts invoice with customer details and item lines', async () => {
  const pdf = await createPartsInvoicePdf({
    _id: '1234567890abcdef12345678',
    customerName: 'Casey Customer',
    customerPhone: '0771234567',
    customerEmail: 'casey@example.com',
    createdAt: new Date('2026-09-30T10:00:00.000Z'),
    items: [{ productName: 'Brake Pad', quantity: 2, priceAtSale: 1500 }],
    subtotal: 3000,
    discount: 100,
    tax: 435,
    total: 3335,
    paymentStatus: 'Paid'
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.includes(Buffer.from('/Subtype /Image')), 'the Welgama logo should be embedded in the PDF');
});

test('renders a branded customer invoice with escaped customer and item details', () => {
  const html = createCustomerInvoiceHtml(getInvoiceDocumentData({
    invoice: {
      _id: '1234567890abcdef12345678',
      createdAt: new Date('2026-09-30T10:00:00.000Z'),
      paymentStatus: 'Paid',
      items: [{ productName: 'Brake <Pad>', quantity: 2, priceAtSale: 1500 }],
      subtotal: 3000,
      discount: 100,
      tax: 0,
      total: 2900
    },
    type: 'Parts',
    customerName: 'Casey & Co.',
    customerPhone: '0771234567',
    customerEmail: 'casey@example.com'
  }));

  assert.match(html, /WELGAMA/);
  assert.match(html, /INV-12345678/);
  assert.match(html, /Casey &amp; Co\./);
  assert.match(html, /Brake &lt;Pad&gt;/);
  assert.match(html, /Payment Status:<\/strong> PAID/);
  assert.match(html, /- Rs\. 100\.00/);
  assert.doesNotMatch(html, />Tax</);
});

test('attaches the redesigned branded PDF when emailing a parts invoice', async () => {
  const originalCreateTransport = nodemailer.createTransport;
  const originalEnv = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS
  };
  let message;
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_USER = 'sender@example.test';
  process.env.SMTP_PASS = 'test-password';
  nodemailer.createTransport = () => ({
    sendMail: async options => { message = options; }
  });

  try {
    await sendPartsInvoiceEmail({
      _id: '1234567890abcdef12345678',
      createdAt: new Date('2026-09-30T10:00:00.000Z'),
      paymentStatus: 'Paid',
      customerName: 'Casey Customer',
      customerPhone: '0771234567',
      customerEmail: 'casey@example.com',
      items: [{ productName: 'Toyota Aqua Headlight', quantity: 1, priceAtSale: 45000 }],
      subtotal: 45000,
      discount: 0,
      tax: 0,
      total: 45000
    }, 'casey@example.com');
  } finally {
    nodemailer.createTransport = originalCreateTransport;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  assert.equal(message.attachments[0].filename, 'INV-12345678.pdf');
  assert.ok(message.attachments[0].content.includes(Buffer.from('/Subtype /Image')), 'emailed PDF should contain the Welgama logo');
  assert.match(message.html, /Parts Purchased/);
});
