const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const StockFlag = require('../models/StockFlag');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const JobCard = require('../models/JobCard');
const { createRecentDemandForecast } = require('../services/recentDemandForecast');
const { authMiddleware, requireRole } = require('../middleware/auth');

const execFileAsync = promisify(execFile);
const router = express.Router();
const tiers = [
  'CRITICAL - already low',
  'HIGH - reorder now',
  'WATCH - likely low within 7 days'
];

router.use(authMiddleware, requireRole('Owner'));

router.get('/', async (req, res) => {
  try {
    const [rows, latestScore] = await Promise.all([
      StockFlag.find({ flag: { $in: tiers } })
        .select('product_id name category stock threshold p_low_7d days_to_threshold pred_daily_demand flag suggested_order_qty scoredAt historyDays')
        .lean(),
      StockFlag.findOne().sort({ scoredAt: -1 }).select('scoredAt historyDays').lean()
    ]);
    if (!latestScore) {
      const historyDays = 28;
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - historyDays + 1);
      const end = new Date();
      end.setUTCHours(0, 0, 0, 0);
      end.setUTCDate(end.getUTCDate() + 1);
      const [products, sales, jobs] = await Promise.all([
        Product.find().select('name category quantity lowStockThreshold').lean(),
        Sale.find({ createdAt: { $gte: start, $lt: end }, billType: { $ne: 'REPAIR' } })
          .select('items.product items.quantity').lean(),
        JobCard.find({ appointmentDate: { $gte: start, $lt: end } })
          .select('partsUsed.product partsUsed.quantity').lean()
      ]);
      const demandByProduct = new Map();
      const addDemand = (productId, quantity) => {
        if (!productId) return;
        const id = String(productId);
        demandByProduct.set(id, (demandByProduct.get(id) || 0) + Number(quantity || 0));
      };
      for (const sale of sales) {
        for (const item of sale.items || []) addDemand(item.product, item.quantity);
      }
      for (const job of jobs) {
        for (const item of job.partsUsed || []) addDemand(item.product, item.quantity);
      }
      const flags = createRecentDemandForecast({ products, demandByProduct, historyDays });
      const hasRecentDemand = [...demandByProduct.values()].some(quantity => quantity > 0);
      return res.json({
        flags,
        scoredAt: null,
        source: hasRecentDemand ? 'recent-demand-forecast' : 'inventory-threshold',
        forecastHistoryDays: historyDays,
        summary: {
          critical: flags.filter(flag => flag.flag === tiers[0]).length,
          high: flags.filter(flag => flag.flag === tiers[1]).length,
          watch: flags.filter(flag => flag.flag === tiers[2]).length,
          total: flags.length
        }
      });
    }

    const tierOrder = new Map(tiers.map((tier, index) => [tier, index]));
    rows.sort((left, right) => (
      tierOrder.get(left.flag) - tierOrder.get(right.flag)
      || right.p_low_7d - left.p_low_7d
    ));

    const summary = {
      critical: rows.filter(row => row.flag === tiers[0]).length,
      high: rows.filter(row => row.flag === tiers[1]).length,
      watch: rows.filter(row => row.flag === tiers[2]).length,
      total: rows.length
    };
    res.json({
      flags: rows,
      scoredAt: latestScore.scoredAt,
      historyDays: latestScore.historyDays ?? null,
      source: 'model',
      summary
    });
  } catch (err) {
    console.error('Could not load stock flags:', err.message);
    res.status(500).json({ error: 'Could not load stock alerts.' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const backendDirectory = path.join(__dirname, '..');
    const scriptPath = path.join(backendDirectory, 'ml', 'score_stock.py');
    const virtualEnvironmentPython = path.join(
      backendDirectory,
      '.venv',
      process.platform === 'win32' ? 'Scripts' : 'bin',
      process.platform === 'win32' ? 'python.exe' : 'python'
    );
    const python = process.env.PYTHON_EXECUTABLE
      || (fs.existsSync(virtualEnvironmentPython) ? virtualEnvironmentPython : 'python');
    const { stdout, stderr } = await execFileAsync(python, [scriptPath], {
      cwd: backendDirectory,
      timeout: 120000,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.warn(stderr.trim());

    const scoredAt = await StockFlag.findOne().sort({ scoredAt: -1 }).select('scoredAt').lean();
    res.json({ message: 'Stock alerts refreshed.', scoredAt: scoredAt?.scoredAt || null });
  } catch (err) {
    console.error('Stock alert refresh failed:', err.message);
    const message = err.code === 'ENOENT'
      ? 'Python was not found. Install Python 3.11+ and backend/requirements.txt, or set PYTHON_EXECUTABLE to the full path of the Python executable.'
      : `Stock alert refresh failed: ${err.message}`;
    res.status(500).json({ error: message });
  }
});

module.exports = router;
