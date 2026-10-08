const HORIZON_DAYS = 7;

const poissonProbabilityAbove = (mean, maximumAllowed) => {
  if (maximumAllowed < 0) return 1;
  if (mean <= 0) return 0;
  if (mean > 700) {
    const deviation = Math.sqrt(mean);
    const z = (maximumAllowed + 0.5 - mean) / deviation;
    return Math.min(1, Math.max(0, 0.5 * (1 - erf(z / Math.sqrt(2)))));
  }

  let probability = Math.exp(-mean);
  let cumulative = probability;
  for (let quantity = 1; quantity <= maximumAllowed; quantity += 1) {
    probability *= mean / quantity;
    cumulative += probability;
  }
  return Math.min(1, Math.max(0, 1 - cumulative));
};

const erf = value => {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const approximation = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * approximation;
};

const createRecentDemandForecast = ({ products, demandByProduct, historyDays = 28 }) => {
  if (!Number.isInteger(historyDays) || historyDays < 1) {
    throw new RangeError('Forecast history must be a positive whole number of days.');
  }

  return products.map(product => {
    const stock = Number(product.quantity);
    const threshold = Number(product.lowStockThreshold ?? 5);
    const demand = Number(demandByProduct.get(String(product._id)) || 0);
    const dailyDemand = demand / historyDays;
    const forecastDemand = dailyDemand * HORIZON_DAYS;
    const headroom = stock - threshold;
    const probability = poissonProbabilityAbove(forecastDemand, Math.floor(headroom));
    const daysToThreshold = headroom <= 0 ? 0 : dailyDemand > 0 ? headroom / dailyDemand : null;
    const flag = stock <= threshold
      ? 'CRITICAL - already low'
      : probability >= 0.5
        ? 'HIGH - reorder now'
        : probability >= 0.2
          ? 'WATCH - likely low within 7 days'
          : 'OK';
    const leadDays = ['Body Parts', 'Door Parts', 'Lighting', 'Body Accessories', 'Exterior Accessories', 'Wheel Accessories']
      .includes(product.category) ? 7 : 4;
    const suggestedOrderQuantity = flag === 'OK'
      ? 0
      : Math.max(0, Math.ceil(threshold + dailyDemand * (leadDays + HORIZON_DAYS) - stock));

    return {
      product_id: String(product._id),
      name: product.name,
      category: product.category,
      stock,
      threshold,
      p_low_7d: probability,
      days_to_threshold: daysToThreshold,
      pred_daily_demand: dailyDemand,
      forecast_demand_7d: forecastDemand,
      flag,
      suggested_order_qty: suggestedOrderQuantity
    };
  }).filter(product => product.flag !== 'OK');
};

module.exports = { createRecentDemandForecast };
