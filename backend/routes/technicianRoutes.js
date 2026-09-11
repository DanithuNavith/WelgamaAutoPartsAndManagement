const express = require('express');
const Technician = require('../models/Technician');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const techs = await Technician.find({ name: { $in: ['Technician 1', 'Technician 2'] } }).select('name status');
    res.json(techs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(requireRole('Owner'));

router.post('/', async (req, res) => {
  try {
    const tech = new Technician(req.body);
    await tech.save();
    res.status(201).json(tech);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const tech = await Technician.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!tech) return res.status(404).json({ error: 'Technician not found' });
    res.json(tech);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const tech = await Technician.findByIdAndDelete(req.params.id);
    if (!tech) return res.status(404).json({ error: 'Technician not found' });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
