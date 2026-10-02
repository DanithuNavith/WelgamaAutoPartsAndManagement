const express = require('express');
const Customer = require('../models/Customer');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateCustomerInput } = require('../services/repairInputValidation');
const router = express.Router();
router.use(authMiddleware, requireRole('Owner'));

router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const validationError = validateCustomerInput(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const validationError = validateCustomerInput(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
