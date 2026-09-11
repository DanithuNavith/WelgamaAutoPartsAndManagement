const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  vehicles: [{
    make: String,
    model: String,
    licensePlate: String,
    year: Number
  }]
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
