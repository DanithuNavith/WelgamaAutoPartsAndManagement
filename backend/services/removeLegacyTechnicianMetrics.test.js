const test = require('node:test');
const assert = require('node:assert/strict');
const { removeLegacyTechnicianMetrics } = require('./removeLegacyTechnicianMetrics');

test('unsets old technician metrics from stored jobs, sales, and technician profiles', async () => {
  const calls = [];
  const model = name => ({
    updateMany: async (...args) => {
      calls.push({ name, args });
      return { modifiedCount: 1 };
    }
  });

  const modifiedCount = await removeLegacyTechnicianMetrics({
    JobCard: model('jobs'),
    Sale: model('sales'),
    Technician: model('technicians')
  });

  assert.equal(modifiedCount, 3);
  assert.deepEqual(calls, [
    {
      name: 'jobs',
      args: [{}, { $unset: { technicianHours: '', technicianRate: '', estimatedCost: '' } }, { strict: false }]
    },
    {
      name: 'sales',
      args: [{}, { $unset: { technicianHours: '', technicianRate: '', estimatedCost: '' } }, { strict: false }]
    },
    {
      name: 'technicians',
      args: [{}, { $unset: { hourlyRate: '' } }, { strict: false }]
    }
  ]);
});
