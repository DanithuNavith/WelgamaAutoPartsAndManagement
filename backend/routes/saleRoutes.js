const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const JobCard = require('../models/JobCard');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware, requireRole('Owner'));

// Get all sales
router.get('/', async (req, res) => {
  try {
    const sales = await Sale.find().populate('items.product').populate('customer technician jobCard');
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new sale
router.post('/', async (req, res) => {
  const { items, subtotal, tax, total, paymentStatus } = req.body;
  const updatedProducts = [];
  try {
    // Atomic quantity checks keep two simultaneous checkouts from overselling stock.
    for (const item of items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity } },
        { new: true }
      );
      if (!product) {
        const existingProduct = await Product.findById(item.product);
        throw new Error(existingProduct ? `Insufficient stock for ${existingProduct.name}` : `Product not found: ${item.product}`);
      }
      updatedProducts.push({ id: product._id, quantity: item.quantity });
    }

    const namedItems = await Promise.all(items.map(async item => {
      const product = await Product.findById(item.product).select('name');
      return { ...item, productName: item.productName || product?.name || 'Auto part' };
    }));
    const sale = await Sale.create({ items: namedItems, subtotal, tax, total, paymentStatus });
    res.status(201).json(sale);
  } catch (err) {
    for (const product of updatedProducts) {
      await Product.updateOne({ _id: product.id }, { $inc: { quantity: product.quantity } });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/repair/:jobId', async (req, res) => {
  try {
    const job = await JobCard.findById(req.params.jobId).populate('customer technician').populate('partsUsed.product');
    if (!job) return res.status(404).json({ error: 'Job card not found' });
    if (!['COMPLETED', 'Completed'].includes(job.status)) return res.status(400).json({ error: 'Only completed repairs can be billed' });
    const invoiceItems = [];
    for (const item of job.partsUsed || []) {
      const product = item.product;
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice ?? product?.price ?? 0);
      invoiceItems.push({ product: product?._id, productName: item.productName || product?.name || 'Used part', quantity, priceAtSale: unitPrice });
    }
    const partsCost = invoiceItems.reduce((sum, item) => sum + item.quantity * item.priceAtSale, 0);
    const technicianCost = Number(req.body.technicianCost || 0);
    const repairCost = partsCost + technicianCost;
    const invoiceData = {
      jobCard: job._id, billType: 'REPAIR', customer: job.customer?._id || job.customer,
      vehicle: { make: job.vehicleMake, model: job.vehicleModel, year: job.vehicleYear, licensePlate: job.registrationNumber || job.licensePlate },
      technician: job.technician?._id || job.technician, technicianCost,
      partsCost, technicianCost, items: invoiceItems, subtotal: repairCost, tax: 0, total: repairCost,
      paymentStatus: req.body.paymentStatus === 'Paid' ? 'Paid' : 'Pending'
    };
    const invoice = job.invoice
      ? await Sale.findByIdAndUpdate(job.invoice, invoiceData, { new: true, runValidators: true })
      : await Sale.create(invoiceData);
    if (!invoice) return res.status(404).json({ error: 'Existing repair invoice not found' });
    job.laborCost = technicianCost; job.partsCost = partsCost; job.repairCost = repairCost; job.invoice = invoice._id;
    await job.save();
    res.status(201).json(await invoice.populate('jobCard customer technician'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
