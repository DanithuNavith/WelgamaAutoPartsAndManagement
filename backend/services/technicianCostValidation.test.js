const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTechnicianCost } = require('./technicianCostValidation');

test('accepts zero and valid technician repair costs', () => {
  assert.equal(parseTechnicianCost(0), 0);
  assert.equal(parseTechnicianCost('1250'), 1250);
  assert.equal(parseTechnicianCost('1250.5'), 1250.5);
  assert.equal(parseTechnicianCost('1250.50'), 1250.5);
});

test('rejects missing, negative, and invalid technician repair costs', () => {
  for (const value of ['', '   ', null, undefined]) {
    assert.throws(() => parseTechnicianCost(value), /repair cost is required/i);
  }
  assert.throws(() => parseTechnicianCost('-1'), /zero or greater/i);
  assert.throws(() => parseTechnicianCost('1.999'), /no more than 2 decimal places/i);
  assert.throws(() => parseTechnicianCost('invalid'), /valid amount/i);
});
