const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Technician = require('../models/Technician');
const Supplier = require('../models/Supplier');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Create user
    const user = new User({ name, email, password, role, phone });

    // If customer role, create customer profile
    if (role === 'Customer') {
      const customer = new Customer({ name, phone, email });
      await customer.save();
      user.customerProfile = customer._id;
    }

    // If technician role, create technician profile
    if (role === 'Technician') {
      const technician = new Technician({ name, specialty: 'General' });
      await technician.save();
      user.technicianProfile = technician._id;
    }

    if (role === 'Supplier') {
      const supplier = await Supplier.create({
        name,
        contactPerson: name,
        phone: phone || 'Not provided',
        email,
        address: 'Update your address'
      });
      user.supplierProfile = supplier._id;
      supplier.user = user._id;
      await supplier.save();
    }

    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role, technicianProfile: user.technicianProfile, supplierProfile: user.supplierProfile },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, technicianProfile: user.technicianProfile, supplierProfile: user.supplierProfile }
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const identifier = (email || '').trim();

    // Find user by email and role
    const user = await User.findOne({
      role,
      $or: [{ email: identifier.toLowerCase() }, { name: identifier }]
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email, password, or role.' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email, password, or role.' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role, technicianProfile: user.technicianProfile, supplierProfile: user.supplierProfile },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, technicianProfile: user.technicianProfile, supplierProfile: user.supplierProfile }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// GET /api/auth/me  — get current user info
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
});

module.exports = router;
