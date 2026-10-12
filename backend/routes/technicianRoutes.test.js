const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const technicianRoutes = require('./technicianRoutes');
const { JWT_SECRET } = require('../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/technicians', technicianRoutes);

let server;

test.before(() => new Promise((resolve, reject) => {
  server = app.listen(0, '127.0.0.1', resolve);
  server.once('error', reject);
}));

test.after(() => new Promise((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve());
}));

const tokenFor = role => jwt.sign({ id: 'test-user', role }, JWT_SECRET);
const request = (path, role, options = {}) => fetch(
  `http://127.0.0.1:${server.address().port}/api/technicians${path}`,
  {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(role ? { Authorization: `Bearer ${tokenFor(role)}` } : {}),
      ...options.headers
    }
  }
);

test('technician management requires owner authorization', async () => {
  const unauthorized = await request('/management');
  assert.equal(unauthorized.status, 401);

  const customerRead = await request('/management', 'Customer');
  assert.equal(customerRead.status, 403);

  const technicianCreate = await request('/', 'Technician', {
    method: 'POST',
    body: JSON.stringify({ name: 'Not allowed', email: 'technician@example.com', password: 'password123' })
  });
  assert.equal(technicianCreate.status, 403);
});

test('technician account creation validates required credentials before database access', async () => {
  const response = await request('/', 'Owner', {
    method: 'POST',
    body: JSON.stringify({ name: 'New Technician', email: 'bad-email', password: 'short' })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Enter a valid technician email address.' });
});
