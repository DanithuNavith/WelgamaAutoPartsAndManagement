const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  category: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  price: { type: Number, required: true, min: 0.01 },
  costPrice: { type: Number, min: 0, required: true },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: { validator: Number.isInteger, message: 'Quantity must be a whole number.' }
  },
  lowStockThreshold: {
    type: Number,
    required: true,
    default: 5,
    min: 0,
    validate: { validator: Number.isInteger, message: 'Low stock threshold must be a whole number.' }
  },
  image: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
