const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const authRoutes = require('./authRoutes');
const { isValidEmail } = require('../utils/emailValidation');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

let server;

test.before(() => new Promise((resolve, reject) => {
  server = app.listen(0, '127.0.0.1', resolve);
  server.once('error', reject);
}));

test.after(() => new Promise((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve());
}));

test('blocks self-registration for every non-customer role', async () => {
  const url = `http://127.0.0.1:${server.address().port}/api/auth/register`;

  for (const role of ['Owner', 'Technician', 'Supplier', 'Admin']) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'password', role })
    });

    assert.equal(response.status, 403, `${role} registration should be forbidden`);
    assert.deepEqual(await response.json(), { message: 'Only customer accounts can be registered here.' });
  }
});

test('rejects malformed email addresses during customer registration', async () => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Customer',
      email: 'not-an-email',
      password: 'password123',
      role: 'Customer'
    })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'Enter a valid email address.' });
});

test('rejects malformed email addresses for every login role', async () => {
  for (const role of ['Owner', 'Customer', 'Technician', 'Supplier']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email', password: 'password123', role })
    });

    assert.equal(response.status, 400, `${role} login should reject malformed email`);
    assert.deepEqual(await response.json(), { message: 'Enter a valid email address.' });
  }
});

test('validates email length, local-part syntax, and domain labels', () => {
  const validAddresses = [
    'customer@example.com',
    ' customer@example.com ',
    'first.last+parts@example.co.uk',
    'user_name!tag@example-domain.org',
    'customer@xn--bcher-kva.example',
    'user@domain.xn--p1ai'
  ];
  const invalidAddresses = [
    '.leading@example.com',
    'trailing.@example.com',
    'two..dots@example.com',
    'has space@example.com',
    'has\\slash@example.com',
    'a'.repeat(65) + '@example.com',
    'customer@-example.com',
    'customer@example-.com',
    'customer@example..com',
    'customer@example.c',
    'customer@example.123',
    `customer@${'a'.repeat(64)}.com`,
    `${'a'.repeat(64)}@${'b'.repeat(180)}.com`
  ];

  for (const address of validAddresses) {
    assert.equal(isValidEmail(address), true, `${address} should be accepted`);
  }
  for (const address of invalidAddresses) {
    assert.equal(isValidEmail(address), false, `${address} should be rejected`);
  }
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(123), false);
});
