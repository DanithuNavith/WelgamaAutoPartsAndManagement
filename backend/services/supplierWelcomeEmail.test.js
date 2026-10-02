const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupplierCredentialsPdf, getSupplierPdfPassword } = require('./supplierWelcomeEmail');

test('uses the last four phone digits as the supplier PDF password', () => {
  assert.equal(getSupplierPdfPassword('+94 (77) 123-4567'), '4567');
  assert.equal(getSupplierPdfPassword('123'), '123');
});

test('creates an encrypted supplier credentials PDF without exposing credentials in its bytes', async () => {
  const password = 'SupplierSecret123';
  const pdf = await createSupplierCredentialsPdf({
    supplier: {
      name: 'Metro Auto Supplies',
      contactPerson: 'Nimal Perera',
      email: 'supplier@example.com'
    },
    password,
    pdfPassword: '4567'
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.match(pdf.toString('latin1'), /\/Encrypt\s+\d+\s+\d+\s+R/);
  assert.equal(pdf.includes(Buffer.from(password)), false);
  assert.equal(pdf.includes(Buffer.from('supplier@example.com')), false);
});
