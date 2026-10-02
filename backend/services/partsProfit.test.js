const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePartsNetProfit } = require('./partsProfit');

test('calculates part profit after allocating invoice discount, excluding tax', () => {
  const items = [
    { quantity: 2, priceAtSale: 40, unitCostAtSale: 25 },
    { quantity: 1, priceAtSale: 20, unitCostAtSale: 10 }
  ];

  assert.equal(calculatePartsNetProfit(items, 10, 100), 30);
  assert.equal(calculatePartsNetProfit(items, 12, 120), 30);
});

test('returns unknown profit if any part has no recorded cost', () => {
  assert.equal(calculatePartsNetProfit([
    { quantity: 1, priceAtSale: 40, unitCostAtSale: 25 },
    { quantity: 1, priceAtSale: 20, unitCostAtSale: null }
  ], 0, 60), null);
});
