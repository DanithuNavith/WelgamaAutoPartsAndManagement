const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  jobCard: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, trim: true, default: '' },
  customerPhone: { type: String, trim: true, default: '' },
  customerEmail: { type: String, trim: true, lowercase: true, default: '' },
  vehicle: { make: String, model: String, year: Number, licensePlate: String },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
  technicianHours: { type: Number, min: 0, default: 0 },
  technicianRate: { type: Number, min: 0, default: 0 },
  partsCost: { type: Number, min: 0, default: 0 },
  technicianCost: { type: Number, min: 0, default: 0 },
  billType: { type: String, enum: ['PARTS', 'REPAIR'], default: 'PARTS' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, default: 'Auto part' },
    quantity: { type: Number, required: true },
    priceAtSale: { type: Number, required: true },
    unitCostAtSale: { type: Number, min: 0, default: null }
  }],
  subtotal: { type: Number, required: true },
  discount: { type: Number, min: 0, default: 0 },
  netProfit: { type: Number, default: null },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Paid', 'Pending'], default: 'Paid' },
  invoiceEmailSentAt: { type: Date },
  invoiceEmailTo: { type: String, default: '' },
  invoiceEmailError: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
