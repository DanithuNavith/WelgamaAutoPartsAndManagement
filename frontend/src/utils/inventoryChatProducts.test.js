import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findInventoryProductMatches, getProductSearchTerms } from './inventoryChatProducts.js';

const products = [
  { name: 'Toyota Aqua Rear Door', category: 'Body Parts', quantity: 10, price: 65000 },
  { name: 'Suzuki Wagon R Side Mirror', category: 'Body Parts' },
  { name: 'Toyota Stabilizer Link', category: 'Suspension' },
  { name: 'Honda Civic Brake Pad', category: 'Stabilizers' }
];

test('matches plural part names by complete normalized words', () => {
  assert.deepEqual(
    findInventoryProductMatches(products, 'what are the stabilizers you have').map(product => product.name),
    ['Toyota Stabilizer Link']
  );
});

test('does not match unrelated names or categories by partial substring', () => {
  assert.deepEqual(findInventoryProductMatches(products, 'stabilizer'), [
    products[2]
  ]);
  assert.deepEqual(findInventoryProductMatches(products, 'mirror'), [
    products[1]
  ]);
});

test('matches all meaningful words when a user names a specific part', () => {
  assert.deepEqual(
    findInventoryProductMatches(products, 'do we have Toyota Aqua Rear Door').map(product => product.name),
    ['Toyota Aqua Rear Door']
  );
  assert.deepEqual(
    findInventoryProductMatches(products, 'do we have Suzuki Wagon R Side Mirror').map(product => product.name),
    ['Suzuki Wagon R Side Mirror']
  );
  assert.deepEqual(
    findInventoryProductMatches(products, 'Do you have the Suzuki Wagon R mirror?').map(product => product.name),
    ['Suzuki Wagon R Side Mirror']
  );
});

test('drops question filler but keeps useful model and part words', () => {
  assert.deepEqual(getProductSearchTerms('What are the stabilizers you have?'), ['stabilizer']);
});
