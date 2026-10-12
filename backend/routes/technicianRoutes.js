const express = require('express');
const Technician = require('../models/Technician');
const User = require('../models/User');
const JobCard = require('../models/JobCard');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

const technicianStatuses = ['Available', 'Busy', 'Offline'];
const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.get('/', async (req, res) => {
  try {
    const techs = await Technician.find().select('name status').sort({ name: 1 });
    res.json(techs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/management', requireRole('Owner'), async (req, res) => {
  try {
    const technicians = await Technician.find().sort({ name: 1 }).lean();
    const users = await User.find({
      role: 'Technician',
      technicianProfile: { $in: technicians.map(technician => technician._id) }
    }).select('name email phone technicianProfile').lean();
    const usersByProfile = new Map(users.map(user => [String(user.technicianProfile), user]));

    res.json(technicians.map(technician => {
      const user = usersByProfile.get(String(technician._id));
      return {
        ...technician,
        email: user?.email || '',
        phone: user?.phone || ''
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(requireRole('Owner'));

router.post('/', async (req, res) => {
  let technician;
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    const specialty = typeof req.body.specialty === 'string' ? req.body.specialty.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const hourlyRate = Number(req.body.hourlyRate);
    const status = req.body.status || 'Available';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Technician name, email, and password are required.' });
    }
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid technician email address.' });
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Technician password must be at least 8 characters.' });
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      return res.status(400).json({ error: 'Enter a valid non-negative hourly rate.' });
    }
    if (!technicianStatuses.includes(status)) {
      return res.status(400).json({ error: 'Choose a valid technician status.' });
    }

    if (await User.exists({ email })) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    technician = await Technician.create({ name, specialty, hourlyRate, status });
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'Technician',
      technicianProfile: technician._id
    });
    res.status(201).json({
      ...technician.toObject(),
      email: user.email,
      phone: user.phone || ''
    });
  } catch (err) {
    if (technician) {
      try {
        await Technician.findByIdAndDelete(technician._id);
      } catch (cleanupError) {
        console.error(`Could not remove incomplete technician profile ${technician._id}:`, cleanupError.message);
        return res.status(500).json({ error: 'Technician account creation failed and profile cleanup was unsuccessful.' });
      }
    }
    if (err.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const technician = await Technician.findById(req.params.id);
    if (!technician) return res.status(404).json({ error: 'Technician not found.' });
    const user = await User.findOne({ role: 'Technician', technicianProfile: technician._id });
    if (!user) return res.status(409).json({ error: 'This technician profile has no linked login account.' });

    const allowedFields = ['name', 'email', 'phone', 'specialty', 'hourlyRate', 'status', 'password'];
    if (!allowedFields.some(field => req.body[field] !== undefined)) {
      return res.status(400).json({ error: 'Provide at least one technician field to update.' });
    }

    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
        return res.status(400).json({ error: 'Technician name is required.' });
      }
      technician.name = req.body.name.trim();
      user.name = req.body.name.trim();
    }
    if (req.body.email !== undefined) {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid technician email address.' });
      if (await User.exists({ email, _id: { $ne: user._id } })) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      user.email = email;
    }
    if (req.body.phone !== undefined) {
      if (typeof req.body.phone !== 'string') return res.status(400).json({ error: 'Technician phone number must be text.' });
      user.phone = req.body.phone.trim();
    }
    if (req.body.specialty !== undefined) {
      if (typeof req.body.specialty !== 'string') return res.status(400).json({ error: 'Technician specialty must be text.' });
      technician.specialty = req.body.specialty.trim();
    }
    if (req.body.hourlyRate !== undefined) {
      const hourlyRate = Number(req.body.hourlyRate);
      if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
        return res.status(400).json({ error: 'Enter a valid non-negative hourly rate.' });
      }
      technician.hourlyRate = hourlyRate;
    }
    if (req.body.status !== undefined) {
      if (!technicianStatuses.includes(req.body.status)) {
        return res.status(400).json({ error: 'Choose a valid technician status.' });
      }
      technician.status = req.body.status;
    }
    if (req.body.password !== undefined && req.body.password !== '') {
      if (typeof req.body.password !== 'string' || req.body.password.length < 8) {
        return res.status(400).json({ error: 'Technician password must be at least 8 characters.' });
      }
      user.password = req.body.password;
    }

    await Promise.all([technician.save(), user.save()]);
    res.json({
      ...technician.toObject(),
      email: user.email,
      phone: user.phone || ''
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const technician = await Technician.findById(req.params.id);
    if (!technician) return res.status(404).json({ error: 'Technician not found.' });
    if (await JobCard.exists({ technician: technician._id })) {
      return res.status(409).json({ error: 'This technician has repair history. Set the profile to Offline instead of deleting it.' });
    }
    await User.deleteMany({ role: 'Technician', technicianProfile: technician._id });
    await technician.deleteOne();
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
