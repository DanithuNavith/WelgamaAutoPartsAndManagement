const test = require('node:test');
const assert = require('node:assert/strict');
const Customer = require('./Customer');
const JobCard = require('./JobCard');
const Sale = require('./Sale');
const Technician = require('./Technician');

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

test('repair invoices retain the billed labor cost while obsolete metrics are not in the schema', async () => {
  const repair = new Sale({
    billType: 'REPAIR',
    technicianCost: 5000,
    partsCost: 69500,
    items: [],
    subtotal: 74500,
    tax: 0,
    total: 74500
  });
  await repair.validate();
  assert.equal(repair.technicianCost, 5000);
  assert.equal(repair.partsCost, 69500);
  assert.equal(Sale.schema.path('technicianHours'), undefined);
  assert.equal(Sale.schema.path('technicianRate'), undefined);
  assert.equal(Sale.schema.path('estimatedCost'), undefined);
  assert.equal(JobCard.schema.path('technicianHours'), undefined);
  assert.equal(JobCard.schema.path('technicianRate'), undefined);
  assert.equal(JobCard.schema.path('estimatedCost'), undefined);
  assert.equal(Technician.schema.path('hourlyRate'), undefined);

  const partsSale = new Sale({ billType: 'PARTS', items: [], subtotal: 0, tax: 0, total: 0 });
  assert.equal(partsSale.technicianCost, undefined);
  assert.equal(partsSale.partsCost, undefined);
});
