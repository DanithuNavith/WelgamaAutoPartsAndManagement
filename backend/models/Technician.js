const mongoose = require('mongoose');

const technicianSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialty: { type: String },
  status: { type: String, enum: ['Available', 'Busy', 'Offline'], default: 'Available' }
}, { timestamps: true });

module.exports = mongoose.model('Technician', technicianSchema);
