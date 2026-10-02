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
    if (role === 'Supplier') {
      return res.status(403).json({ message: 'Supplier accounts are created by the owner. Use the email and password provided by your supplier.' });
    }

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

    let user;
    if (role === 'Supplier') {
      const normalizedEmail = identifier.toLowerCase();
      user = await User.findOne({ email: normalizedEmail, role: 'Supplier' });
      let supplier = await Supplier.findOne({ email: normalizedEmail }).select('+password');

      if (!supplier && user?.supplierProfile) {
        supplier = await Supplier.findById(user.supplierProfile).select('+password');
      }

      if (user) {
        if (!await user.comparePassword(password)) {
          return res.status(401).json({ message: 'Invalid email, password, or role.' });
        }
        if (supplier) {
          if (user.supplierProfile && user.supplierProfile.toString() !== supplier._id.toString()) {
            return res.status(401).json({ message: 'Invalid email, password, or role.' });
          }
          const supplierLinkedToAnotherUser = supplier.user && supplier.user.toString() !== user._id.toString();
          if (supplierLinkedToAnotherUser) {
            return res.status(401).json({ message: 'Invalid email, password, or role.' });
          }
          if (!user.supplierProfile || !supplier.user) {
            user.supplierProfile = supplier._id;
            supplier.user = user._id;
            await Promise.all([user.save(), supplier.save()]);
          }
        }
      } else if (supplier && await supplier.comparePassword(password)) {
        user = await User.create({
          name: supplier.name || supplier.contactPerson,
          email: supplier.email,
          password,
          role: 'Supplier',
          phone: supplier.phone,
          supplierProfile: supplier._id
        });
        supplier.user = user._id;
        await supplier.save();
      } else {
        return res.status(401).json({ message: 'Invalid email, password, or role.' });
      }
    } else {
      user = await User.findOne({
        role,
        $or: [{ email: identifier.toLowerCase() }, { name: identifier }]
      });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email, password, or role.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email, password, or role.' });
    }

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
