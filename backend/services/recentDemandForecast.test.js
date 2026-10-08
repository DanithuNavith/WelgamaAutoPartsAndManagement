const test = require('node:test');
const assert = require('node:assert/strict');
const { createRecentDemandForecast } = require('./recentDemandForecast');

const product = (id, quantity, lowStockThreshold = 5, category = 'Filters') => ({
  _id: id,
  name: `Part ${id}`,
  category,
  quantity,
  lowStockThreshold
});

test('forecasts 7-day part demand using the recent daily average', () => {
  const [forecast] = createRecentDemandForecast({
    products: [product('part-1', 9)],
    demandByProduct: new Map([['part-1', 28]])
  });

  assert.equal(forecast.pred_daily_demand, 1);
  assert.equal(forecast.forecast_demand_7d, 7);
  assert.equal(forecast.days_to_threshold, 4);
  assert.equal(forecast.flag, 'HIGH - reorder now');
});

test('flags current low stock and reports no days remaining to threshold', () => {
  const [forecast] = createRecentDemandForecast({
    products: [product('part-1', 3)],
    demandByProduct: new Map([['part-1', 14]])
  });

  assert.equal(forecast.flag, 'CRITICAL - already low');
  assert.equal(forecast.days_to_threshold, 0);
  assert.equal(forecast.pred_daily_demand, 0.5);
  assert.ok(forecast.suggested_order_qty > 0);
});

test('flags products likely to cross the threshold within seven days', () => {
  const [forecast] = createRecentDemandForecast({
    products: [product('part-1', 7)],
    demandByProduct: new Map([['part-1', 56]])
  });

  assert.equal(forecast.flag, 'HIGH - reorder now');
  assert.ok(forecast.p_low_7d >= 0.5);
});

test('omits healthy products with no recent demand', () => {
  const forecasts = createRecentDemandForecast({
    products: [product('part-1', 10)],
    demandByProduct: new Map()
  });

  assert.deepEqual(forecasts, []);
});
