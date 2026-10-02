const express = require('express');
const Product = require('../models/Product');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateProductInput } = require('../services/productInputValidation');
const router = express.Router();

// Get all products
router.get('/', authMiddleware, async (req, res) => {
  try {
    const products = req.user.role === 'Owner'
      ? await Product.find()
      : await Product.find().select('-costPrice');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authMiddleware, requireRole('Owner'));

// Add new product
router.post('/', async (req, res) => {
  try {
    const validationError = validateProductInput(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const validationError = validateProductInput(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
