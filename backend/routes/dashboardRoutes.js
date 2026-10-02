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
    const lowStockFilter = {
      $expr: { $lte: ['$quantity', { $ifNull: ['$lowStockThreshold', 5] }] }
    };
    const [lowStockCount, lowStockItems] = await Promise.all([
      Product.countDocuments(lowStockFilter),
      Product.find(lowStockFilter).select('name category quantity lowStockThreshold').sort({ quantity: 1, name: 1 }).limit(10)
    ]);
    
    const sales = await Sale.find();
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);

    const activeRepairs = await JobCard.countDocuments({ status: { $nin: ['COMPLETED', 'Completed'] } });
    
    res.json({
      totalProducts,
      lowStockCount,
      lowStockItems,
      totalRevenue,
      activeRepairs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
