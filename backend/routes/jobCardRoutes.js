const express = require('express');
const JobCard = require('../models/JobCard');
const Technician = require('../models/Technician');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  getAvailableBookingTimes,
  getDayRange,
  getPublicHoliday,
  getTimeSlot,
  parseDate,
  validateCustomerAppointment
} = require('../services/appointmentAvailability');
const {
  validateVehicleInput,
  validateJobCardInput
} = require('../services/repairInputValidation');
const router = express.Router();

router.get('/availability', async (req, res) => {
  try {
    const { date, technician: technicianId } = req.query;
    if (typeof date !== 'string' || !parseDate(date)) return res.status(400).json({ error: 'Choose a valid appointment date.' });
    if (technicianId && (typeof technicianId !== 'string' || !mongoose.isValidObjectId(technicianId))) {
      return res.status(400).json({ error: 'Choose a valid technician.' });
    }
    if (req.query.excludeJob && (typeof req.query.excludeJob !== 'string' || !mongoose.isValidObjectId(req.query.excludeJob))) {
      return res.status(400).json({ error: 'Choose a valid job card.' });
    }

    const holiday = getPublicHoliday(date);
    if (holiday) return res.json({ holiday, bookedTimes: [], availableTimes: [] });

    let bookedTimes = [];
    if (technicianId) {
      const technician = await Technician.findById(technicianId);
      if (!technician || !['Technician 1', 'Technician 2'].includes(technician.name)) {
        return res.status(400).json({ error: 'Choose a valid technician.' });
      }
      const range = getDayRange(date);
      const appointments = await JobCard.find({
        technician: technician._id,
        appointmentDate: { $gte: range.start, $lt: range.end },
        ...(req.query.excludeJob ? { _id: { $ne: req.query.excludeJob } } : {})
      }).select('appointmentDate');
      bookedTimes = appointments.map(appointment => getTimeSlot(appointment.appointmentDate));
    }

    const availableTimes = getAvailableBookingTimes(date, bookedTimes);
    res.json({ holiday: null, bookedTimes, availableTimes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authMiddleware);

router.get('/billable', requireRole('Owner'), async (req, res) => {
  try {
    const completedJobs = await JobCard.find({
      status: { $in: ['COMPLETED', 'Completed'] }
    }).populate('technician').populate('partsUsed.product').populate('customer')
      .sort({ appointmentDate: 1, createdAt: -1 });

    const linkedInvoices = await Sale.distinct('jobCard', { jobCard: { $ne: null } });
    const billedJobIds = new Set(linkedInvoices.map(jobId => String(jobId)));
    const billableJobs = completedJobs.filter(job => !job.invoice && !billedJobIds.has(String(job._id)));
    res.json(billableJobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
      const vehicleError = validateVehicleInput({
        licensePlate: req.body.licensePlate,
        model: req.body.vehicleModel
      }, { requireYear: false });
      if (vehicleError) return res.status(400).json({ error: vehicleError });
      const jobError = validateJobCardInput(req.body);
      if (jobError) return res.status(400).json({ error: jobError });
      const appointment = validateCustomerAppointment(req.body.appointmentDate);
      if (appointment.error) return res.status(400).json({ error: appointment.error });
      const technician = await Technician.findById(req.body.technician);
      const customer = await Customer.findOne({ email: req.user.email });
      if (!customer) return res.status(400).json({ error: 'Customer profile not found' });
      if (!technician || !['Technician 1', 'Technician 2'].includes(technician.name)) return res.status(400).json({ error: 'Please select Technician 1 or Technician 2' });
      const existingAppointment = await JobCard.exists({
        technician: technician._id,
        appointmentDate: {
          $gt: new Date(appointment.appointmentDate.getTime() - 60 * 60_000),
          $lt: new Date(appointment.appointmentDate.getTime() + 60 * 60_000)
        }
      });
      if (existingAppointment) return res.status(409).json({ error: 'That appointment time was just booked. Please choose another time.' });
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
        appointmentDate: appointment.appointmentDate,
        technician: technician._id,
        priority: 'Medium',
        status: 'ASSIGNED'
      });
      return res.status(201).json(await job.populate('technician customer'));
    }
    if (req.user.role !== 'Owner') return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });

    const jobError = validateJobCardInput(req.body);
    if (jobError) return res.status(400).json({ error: jobError });
    if (!mongoose.isValidObjectId(req.body.customer)) return res.status(400).json({ error: 'Select a valid customer.' });
    const technician = await Technician.findById(req.body.technician);
    if (!technician || !['Technician 1', 'Technician 2'].includes(technician.name)) return res.status(400).json({ error: 'Assign the job to Technician 1 or Technician 2' });
    const appointment = validateCustomerAppointment(req.body.appointmentDate);
    if (appointment.error) return res.status(400).json({ error: appointment.error });
    const dayRange = getDayRange(appointment.date);
    const bookedAppointments = await JobCard.find({
      technician: technician._id,
      appointmentDate: { $gte: dayRange.start, $lt: dayRange.end }
    }).select('appointmentDate');
    const bookedTimes = bookedAppointments.map(item => getTimeSlot(item.appointmentDate));
    if (!getAvailableBookingTimes(appointment.date, bookedTimes).includes(appointment.time)) {
      return res.status(409).json({ error: 'That appointment time is unavailable. Choose another available slot.' });
    }
    const customer = await Customer.findById(req.body.customer);
    if (!customer) return res.status(400).json({ error: 'Select a valid customer.' });
    const requestedPlate = String(req.body.registrationNumber || req.body.licensePlate || '').trim();
    const normalizedPlate = requestedPlate.toUpperCase().replace('-', '');
    const vehicle = (customer.vehicles || []).find(item => String(item.licensePlate || '').trim().toUpperCase().replace('-', '') === normalizedPlate);
    if (!vehicle) return res.status(400).json({ error: 'Select a valid vehicle registered to this customer.' });
    const vehicleError = validateVehicleInput(vehicle);
    if (vehicleError) return res.status(400).json({ error: vehicleError });

    const jobData = { ...req.body };
    delete jobData.vehicleIndex;
    const job = await JobCard.create({
      ...jobData,
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerAddress: customer.address,
      registrationNumber: vehicle.licensePlate.trim(),
      licensePlate: vehicle.licensePlate.trim(),
      vehicleMake: String(vehicle.make || '').trim() || 'Not provided',
      vehicleModel: vehicle.model.trim(),
      vehicleYear: vehicle.year,
      appointmentDate: appointment.appointmentDate,
      jobCardNumber: req.body.jobCardNumber || `JC-${Date.now()}`,
      status: 'ASSIGNED'
    });
    res.status(201).json(await job.populate('technician customer'));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', requireRole('Owner'), async (req, res) => {
  try {
    const existingJob = await JobCard.findById(req.params.id);
    if (!existingJob) return res.status(404).json({ error: 'Job card not found' });

    const allowed = { ...req.body };
    delete allowed.status;
    if (allowed.appointmentDate || allowed.technician) {
      const appointment = validateCustomerAppointment(allowed.appointmentDate || existingJob.appointmentDate);
      if (appointment.error) return res.status(400).json({ error: appointment.error });

      const technicianId = allowed.technician || existingJob.technician;
      const technician = await Technician.findById(technicianId);
      if (!technician || !['Technician 1', 'Technician 2'].includes(technician.name)) {
        return res.status(400).json({ error: 'Please select Technician 1 or Technician 2' });
      }

      const dayRange = getDayRange(appointment.date);
      const bookedAppointments = await JobCard.find({
        technician: technician._id,
        appointmentDate: { $gte: dayRange.start, $lt: dayRange.end },
        _id: { $ne: existingJob._id }
      }).select('appointmentDate');
      const bookedTimes = bookedAppointments.map(item => getTimeSlot(item.appointmentDate));
      if (!getAvailableBookingTimes(appointment.date, bookedTimes).includes(appointment.time)) {
        return res.status(409).json({ error: 'That appointment time is unavailable. Choose another available slot.' });
      }

      allowed.appointmentDate = appointment.appointmentDate;
      allowed.technician = technician._id;
    }
    const job = await JobCard.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true }).populate('technician customer').populate('partsUsed.product');
    res.json(job);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id/progress', requireRole('Technician'), async (req, res) => {
  const inventoryUpdates = [];
  try {
    const job = await JobCard.findOne({ _id: req.params.id, technician: req.user.technicianProfile });
    if (!job) return res.status(404).json({ error: 'Assigned job not found' });
    const transitions = {
      ASSIGNED: 'IN_PROGRESS',
      Pending: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
      'In Progress': 'COMPLETED'
    };
    if (transitions[job.status] !== req.body.status) return res.status(400).json({ error: 'Invalid repair status transition' });
    if (req.body.status === 'COMPLETED' || req.body.status === 'Completed') {
      const diagnosisText = typeof req.body.diagnosis === 'string' ? req.body.diagnosis.trim() : '';
      if (!diagnosisText) return res.status(400).json({ error: 'Diagnosis is required before completing the job.' });
      if (diagnosisText.length < 10) return res.status(400).json({ error: 'Diagnosis must be at least 10 characters.' });
    }
    if (req.body.diagnosis !== undefined) job.diagnosis = req.body.diagnosis;
    if (req.body.repairNotes !== undefined) job.repairNotes = req.body.repairNotes;
    if (req.body.technicianHours !== undefined) job.technicianHours = Number(req.body.technicianHours);
    if (req.body.technicianRate !== undefined) job.technicianRate = Number(req.body.technicianRate);
    if (req.body.partsUsed !== undefined) {
      const getProductId = item => item.product?._id || item.product;
      const previous = new Map((job.partsUsed || []).map(item => [String(getProductId(item)), Number(item.quantity || 0)]));
      const next = new Map((req.body.partsUsed || []).map(item => [String(getProductId(item)), Number(item.quantity || 0)]));
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
