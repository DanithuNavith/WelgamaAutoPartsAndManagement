const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupplierPurchaseOrderEmail } = require('./supplierPurchaseOrderEmail');

test('builds supplier purchase-order email with the registered address and requested items', () => {
  const message = createSupplierPurchaseOrderEmail({
    orderNumber: 'PO-20260930',
    orderDate: new Date('2026-09-30T00:00:00.000Z'),
    total: 3000,
    items: [{ productName: 'Brake <Pad>', quantity: 2, unitPrice: 1500 }]
  }, {
    contactPerson: 'Nimal',
    email: 'supplier@example.com'
  });

  assert.equal(message.to, 'supplier@example.com');
  assert.match(message.subject, /PO-20260930/);
  assert.match(message.text, /Brake <Pad> — 2 × Rs\. 1500\.00 = Rs\. 3000\.00/);
  assert.match(message.html, /Brake &lt;Pad&gt;/);
  assert.match(message.html, /<td>2<\/td>/);
  assert.match(message.html, /Total: Rs\. 3000\.00/);
});
