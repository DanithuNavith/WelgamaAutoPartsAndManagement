const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidSriLankanPhone,
  isValidSriLankanPlate,
  validateCustomerInput,
  validateJobCardInput,
  validateVehicleInput
} = require('./repairInputValidation');

test('validates Sri Lankan phone numbers and registration plates', () => {
  assert.equal(isValidSriLankanPhone('076 319 8527'), true);
  assert.equal(isValidSriLankanPhone('+94 76 319 8527'), true);
  assert.equal(isValidSriLankanPhone('076319852789'), false);
  assert.equal(isValidSriLankanPlate('ABC-1234'), true);
  assert.equal(isValidSriLankanPlate('AB-1234'), true);
  assert.equal(isValidSriLankanPlate('ABCD-1234'), false);
});

test('validates customer and vehicle details', () => {
  const customer = {
    name: 'Nimal Perera',
    phone: '0763198527',
    email: 'nimal@example.com',
    address: 'Colombo',
    vehicles: [{ licensePlate: 'ABC-1234', model: 'Toyota Aqua', year: 2020 }]
  };

  assert.equal(validateCustomerInput(customer), null);
  assert.match(validateCustomerInput({ ...customer, phone: '076319852789' }), /phone number/);
  assert.match(validateVehicleInput({ licensePlate: 'ABCD-1234', model: 'Aqua', year: 2020 }), /plate/);
  assert.match(validateVehicleInput({ licensePlate: 'ABC-1234', model: 'A', year: 2020 }), /model/);
  assert.match(validateVehicleInput({ licensePlate: 'ABC-1234', model: 'Aqua', year: 1899 }), /year/);
});

test('validates job card description length and future appointment date', () => {
  const now = new Date(2026, 0, 1, 10, 0);
  const validJob = {
    issueDescription: 'Engine makes unusual noise',
    appointmentDate: '2026-01-02T09:00'
  };

  assert.equal(validateJobCardInput(validJob, now), null);
  assert.match(validateJobCardInput({ ...validJob, issueDescription: 'Noise' }, now), /10 and 500/);
  assert.match(validateJobCardInput({ ...validJob, appointmentDate: '2025-12-31T09:00' }, now), /future/);
  assert.match(validateJobCardInput({ ...validJob, appointmentDate: '2026-02-30T09:00' }, now), /valid appointment/);
});
