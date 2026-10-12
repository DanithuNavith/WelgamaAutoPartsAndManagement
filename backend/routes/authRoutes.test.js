const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const authRoutes = require('./authRoutes');

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
