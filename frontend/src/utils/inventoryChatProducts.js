const ignoredWords = new Set([
  'a', 'about', 'any', 'are', 'available', 'can', 'could', 'do', 'does', 'find',
  'for', 'have', 'how', 'i', 'in', 'is', 'it', 'list', 'me', 'of', 'please',
  'price', 'prices', 'product', 'products', 'part', 'parts', 'search', 'show',
  'stock', 'tell', 'the', 'there', 'what', 'which', 'who', 'with', 'you', 'your'
]);

const singularize = word => {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
};

export const getProductSearchTerms = text => text
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, ' ')
  .split(/\s+/)
  .filter(word => word && !ignoredWords.has(word))
  .map(singularize);

export const findInventoryProductMatches = (products, query) => {
  const terms = getProductSearchTerms(query);
  if (!terms.length) return [];

  return products.filter(product => {
    const nameWords = getProductSearchTerms(product.name);
    return terms.every(term => nameWords.includes(term));
  });
};
