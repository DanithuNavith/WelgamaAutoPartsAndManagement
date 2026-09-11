const mongoose = require('mongoose');

const jobCardSchema = new mongoose.Schema({
  jobCardNumber: { type: String, required: true, unique: true, trim: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, required: true },
  customerPhone: { type: String },
  customerEmail: { type: String },
  customerAddress: { type: String },
  registrationNumber: { type: String, required: true },
  vehicleMake: { type: String, required: true },
  vehicleModel: { type: String, required: true },
  vehicleYear: { type: Number },
  licensePlate: { type: String, required: true },
  issueDescription: { type: String, required: true },
  appointmentDate: { type: Date },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
  technicianHours: { type: Number, min: 0, default: 0 },
  technicianRate: { type: Number, min: 0, default: 1000 },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  estimatedCost: { type: Number, min: 0, default: 0 },
  repairNotes: { type: String, default: '' },
  diagnosis: { type: String, default: '' },
  laborCost: { type: Number, min: 0, default: 0 },
  partsCost: { type: Number, min: 0, default: 0 },
  repairCost: { type: Number, min: 0, default: 0 },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  partsUsed: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    quantity: { type: Number, min: 1 },
    unitPrice: { type: Number, min: 0 }
  }],
  status: { type: String, enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'Pending', 'In Progress'], default: 'ASSIGNED' }
}, { timestamps: true });

module.exports = mongoose.model('JobCard', jobCardSchema);
