const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const validateInventoryProduct = product => {
  const errors = {};
  const name = String(product.name || '').trim();
  const category = String(product.category || '').trim();

  if (!name) errors.name = 'Part name is required.';
  else if (name.length < 2 || name.length > 100) errors.name = 'Part name must be 2 to 100 characters.';

  if (!category) errors.category = 'Category is required.';
  else if (category.length < 2 || category.length > 60) errors.category = 'Category must be 2 to 60 characters.';

  const price = product.price === '' ? NaN : Number(product.price);
  const costPrice = product.costPrice === '' ? NaN : Number(product.costPrice);
  const quantity = product.quantity === '' ? NaN : Number(product.quantity);
  const lowStockThreshold = product.lowStockThreshold === '' ? NaN : Number(product.lowStockThreshold);

  if (!Number.isFinite(price) || price <= 0) errors.price = 'Price must be greater than zero.';
  if (!Number.isFinite(costPrice) || costPrice < 0) errors.costPrice = 'Cost price must be zero or greater.';
  else if (Number.isFinite(price) && costPrice > price) errors.costPrice = 'Cost price cannot be greater than the selling price.';
  if (!Number.isInteger(quantity) || quantity < 0) errors.quantity = 'Quantity must be a whole number of zero or more.';
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) errors.lowStockThreshold = 'Low stock threshold must be a whole number of zero or more.';

  if (product.image) {
    const imageMatch = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(product.image);
    if (!imageMatch) errors.image = 'Choose a valid JPEG, PNG, GIF, or WebP image.';
    else {
      const imageBytes = Math.floor(imageMatch[2].length * 3 / 4) - (imageMatch[2].endsWith('==') ? 2 : imageMatch[2].endsWith('=') ? 1 : 0);
      if (imageBytes > MAX_IMAGE_BYTES) errors.image = 'Image must be smaller than 5 MB.';
    }
  }

  return errors;
};
