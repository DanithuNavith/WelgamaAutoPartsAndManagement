export const getInventoryChatIntent = text => {
  if (
    text === 'help'
    || /\bwhat\b.*\b(can|could)\b.*\b(you|bot|assistant)\b.*\b(do|help)\b|\bwhat can you do\b/.test(text)
  ) return 'capabilities';

  if (!/\b(stock|inventory|quantity|parts?|products?|items?)\b/.test(text)) return null;
  if (/\b(lowest|least|fewest|minimum|min)\b/.test(text)) return 'lowest-stock';
  if (/\b(highest|most|maximum|max|greatest)\b/.test(text)) return 'highest-stock';
  return null;
};

export const getStockExtremeReply = (products, intent) => {
  if (!products.length) return 'There are no parts in inventory yet, so I can’t compare stock quantities.';

  const quantities = products.map(product => Number(product.quantity)).filter(Number.isFinite);
  if (!quantities.length) return 'I couldn’t read the stock quantities in inventory.';

  const lowest = intent === 'lowest-stock';
  const targetQuantity = lowest ? Math.min(...quantities) : Math.max(...quantities);
  const matches = products.filter(product => Number(product.quantity) === targetQuantity);
  const parts = matches.map(product => `${product.name} (${product.quantity} in stock)`).join(', ');
  return matches.length > 1
    ? `The ${lowest ? 'lowest' : 'highest'} stock level is tied between ${parts}.`
    : `The ${lowest ? 'lowest' : 'highest'} stock level is ${parts}.`;
};
