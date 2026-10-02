const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { createInvoicePdf, getRepairInvoiceDocumentData, getVehicleDetails, sendRepairInvoiceEmail } = require('./repairInvoiceEmail');

test('omits placeholder wording from invoice vehicle details', () => {
  assert.deepEqual(getVehicleDetails({
    vehicleMake: 'Not provided BMW',
    vehicleModel: 'i8',
    registrationNumber: 'Not provided WP CCC-8985'
  }), {
    name: 'BMW i8',
    registration: 'WP CCC-8985'
  });
});

test('omits vehicle details that contain only placeholder wording', () => {
  assert.deepEqual(getVehicleDetails({
    vehicleMake: 'Not provided',
    vehicleModel: '  not provided ',
    registrationNumber: 'Not provided',
    licensePlate: 'Not provided'
  }), {
    name: '',
    registration: ''
  });
});

test('includes customer, job, vehicle, parts, and labor in the repair invoice', () => {
  const document = getRepairInvoiceDocumentData({
    _id: '1234567890abcdef12345678',
    createdAt: new Date('2026-09-30T10:00:00.000Z'),
    paymentStatus: 'Pending',
    technicianCost: 2500,
    items: [{ productName: 'Oil Filter', quantity: 1, priceAtSale: 1500 }],
    subtotal: 4000,
    discount: 0,
    tax: 0,
    total: 4000
  }, {
    jobCardNumber: 'JC-2026-0123',
    customerName: 'Casey Customer',
    customerPhone: '0771234567',
    customerEmail: 'casey@example.com',
    vehicleMake: 'Toyota',
    vehicleModel: 'Aqua',
    registrationNumber: 'WP ABC-1234'
  });

  assert.equal(document.type, 'Repair');
  assert.equal(document.customerName, 'Casey Customer');
  assert.deepEqual(document.details, [
    { label: 'Job Card', value: 'JC-2026-0123' },
    { label: 'Vehicle', value: 'Toyota Aqua · WP ABC-1234' }
  ]);
  assert.deepEqual(document.items.map(item => item.description), ['Oil Filter', 'Repair labor']);
  assert.equal(document.items[1].unitPrice, 2500);
});

test('creates a PDF repair invoice using the customer invoice layout', async () => {
  const pdf = await createInvoicePdf({
    _id: '1234567890abcdef12345678',
    createdAt: new Date('2026-09-30T10:00:00.000Z'),
    paymentStatus: 'Paid',
    technicianCost: 2500,
    items: [{ productName: 'Oil Filter', quantity: 1, priceAtSale: 1500 }],
    subtotal: 4000,
    discount: 0,
    tax: 0,
    total: 4000
  }, {
    jobCardNumber: 'JC-2026-0123',
    customerName: 'Casey Customer',
    customerPhone: '0771234567',
    customerEmail: 'casey@example.com',
    vehicleMake: 'Toyota',
    vehicleModel: 'Aqua',
    registrationNumber: 'WP ABC-1234'
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});

test('attaches the redesigned branded PDF when emailing a repair invoice', async () => {
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
    await sendRepairInvoiceEmail({
      _id: '1234567890abcdef12345678',
      createdAt: new Date('2026-09-30T10:00:00.000Z'),
      paymentStatus: 'Paid',
      technicianCost: 8000,
      items: [{ productName: 'Suzuki Wagon R Door', quantity: 1, priceAtSale: 45000 }],
      subtotal: 53000,
      discount: 200,
      tax: 0,
      total: 52800
    }, {
      jobCardNumber: 'JC-2026-0123',
      customerName: 'Casey Customer',
      customerPhone: '0771234567',
      customerEmail: 'casey@example.com',
      vehicleMake: 'Toyota',
      vehicleModel: 'Aqua',
      registrationNumber: 'WP ABC-1234'
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
  assert.match(message.html, /Repair Services/);
});
