const express = require('express');
const Supplier = require('../models/Supplier');
const User = require('../models/User');
const PurchaseOrder = require('../models/PurchaseOrder');
const { sendSupplierWelcomeEmail } = require('../services/supplierWelcomeEmail');
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
    const contactPerson = String(req.body.contactPerson || '').trim();
    const phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();

    if (!contactPerson) return res.status(400).json({ error: 'Contact person is required.' });
    if (!address) return res.status(400).json({ error: 'Address is required.' });

    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (!/^(?:\+94|94|0)\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: 'Please enter a valid Sri Lankan phone number.' });
    }

    const allowed = { contactPerson, phone, address };
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
  let createdUser;
  try {
    const { name, contactPerson, phone, email, address, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!name?.trim() || !contactPerson?.trim() || !phone?.trim() || !address?.trim() || !normalizedEmail) {
      return res.status(400).json({ error: 'Supplier name, contact person, phone, email, and address are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Supplier password must be at least 8 characters.' });
    }
    if (phone.replace(/\D/g, '').length < 4) {
      return res.status(400).json({ error: 'Supplier phone number must contain at least four digits to protect the credentials PDF.' });
    }

    const [existingUser, supplier] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      Supplier.findOne({ email: normalizedEmail }).select('+password')
    ]);
    if (existingUser && existingUser.role !== 'Supplier') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (existingUser && (!supplier || supplier.user?.toString() === existingUser._id.toString())) {
      return res.status(409).json({ error: 'A login account with this email already exists.' });
    }
    if (supplier?.user) {
      return res.status(409).json({ error: 'A supplier with this email already has a login account.' });
    }

    const user = existingUser || await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'Supplier',
      phone: phone.trim()
    });
    if (!existingUser) createdUser = user;

    const supplierProfile = supplier || new Supplier({ email: normalizedEmail });
    supplierProfile.name = name.trim();
    supplierProfile.contactPerson = contactPerson.trim();
    supplierProfile.phone = phone.trim();
    supplierProfile.address = address.trim();
    supplierProfile.password = password;
    supplierProfile.user = user._id;
    await supplierProfile.save();

    user.name = name.trim();
    user.email = normalizedEmail;
    user.phone = phone.trim();
    user.role = 'Supplier';
    user.supplierProfile = supplierProfile._id;
    user.password = password;
    await user.save();

    let emailStatus;
    try {
      await sendSupplierWelcomeEmail(supplierProfile, password);
      emailStatus = { sent: true, to: normalizedEmail };
    } catch (err) {
      console.error(`Supplier welcome email failed for supplier ${supplierProfile._id}:`, err.message);
      emailStatus = { sent: false, to: normalizedEmail, error: err.message };
    }

    const responseSupplier = supplierProfile.toObject();
    delete responseSupplier.password;
    res.status(201).json({ ...responseSupplier, emailStatus });
  } catch (err) {
    if (createdUser) await User.deleteOne({ _id: createdUser._id });
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/welcome-email', async (req, res) => {
  try {
    const { password } = req.body;
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'The supplier login password is required to resend the welcome email.' });
    }

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
    const user = supplier.user ? await User.findById(supplier.user) : null;
    if (!user || user.role !== 'Supplier' || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'The password does not match this supplier account.' });
    }

    await sendSupplierWelcomeEmail(supplier, password);
    res.json({ emailStatus: { sent: true, to: supplier.email } });
  } catch (err) {
    console.error(`Supplier welcome email resend failed for supplier ${req.params.id}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, password } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const normalizedEmail = String(email || supplier.email || '').trim().toLowerCase();
    const supplierName = String(name || contactPerson || supplier.name).trim();
    const existingEmailUser = await User.findOne({ email: normalizedEmail, _id: { $ne: supplier.user } });
    const existingEmailSupplier = await Supplier.findOne({ email: normalizedEmail, _id: { $ne: supplier._id } });
    if (existingEmailUser || existingEmailSupplier) {
      return res.status(409).json({ error: 'Another account already uses this email address.' });
    }

    let user = supplier.user ? await User.findById(supplier.user) : null;
    if (user) {
      user.name = supplierName;
      user.email = normalizedEmail;
      user.phone = phone || supplier.phone;
      if (typeof password === 'string' && password.length > 0) {
        if (password.length < 8) return res.status(400).json({ error: 'Supplier password must be at least 8 characters.' });
        user.password = password;
      }
      await user.save();
    } else if (typeof password === 'string' && password.length > 0) {
      if (password.length < 8) return res.status(400).json({ error: 'Supplier password must be at least 8 characters.' });
      user = await User.create({
        name: supplierName,
        email: normalizedEmail,
        password,
        role: 'Supplier',
        phone: phone || supplier.phone,
        supplierProfile: supplier._id
      });
      supplier.user = user._id;
    }

    supplier.name = supplierName;
    supplier.contactPerson = contactPerson || supplier.contactPerson;
    supplier.phone = phone || supplier.phone;
    supplier.email = normalizedEmail || supplier.email;
    supplier.address = address || supplier.address;
    await supplier.save();

    const responseSupplier = supplier.toObject();
    delete responseSupplier.password;
    res.json(responseSupplier);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    if (supplier.user) await User.findByIdAndDelete(supplier.user);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
