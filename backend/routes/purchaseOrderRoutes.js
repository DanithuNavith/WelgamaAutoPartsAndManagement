const express = require('express');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Supplier') {
      const supplier = await Supplier.findOne({ $or: [{ user: req.user.id }, { _id: req.user.supplierProfile }, { email: req.user.email }] });
      filter = { supplier: supplier?._id || null };
    }
    const orders = await PurchaseOrder.find(filter).populate('supplier', 'name contactPerson email').sort({ orderDate: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('Owner'), async (req, res) => {
  try {
    const { supplier, orderNumber, items, orderDate, status } = req.body;
    if (!supplier || !items?.length) return res.status(400).json({ error: 'Supplier and at least one item are required' });
    const calculatedSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    const order = await PurchaseOrder.create({
      supplier, orderNumber, items, subtotal: calculatedSubtotal, total: calculatedSubtotal,
      orderDate, status: status || 'Pending'
    });
    res.status(201).json(await order.populate('supplier', 'name contactPerson email'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/supplier-status', requireRole('Supplier'), async (req, res) => {
  const inventoryUpdates = [];
  try {
    if (!['Received', 'Rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Supplier can only complete or reject an order' });
    const supplier = await Supplier.findOne({ $or: [{ user: req.user.id }, { _id: req.user.supplierProfile }, { email: req.user.email }] });
    const order = supplier ? await PurchaseOrder.findOne({ _id: req.params.id, supplier: supplier._id }) : null;
    if (!order) return res.status(404).json({ error: 'Order not found for this supplier' });
    if (['Received', 'Rejected'].includes(order.status)) return res.status(400).json({ error: 'This order has already been closed' });
    if (req.body.status === 'Received') {
      for (const item of order.items) {
        if (!item.product) return res.status(400).json({ error: `Inventory product missing for ${item.productName}` });
        const product = await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } }, { new: true });
        if (!product) {
          for (const update of inventoryUpdates) await Product.updateOne({ _id: update.product }, { $inc: { quantity: -update.quantity } });
          return res.status(400).json({ error: `Inventory product not found for ${item.productName}` });
        }
        inventoryUpdates.push({ product: item.product, quantity: item.quantity });
      }
    }
    order.status = req.body.status;
    if (req.body.status === 'Received') order.deliveryStatus = 'Delivered';
    await order.save();
    res.json(await order.populate('supplier', 'name contactPerson email'));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id', requireRole('Owner'), async (req, res) => {
  try {
    const allowed = {};
    if (req.body.status) allowed.status = req.body.status;
    if (req.body.deliveryStatus) allowed.deliveryStatus = req.body.deliveryStatus;
    const order = await PurchaseOrder.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(order);
  } catch (err) {
    for (const update of inventoryUpdates) await Product.updateOne({ _id: update.product }, { $inc: { quantity: -update.quantity } });
    
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
