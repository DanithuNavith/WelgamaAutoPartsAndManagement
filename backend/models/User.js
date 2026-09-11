const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Owner', 'Customer', 'Technician', 'Supplier'], required: true },
  phone: { type: String },
  // References to role-specific profiles
  customerProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  technicianProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
  supplierProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
