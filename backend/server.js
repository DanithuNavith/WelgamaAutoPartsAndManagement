const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const jobCardRoutes = require('./routes/jobCardRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const authRoutes = require('./routes/authRoutes');
const User = require('./models/User');
const Technician = require('./models/Technician');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/jobCards', jobCardRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);

const PORT = process.env.PORT || 5000;

const ensureLoginAccounts = async () => {
  const accounts = [
    { name: 'Welgama Owner', email: 'owner@welgama.com', password: 'Owner@12345', role: 'Owner' },
    { name: 'Technician 1', email: 'technician1@welgama.com', password: 'Tech1@12345', role: 'Technician' },
    { name: 'Technician 2', email: 'technician2@welgama.com', password: 'Tech2@12345', role: 'Technician' }
  ];

  for (const account of accounts) {
    let user = await User.findOne({ email: account.email });
    if (!user) user = new User(account);
    else {
      user.name = account.name;
      user.password = account.password;
      user.role = account.role;
    }

    if (account.role === 'Technician' && !user.technicianProfile) {
      const technician = await Technician.create({ name: account.name, specialty: 'General' });
      user.technicianProfile = technician._id;
    }
    await user.save();
  }
  console.log('Default login accounts are ready');
};

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/welgama-auto')
  .then(() => {
    console.log('Connected to MongoDB');
    return ensureLoginAccounts();
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });
