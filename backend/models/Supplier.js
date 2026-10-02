const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contactPerson: { type: String, required: true, trim: true },
  phone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator(value) {
        const cleaned = String(value || '').trim();
        if (!cleaned) return false;
        const normalized = cleaned.replace(/[\s()-]/g, '');
        return /^(?:\+94|94|0)\d{9}$/.test(normalized);
      },
      message: 'Please enter a valid phone number.'
    }
  },
  email: { type: String, required: true, trim: true, lowercase: true },
  address: { type: String, required: true, trim: true },
  password: { type: String, required: false, select: false },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true }
}, { timestamps: true });

supplierSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

supplierSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Supplier', supplierSchema);
