const test = require('node:test');
const assert = require('node:assert/strict');
const { backfillJobCardNames } = require('./backfillJobCardNames');

test('backfills missing readable customer and technician names on existing job cards', async () => {
  const updates = [];
  const jobs = [
    {
      _id: 'job-1',
      customerName: 'Existing Customer',
      technicianName: '',
      customer: { name: 'Existing Customer' },
      technician: { name: 'Technician One' }
    },
    {
      _id: 'job-2',
      customerName: '',
      technicianName: 'Existing Technician',
      customer: { name: 'Customer Two' },
      technician: { name: 'Existing Technician' }
    }
  ];
  const query = {
    populate() { return this; },
    then(resolve) { return Promise.resolve(jobs).then(resolve); }
  };
  const JobCard = {
    find: filter => {
      assert.deepEqual(filter.$or, [
        { customerName: { $exists: false } },
        { customerName: '' },
        { technicianName: { $exists: false } },
        { technicianName: '' }
      ]);
      return query;
    },
    bulkWrite: async operations => {
      updates.push(...operations);
      return { modifiedCount: operations.length };
    }
  };

  const modifiedCount = await backfillJobCardNames(JobCard);

  assert.equal(modifiedCount, 2);
  assert.deepEqual(updates, [
    { updateOne: { filter: { _id: 'job-1' }, update: { $set: { technicianName: 'Technician One' } } } },
    { updateOne: { filter: { _id: 'job-2' }, update: { $set: { customerName: 'Customer Two' } } } }
  ]);
});

test('does not write when no referenced names are available', async () => {
  const JobCard = {
    find: () => ({
      populate() { return this; },
      then(resolve) {
        return Promise.resolve([{ _id: 'job-1', customerName: '', technicianName: '', customer: null, technician: null }]).then(resolve);
      }
    }),
    bulkWrite: async () => {
      throw new Error('bulkWrite should not be called without names to backfill');
    }
  };

  assert.equal(await backfillJobCardNames(JobCard), 0);
});
