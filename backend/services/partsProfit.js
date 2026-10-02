const calculatePartsNetProfit = (items, discount, subtotal) => {
  const revenue = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.priceAtSale || 0), 0);
  const costs = items.map(item => item.unitCostAtSale);
  if (costs.some(cost => cost === null || cost === undefined || !Number.isFinite(Number(cost)))) return null;

  const grossProfit = items.reduce((sum, item) => (
    sum + (Number(item.priceAtSale || 0) - Number(item.unitCostAtSale)) * Number(item.quantity || 0)
  ), 0);
  const discountShare = Number(subtotal) > 0 ? Number(discount || 0) * revenue / Number(subtotal) : 0;
  return Number((grossProfit - discountShare).toFixed(2));
};

module.exports = { calculatePartsNetProfit };
