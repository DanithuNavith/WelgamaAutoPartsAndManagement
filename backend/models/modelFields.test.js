const test = require('node:test');
const assert = require('node:assert/strict');
const Customer = require('./Customer');
const Sale = require('./Sale');

test('customer records accept portal and walk-in types', async () => {
  const customerData = { name: 'Nimal Perera', phone: '0763198527' };

  for (const customerType of ['Portal', 'Walk-in']) {
    const customer = new Customer({ ...customerData, customerType });
    await customer.validate();
    assert.equal(customer.customerType, customerType);
  }

  const invalidCustomer = new Customer({ ...customerData, customerType: 'Online' });
  await assert.rejects(invalidCustomer.validate(), /not a valid enum value/i);
});

test('repair invoices retain labor and estimate fields while parts invoices omit them', async () => {
  const repair = new Sale({
    billType: 'REPAIR',
    technicianHours: 2.5,
    technicianRate: 1500,
    estimatedCost: 7000,
    technicianCost: 5000,
    partsCost: 69500,
    items: [],
    subtotal: 74500,
    tax: 0,
    total: 74500
  });
  await repair.validate();
  assert.equal(repair.technicianHours, 2.5);
  assert.equal(repair.technicianRate, 1500);
  assert.equal(repair.estimatedCost, 7000);
  assert.equal(repair.technicianCost, 5000);
  assert.equal(repair.partsCost, 69500);

  const partsSale = new Sale({ billType: 'PARTS', items: [], subtotal: 0, tax: 0, total: 0 });
  assert.equal(partsSale.technicianHours, undefined);
  assert.equal(partsSale.technicianRate, undefined);
  assert.equal(partsSale.estimatedCost, undefined);
  assert.equal(partsSale.technicianCost, undefined);
  assert.equal(partsSale.partsCost, undefined);
});
