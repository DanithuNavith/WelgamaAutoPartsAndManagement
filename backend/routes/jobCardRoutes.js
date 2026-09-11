const express = require('express');
const JobCard = require('../models/JobCard');
const Technician = require('../models/Technician');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const filter = req.user.role === 'Technician' ? { technician: req.user.technicianProfile } : {};
    const jobs = await JobCard.find(filter).populate('technician').populate('partsUsed.product').populate('customer').sort({ appointmentDate: 1, createdAt: -1 });
    res.json(jobs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res, next) => {
  try {
    if (req.user.role === 'Customer') {
      const technician = await Technician.findById(req.body.technician);
      const customer = await Customer.findOne({ email: req.user.email });
      if (!customer) return res.status(400).json({ error: 'Customer profile not found' });
      if (!technician || !['Technician 1', 'Technician 2'].includes(technician.name)) return res.status(400).json({ error: 'Please select Technician 1 or Technician 2' });
      const job = await JobCard.create({
        jobCardNumber: `JC-${Date.now()}`,
        customer: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerAddress: customer.address,
        registrationNumber: req.body.licensePlate,
        licensePlate: req.body.licensePlate,
        vehicleMake: req.body.vehicleMake || 'Not provided',
        vehicleModel: req.body.vehicleModel,
        vehicleYear: req.body.vehicleYear,
        issueDescription: req.body.issueDescription,
        appointmentDate: req.body.appointmentDate,
        technician: technician._id,
        priority: 'Medium',
        status: 'ASSIGNED'
      });
      return res.status(201).json(await job.populate('technician customer'));
    }
    if (req.user.role !== 'Owner') return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    const technician = await Technician.findById(req.body.technician);
    if (!technician || !['Technician 1', 'Technician 2'].includes(technician.name)) return res.status(400).json({ error: 'Assign the job to Technician 1 or Technician 2' });
    const job = await JobCard.create({ ...req.body, jobCardNumber: req.body.jobCardNumber || `JC-${Date.now()}`, status: 'ASSIGNED' });
    res.status(201).json(await job.populate('technician customer'));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', requireRole('Owner'), async (req, res) => {
  try {
    const allowed = { ...req.body };
    delete allowed.status;
    const job = await JobCard.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true }).populate('technician customer').populate('partsUsed.product');
    if (!job) return res.status(404).json({ error: 'Job card not found' });
    res.json(job);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id/progress', requireRole('Technician'), async (req, res) => {
  const inventoryUpdates = [];
  try {
    const job = await JobCard.findOne({ _id: req.params.id, technician: req.user.technicianProfile });
    if (!job) return res.status(404).json({ error: 'Assigned job not found' });
    const transitions = { ASSIGNED: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED' };
    if (transitions[job.status] !== req.body.status) return res.status(400).json({ error: 'Invalid repair status transition' });
    if (req.body.diagnosis !== undefined) job.diagnosis = req.body.diagnosis;
    if (req.body.repairNotes !== undefined) job.repairNotes = req.body.repairNotes;
    if (req.body.technicianHours !== undefined) job.technicianHours = Number(req.body.technicianHours);
    if (req.body.technicianRate !== undefined) job.technicianRate = Number(req.body.technicianRate);
    if (req.body.partsUsed !== undefined) {
      const previous = new Map((job.partsUsed || []).map(item => [String(item.product), Number(item.quantity || 0)]));
      const next = new Map((req.body.partsUsed || []).map(item => [String(item.product), Number(item.quantity || 0)]));
      const productIds = new Set([...previous.keys(), ...next.keys()]);
      for (const productId of productIds) {
        const delta = (next.get(productId) || 0) - (previous.get(productId) || 0);
        if (!delta) continue;
        const product = await Product.findOneAndUpdate(
          { _id: productId, ...(delta > 0 ? { quantity: { $gte: delta } } : {}) },
          { $inc: { quantity: -delta } }, { new: true }
        );
        if (!product) throw new Error(`Insufficient stock for the selected repair part`);
        inventoryUpdates.push({ product: productId, delta });
      }
      job.partsUsed = req.body.partsUsed;
    }
    job.status = req.body.status;
    await job.save();
    const populatedJob = await job.populate('technician customer');
    await populatedJob.populate('partsUsed.product');
    res.json(populatedJob);
  } catch (err) {
    for (const update of inventoryUpdates) await Product.updateOne({ _id: update.product }, { $inc: { quantity: update.delta } });
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('Owner'), async (req, res) => {
  try {
    const job = await JobCard.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job card not found' });
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
