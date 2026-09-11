const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 0 },
  lowStockThreshold: { type: Number, required: true, default: 5 },
  image: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
