const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const StockFlag = require('../models/StockFlag');
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
        .select('product_id name category stock threshold p_low_7d days_to_threshold pred_daily_demand flag suggested_order_qty scoredAt')
        .lean(),
      StockFlag.findOne().sort({ scoredAt: -1 }).select('scoredAt').lean()
    ]);
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
    res.json({ flags: rows, scoredAt: latestScore?.scoredAt || null, summary });
  } catch (err) {
    console.error('Could not load stock flags:', err.message);
    res.status(500).json({ error: 'Could not load stock alerts.' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const scriptPath = require('path').join(__dirname, '..', 'ml', 'score_stock.py');
    const python = process.env.PYTHON_EXECUTABLE || 'python';
    const { stdout, stderr } = await execFileAsync(python, [scriptPath], {
      cwd: require('path').join(__dirname, '..'),
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
    res.status(500).json({ error: `Stock alert refresh failed: ${err.message}` });
  }
});

module.exports = router;
