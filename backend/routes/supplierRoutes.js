const express = require('express');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

router.get('/me', requireRole('Supplier'), async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ $or: [{ user: req.user.id }, { _id: req.user.supplierProfile }, { email: req.user.email }] });
    if (!supplier) return res.status(404).json({ error: 'Supplier profile not found' });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/me', requireRole('Supplier'), async (req, res) => {
  try {
    const allowed = { contactPerson: req.body.contactPerson, phone: req.body.phone, address: req.body.address };
    const supplier = await Supplier.findOneAndUpdate({ $or: [{ user: req.user.id }, { _id: req.user.supplierProfile }, { email: req.user.email }] }, allowed, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ error: 'Supplier profile not found' });
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.use(requireRole('Owner'));

router.get('/', async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();
    const enrichedSuppliers = await Promise.all(suppliers.map(async supplier => ({
      ...supplier,
      orderCount: await PurchaseOrder.countDocuments({ supplier: supplier._id }),
      activeOrderCount: await PurchaseOrder.countDocuments({ supplier: supplier._id, status: { $in: ['Pending', 'Confirmed'] } })
    })));
    res.json(enrichedSuppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
