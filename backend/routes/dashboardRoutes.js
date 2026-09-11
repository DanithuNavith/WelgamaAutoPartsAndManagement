const express = require('express');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const JobCard = require('../models/JobCard');
const Technician = require('../models/Technician');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware, requireRole('Owner'));

router.get('/', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    // Use aggregate to find products where quantity <= lowStockThreshold
    const lowStockItems = await Product.find({ $expr: { $lte: ['$quantity', '$lowStockThreshold'] } });
    const lowStockCount = lowStockItems.length;
    
    const sales = await Sale.find();
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);

    const activeRepairs = await JobCard.countDocuments({ status: { $nin: ['COMPLETED', 'Completed'] } });
    
    res.json({
      totalProducts,
      lowStockCount,
      totalRevenue,
      activeRepairs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
