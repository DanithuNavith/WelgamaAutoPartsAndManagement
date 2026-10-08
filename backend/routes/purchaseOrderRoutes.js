const express = require('express');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const { sendSupplierPurchaseOrderEmail } = require('../services/supplierPurchaseOrderEmail');
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
    const initialStatus = status || 'Pending';
    if (!['Pending', 'Ordered', 'Partially Received'].includes(initialStatus)) {
      return res.status(400).json({ error: 'A purchase order must start in an open status' });
    }
    const supplierProfile = await Supplier.findById(supplier);
    if (!supplierProfile) return res.status(404).json({ error: 'Supplier not found' });
    const calculatedSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    const order = await PurchaseOrder.create({
      supplier, orderNumber, items, subtotal: calculatedSubtotal, total: calculatedSubtotal,
      orderDate, status: initialStatus
    });
    let emailStatus;
    try {
      await sendSupplierPurchaseOrderEmail(order, supplierProfile);
      order.supplierEmailSent = true;
      order.supplierEmailSentAt = new Date();
      await order.save();
      emailStatus = { sent: true, to: supplierProfile.email };
    } catch (err) {
      console.error(`Purchase order email failed for order ${order.orderNumber}:`, err.message);
      emailStatus = { sent: false, to: supplierProfile.email, error: err.message };
    }
    const responseOrder = await order.populate('supplier', 'name contactPerson email');
    res.status(201).json({ ...responseOrder.toObject(), emailStatus });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/email', requireRole('Owner'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id).populate('supplier', 'name contactPerson email');
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });
    if (!order.supplier?.email) return res.status(400).json({ error: 'The supplier does not have a registered email address.' });

    await sendSupplierPurchaseOrderEmail(order, order.supplier);
    order.supplierEmailSent = true;
    order.supplierEmailSentAt = new Date();
    await order.save();
    res.json({ emailStatus: { sent: true, to: order.supplier.email } });
  } catch (err) {
    console.error(`Purchase order email retry failed for order ${req.params.id}:`, err.message);
    res.status(502).json({ emailStatus: { sent: false, error: err.message } });
  }
});

router.patch('/:id/supplier-status', requireRole('Supplier'), async (req, res) => {
  try {
    if (!['Received', 'Rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Supplier can only complete or reject an order' });
    const supplier = await Supplier.findOne({ $or: [{ user: req.user.id }, { _id: req.user.supplierProfile }, { email: req.user.email }] });
    const order = supplier ? await PurchaseOrder.findOne({ _id: req.params.id, supplier: supplier._id }) : null;
    if (!order) return res.status(404).json({ error: 'Order not found for this supplier' });
    if (['Awaiting acceptance', 'Received', 'Rejected'].includes(order.status)) return res.status(400).json({ error: 'This order has already been completed' });

    if (req.body.status === 'Rejected') {
      const rejectionReason = String(req.body.rejectionReason || '').trim();
      const validReasons = ['Out of stock', 'Price mismatch', 'Cannot deliver', 'Wrong item'];
      if (!validReasons.includes(rejectionReason)) {
        return res.status(400).json({ error: 'Please select a valid rejection reason.' });
      }
      order.rejectionReason = rejectionReason;
    } else {
      order.rejectionReason = null;
    }

    if (req.body.status === 'Received') {
      order.status = 'Awaiting acceptance';
      order.deliveryStatus = 'Delivered';
      order.supplierCompletedAt = new Date();
    } else {
      order.status = 'Rejected';
    }
    await order.save();
    res.json(await order.populate('supplier', 'name contactPerson email'));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id/accept', requireRole('Owner'), async (req, res) => {
  let acceptedOrder;
  const inventoryUpdates = [];
  try {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, status: 'Awaiting acceptance' });
    if (!order) {
      const existingOrder = await PurchaseOrder.exists({ _id: req.params.id });
      return res.status(existingOrder ? 409 : 404).json({
        error: existingOrder ? 'This order is not awaiting owner acceptance' : 'Purchase order not found'
      });
    }

    const productIds = order.items.map(item => item.product).filter(Boolean);
    const existingProducts = await Product.find({ _id: { $in: productIds } }).select('_id');
    const existingProductIds = new Set(existingProducts.map(product => String(product._id)));
    const missingItem = order.items.find(item => !item.product || !existingProductIds.has(String(item.product)));
    if (missingItem) return res.status(400).json({ error: `Inventory product missing for ${missingItem.productName}` });

    acceptedOrder = await PurchaseOrder.findOneAndUpdate(
      { _id: order._id, status: 'Awaiting acceptance' },
      { $set: { status: 'Received', receivedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!acceptedOrder) return res.status(409).json({ error: 'This order has already been accepted' });

    for (const item of order.items) {
      const product = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: item.quantity } },
        { new: true }
      );
      if (!product) throw new Error(`Inventory product not found for ${item.productName}`);
      inventoryUpdates.push({ product: item.product, quantity: item.quantity });
    }

    res.json(await acceptedOrder.populate('supplier', 'name contactPerson email'));
  } catch (err) {
    try {
      for (const update of inventoryUpdates) {
        await Product.updateOne({ _id: update.product }, { $inc: { quantity: -update.quantity } });
      }
      if (acceptedOrder) {
        await PurchaseOrder.updateOne(
          { _id: acceptedOrder._id, status: 'Received' },
          { $set: { status: 'Awaiting acceptance' }, $unset: { receivedAt: 1 } }
        );
      }
    } catch (rollbackError) {
      console.error(`Purchase order acceptance rollback failed for order ${req.params.id}:`, rollbackError.message);
      return res.status(500).json({ error: 'Unable to accept the order and inventory rollback failed. Please contact support.' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireRole('Owner'), async (req, res) => {
  try {
    const allowed = {};
    if (req.body.status !== undefined) {
      if (!['Pending', 'Ordered', 'Partially Received'].includes(req.body.status)) {
        return res.status(400).json({ error: 'Use the owner acceptance action to receive delivered quantities' });
      }
      allowed.status = req.body.status;
    }
    if (req.body.deliveryStatus !== undefined) {
      if (!['Awaiting dispatch', 'In transit'].includes(req.body.deliveryStatus)) {
        return res.status(400).json({ error: 'Delivery status can only be changed to Awaiting dispatch or In transit' });
      }
      allowed.deliveryStatus = req.body.deliveryStatus;
    }
    const currentOrder = await PurchaseOrder.findById(req.params.id);
    if (!currentOrder) return res.status(404).json({ error: 'Purchase order not found' });
    if (['Awaiting acceptance', 'Received', 'Rejected'].includes(currentOrder.status)) {
      return res.status(409).json({ error: 'Completed orders cannot be changed' });
    }
    const order = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, status: currentOrder.status },
      allowed,
      { new: true, runValidators: true }
    );
    if (!order) return res.status(409).json({ error: 'Purchase order status changed. Refresh and try again.' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
