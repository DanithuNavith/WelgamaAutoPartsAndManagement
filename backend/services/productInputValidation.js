const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imagePattern = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+=*)$/;

const validateProductInput = product => {
  if (!product || typeof product !== 'object' || Array.isArray(product)) return 'Enter valid part details.';
  const name = String(product.name || '').trim();
  const category = String(product.category || '').trim();

  if (!name) return 'Part name is required.';
  if (name.length < 2 || name.length > 100) return 'Part name must be between 2 and 100 characters.';
  if (!category) return 'Category is required.';
  if (category.length < 2 || category.length > 60) return 'Category must be between 2 and 60 characters.';

  const price = product.price === '' || product.price === undefined ? NaN : Number(product.price);
  const costPrice = product.costPrice === '' || product.costPrice === undefined ? NaN : Number(product.costPrice);
  const quantity = product.quantity === '' || product.quantity === undefined ? NaN : Number(product.quantity);
  const lowStockThreshold = product.lowStockThreshold === '' || product.lowStockThreshold === undefined
    ? NaN
    : Number(product.lowStockThreshold);

  if (!Number.isFinite(price) || price <= 0) return 'Price must be greater than zero.';
  if (!Number.isFinite(costPrice) || costPrice < 0) return 'Cost price must be zero or greater.';
  if (costPrice > price) return 'Cost price cannot be greater than the selling price.';
  if (!Number.isInteger(quantity) || quantity < 0) return 'Quantity must be a whole number of zero or more.';
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
    return 'Low stock threshold must be a whole number of zero or more.';
  }

  if (product.image) {
    const imageMatch = typeof product.image === 'string' ? imagePattern.exec(product.image) : null;
    if (!imageMatch) return 'Choose a valid JPEG, PNG, GIF, or WebP image.';
    const imageBytes = Math.floor(imageMatch[2].length * 3 / 4)
      - (imageMatch[2].endsWith('==') ? 2 : imageMatch[2].endsWith('=') ? 1 : 0);
    if (imageBytes > MAX_IMAGE_BYTES) return 'Image must be smaller than 5 MB.';
  }

  return null;
};

module.exports = { validateProductInput };
