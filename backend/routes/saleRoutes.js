const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const JobCard = require('../models/JobCard');
const { sendRepairInvoiceEmail } = require('../services/repairInvoiceEmail');
const { calculatePartsInvoiceTotal, sendPartsInvoiceEmail } = require('../services/partsInvoiceEmail');
const { calculatePartsNetProfit } = require('../services/partsProfit');
const { parseTechnicianCost } = require('../services/technicianCostValidation');
const { validatePartsCustomer } = require('../services/partsCustomerValidation');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware, requireRole('Owner'));

const deliverRepairInvoice = async (invoice, job) => {
  const recipient = (job.customer?.email || job.customerEmail || '').trim();
  if (!recipient) {
    const error = 'Customer email address is missing.';
    invoice.invoiceEmailSentAt = null;
    invoice.invoiceEmailTo = '';
    invoice.invoiceEmailError = error;
    await invoice.save();
    return { sent: false, error };
  }

  try {
    await sendRepairInvoiceEmail(invoice, job, recipient);
    invoice.invoiceEmailSentAt = new Date();
    invoice.invoiceEmailTo = recipient;
    invoice.invoiceEmailError = '';
    await invoice.save();
    return { sent: true, to: recipient };
  } catch (err) {
    console.error(`Repair invoice email failed for ${invoice._id}:`, err.message);
    invoice.invoiceEmailSentAt = null;
    invoice.invoiceEmailTo = '';
    invoice.invoiceEmailError = err.message;
    await invoice.save();
    return { sent: false, to: recipient, error: err.message };
  }
};

const deliverPartsInvoice = async invoice => {
  const recipient = String(invoice.customerEmail || '').trim();
  let emailStatus;
  try {
    await sendPartsInvoiceEmail(invoice, recipient);
    invoice.invoiceEmailSentAt = new Date();
    invoice.invoiceEmailTo = recipient;
    invoice.invoiceEmailError = '';
    emailStatus = { sent: true, to: recipient };
  } catch (err) {
    console.error(`Parts invoice email failed for ${invoice._id}:`, err.message);
    invoice.invoiceEmailSentAt = null;
    invoice.invoiceEmailTo = '';
    invoice.invoiceEmailError = err.message;
    emailStatus = { sent: false, to: recipient, error: err.message };
  }
  try {
    await invoice.save();
  } catch (err) {
    console.error(`Could not save parts invoice email status for ${invoice._id}:`, err.message);
    return { ...emailStatus, statusError: 'Invoice email status could not be saved. Check the invoice history before retrying.' };
  }
  return emailStatus;
};

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
  const { items, paymentStatus } = req.body;
  const updatedProducts = [];
  try {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Add at least one product to the sale.' });
    }
    const discount = Number(req.body.discount || 0);
    if (!Number.isFinite(discount) || discount < 0) {
      return res.status(400).json({ error: 'Discount must be a valid non-negative amount.' });
    }

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
      const product = await Product.findById(item.product).select('name costPrice');
      return {
        ...item,
        productName: item.productName || product?.name || 'Auto part',
        unitCostAtSale: product?.costPrice ?? null
      };
    }));
    const subtotal = namedItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.priceAtSale), 0);
    if (discount > subtotal) throw new Error('Discount cannot exceed the parts subtotal.');
    const discountedSubtotal = subtotal - discount;
    const tax = discountedSubtotal * 0.15;
    const total = discountedSubtotal + tax;
    const sale = await Sale.create({
      items: namedItems,
      subtotal,
      discount,
      netProfit: calculatePartsNetProfit(namedItems, discount, subtotal),
      tax,
      total,
      paymentStatus,
      customer: req.body.customer || undefined
    });
    res.status(201).json(sale);
  } catch (err) {
    for (const product of updatedProducts) {
      await Product.updateOne({ _id: product.id }, { $inc: { quantity: product.quantity } });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/parts', async (req, res) => {
  const updatedProducts = [];
  try {
    const customerName = String(req.body.customerName || '').trim();
    const customerPhone = String(req.body.customerPhone || '').trim();
    const customerEmail = String(req.body.customerEmail || '').trim().toLowerCase();
    const customerError = validatePartsCustomer({ customerName, customerPhone, customerEmail });
    if (customerError) return res.status(400).json({ error: customerError });
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({ error: 'Add at least one part to the bill.' });
    }
    if (req.body.items.some(item => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
      return res.status(400).json({ error: 'Each part quantity must be a whole number greater than zero.' });
    }

    const items = [];
    for (const item of req.body.items) {
      const quantity = Number(item.quantity);
      const product = await Product.findOneAndUpdate(
        { _id: item.product, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { new: true }
      );
      if (!product) {
        const existingProduct = await Product.findById(item.product);
        throw new Error(existingProduct ? `Insufficient stock for ${existingProduct.name}.` : 'A selected part could not be found.');
      }
      updatedProducts.push({ id: product._id, quantity });
      items.push({
        product: product._id,
        productName: product.name,
        quantity,
        priceAtSale: Number(product.price),
        unitCostAtSale: product.costPrice ?? null
      });
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.priceAtSale, 0);
    const discount = Number(req.body.discount || 0);
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) {
      throw new Error('Discount must be between Rs. 0 and the parts subtotal.');
    }
    const total = calculatePartsInvoiceTotal(subtotal, discount);
    const invoice = await Sale.create({
      billType: 'PARTS',
      customerName,
      customerPhone,
      customerEmail,
      items,
      subtotal,
      discount,
      netProfit: calculatePartsNetProfit(items, discount, subtotal),
      tax: 0,
      total,
      paymentStatus: req.body.paymentStatus === 'Paid' ? 'Paid' : 'Pending'
    });
    const emailStatus = await deliverPartsInvoice(invoice);
    res.status(201).json({ ...invoice.toObject(), emailStatus });
  } catch (err) {
    for (const product of updatedProducts) {
      await Product.updateOne({ _id: product.id }, { $inc: { quantity: product.quantity } });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/parts/:saleId/email', async (req, res) => {
  try {
    const invoice = await Sale.findOne({ _id: req.params.saleId, billType: 'PARTS' });
    if (!invoice) return res.status(404).json({ error: 'Parts invoice not found.' });
    if (!invoice.customerEmail) return res.status(400).json({ error: 'Customer email address is missing from this invoice.' });
    res.json({ emailStatus: await deliverPartsInvoice(invoice) });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      invoiceItems.push({
        product: product?._id,
        productName: item.productName || product?.name || 'Used part',
        quantity,
        priceAtSale: unitPrice,
        unitCostAtSale: product?.costPrice ?? null
      });
    }
    const partsCost = invoiceItems.reduce((sum, item) => sum + item.quantity * item.priceAtSale, 0);
    const technicianCost = parseTechnicianCost(req.body.technicianCost);
    const subtotal = partsCost + technicianCost;
    const discount = Number(req.body.discount || 0);
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) {
      return res.status(400).json({ error: 'Discount must be between Rs. 0 and the repair subtotal.' });
    }
    const repairCost = subtotal - discount;
    const invoiceData = {
      jobCard: job._id, billType: 'REPAIR', customer: job.customer?._id || job.customer,
      vehicle: { make: job.vehicleMake, model: job.vehicleModel, year: job.vehicleYear, licensePlate: job.registrationNumber || job.licensePlate },
      technician: job.technician?._id || job.technician, technicianCost,
      partsCost, technicianCost, items: invoiceItems, subtotal, discount, tax: 0, total: repairCost,
      netProfit: calculatePartsNetProfit(invoiceItems, discount, subtotal),
      paymentStatus: req.body.paymentStatus === 'Paid' ? 'Paid' : 'Pending'
    };
    const existingInvoice = job.invoice ? await Sale.findById(job.invoice) : null;
    const invoiceChanged = !existingInvoice
      || existingInvoice.total !== invoiceData.total
      || existingInvoice.discount !== invoiceData.discount
      || existingInvoice.paymentStatus !== invoiceData.paymentStatus
      || JSON.stringify(existingInvoice.items.map(item => ({
        product: String(item.product || ''),
        productName: item.productName,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
        unitCostAtSale: item.unitCostAtSale ?? null
      }))) !== JSON.stringify(invoiceData.items.map(item => ({
        product: String(item.product || ''),
        productName: item.productName,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
        unitCostAtSale: item.unitCostAtSale ?? null
      })));
    const invoice = existingInvoice
      ? await Sale.findByIdAndUpdate(job.invoice, invoiceData, { new: true, runValidators: true })
      : await Sale.create(invoiceData);
    if (!invoice) return res.status(404).json({ error: 'Existing repair invoice not found' });
    job.laborCost = technicianCost; job.partsCost = partsCost; job.repairCost = repairCost; job.invoice = invoice._id;
    await job.save();
    await invoice.populate('jobCard customer technician');
    const emailStatus = invoiceChanged || !invoice.invoiceEmailSentAt
      ? await deliverRepairInvoice(invoice, job)
      : { sent: true, to: invoice.invoiceEmailTo, skipped: true };
    res.status(201).json({ ...invoice.toObject(), emailStatus });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/repair/:jobId/email', async (req, res) => {
  try {
    const job = await JobCard.findById(req.params.jobId).populate('customer');
    if (!job) return res.status(404).json({ error: 'Job card not found' });
    if (!['COMPLETED', 'Completed'].includes(job.status)) return res.status(400).json({ error: 'Only completed repairs can be emailed' });
    if (!job.invoice) return res.status(400).json({ error: 'Create the repair bill before emailing it' });
    const invoice = await Sale.findById(job.invoice);
    if (!invoice) return res.status(404).json({ error: 'Repair invoice not found' });
    res.json({ emailStatus: await deliverRepairInvoice(invoice, job) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
