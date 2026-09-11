const mongoose = require('mongoose');

const technicianSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialty: { type: String },
  hourlyRate: { type: Number, min: 0, default: 1000 },
  status: { type: String, enum: ['Available', 'Busy', 'Offline'], default: 'Available' }
}, { timestamps: true });

module.exports = mongoose.model('Technician', technicianSchema);
