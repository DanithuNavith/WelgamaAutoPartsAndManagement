const mongoose = require('mongoose');

const stockFlagSchema = new mongoose.Schema({
  product_id: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, default: '' },
  stock: { type: Number, required: true },
  threshold: { type: Number, required: true },
  p_low_7d: { type: Number, required: true },
  days_to_threshold: { type: Number, required: true },
  pred_daily_demand: { type: Number, required: true },
  flag: { type: String, required: true },
  suggested_order_qty: { type: Number, required: true },
  scoredAt: { type: Date, required: true }
}, { timestamps: false, versionKey: false });

module.exports = mongoose.model('StockFlag', stockFlagSchema, 'stock_flags');
