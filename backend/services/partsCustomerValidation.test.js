const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePartsCustomer } = require('./partsCustomerValidation');

const validCustomer = {
  customerName: 'Nimal Perera',
  customerPhone: '076 319 8527',
  customerEmail: 'nimal@example.com'
};

test('accepts valid parts invoice customer details', () => {
  assert.equal(validatePartsCustomer(validCustomer), null);
});

test('requires a bounded customer name, Sri Lankan phone, and valid email', () => {
  assert.match(validatePartsCustomer({ ...validCustomer, customerName: ' ' }), /name is required/i);
  assert.match(validatePartsCustomer({ ...validCustomer, customerName: 'N' }), /name must be between/i);
  assert.match(validatePartsCustomer({ ...validCustomer, customerName: 'N'.repeat(81) }), /name must be between/i);
  assert.match(validatePartsCustomer({ ...validCustomer, customerPhone: '' }), /phone number is required/i);
  assert.match(validatePartsCustomer({ ...validCustomer, customerPhone: '076123' }), /valid sri lankan phone/i);
  assert.match(validatePartsCustomer({ ...validCustomer, customerEmail: '' }), /email address is required/i);
  assert.match(validatePartsCustomer({ ...validCustomer, customerEmail: 'not-an-email' }), /valid email/i);
});
