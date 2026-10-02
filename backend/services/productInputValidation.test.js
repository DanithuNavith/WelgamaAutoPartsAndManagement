const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProductInput } = require('./productInputValidation');

const validProduct = {
  name: 'Oil filter',
  category: 'Filters',
  price: 2500,
  costPrice: 1800,
  quantity: 12,
  lowStockThreshold: 5,
  image: ''
};

test('accepts valid inventory product details', () => {
  assert.equal(validateProductInput(validProduct), null);
  assert.equal(validateProductInput({ ...validProduct, quantity: 0, lowStockThreshold: 0 }), null);
});

test('rejects empty and out-of-range product names and categories', () => {
  assert.match(validateProductInput({ ...validProduct, name: ' ' }), /name is required/i);
  assert.match(validateProductInput({ ...validProduct, name: 'X' }), /name must be between/i);
  assert.match(validateProductInput({ ...validProduct, category: ' ' }), /category is required/i);
});

test('rejects invalid prices, costs, quantities, and low-stock thresholds', () => {
  assert.match(validateProductInput({ ...validProduct, price: 0 }), /price must be greater/i);
  assert.match(validateProductInput({ ...validProduct, costPrice: -1 }), /cost price must be zero/i);
  assert.match(validateProductInput({ ...validProduct, costPrice: 2501 }), /cannot be greater/i);
  assert.match(validateProductInput({ ...validProduct, quantity: 1.5 }), /quantity must be a whole number/i);
  assert.match(validateProductInput({ ...validProduct, quantity: -1 }), /quantity must be a whole number/i);
  assert.match(validateProductInput({ ...validProduct, lowStockThreshold: 1.5 }), /threshold must be a whole number/i);
});

test('only accepts supported base64 image data within 5 MB', () => {
  assert.equal(validateProductInput({ ...validProduct, image: 'data:image/png;base64,aGVsbG8=' }), null);
  assert.match(validateProductInput({ ...validProduct, image: 'data:text/html;base64,PGgxPkhlbGxvPC9oMT4=' }), /valid jpeg, png, gif, or webp/i);
  const oversizedImage = `data:image/png;base64,${'A'.repeat(Math.ceil(5 * 1024 * 1024 * 4 / 3) + 4)}`;
  assert.match(validateProductInput({ ...validProduct, image: oversizedImage }), /smaller than 5 MB/i);
});
