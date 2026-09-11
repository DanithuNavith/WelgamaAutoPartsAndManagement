const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  orderNumber: { type: String, required: true, unique: true, trim: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }
  }],
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['Pending', 'Ordered', 'Partially Received', 'Received', 'Rejected'], default: 'Pending' },
  deliveryStatus: { type: String, enum: ['Awaiting dispatch', 'In transit', 'Delivered'], default: 'Awaiting dispatch' },
  orderDate: { type: Date, default: Date.now },
  expectedDelivery: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
