const parseTechnicianCost = value => {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    throw new Error('Repair cost is required.');
  }

  const normalizedValue = String(value).trim();
  if (normalizedValue.startsWith('-')) {
    throw new Error('Repair cost must be zero or greater.');
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedValue)) {
    throw new Error('Repair cost must be a valid amount with no more than 2 decimal places.');
  }

  const cost = Number(normalizedValue);
  if (!Number.isFinite(cost)) {
    throw new Error('Repair cost must be a valid amount with no more than 2 decimal places.');
  }
  return cost;
};

module.exports = { parseTechnicianCost };
