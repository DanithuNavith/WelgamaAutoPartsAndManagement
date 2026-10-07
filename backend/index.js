const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const envPath = [path.join(__dirname, '.env'), path.join(__dirname, 'backend.env')]
  .find(filePath => fs.existsSync(filePath));
if (envPath) require('dotenv').config({ path: envPath });

const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const jobCardRoutes = require('./routes/jobCardRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const authRoutes = require('./routes/authRoutes');
const stockFlagRoutes = require('./routes/stockFlagRoutes');
const User = require('./models/User');
const Technician = require('./models/Technician');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'unavailable',
    database: connected ? 'connected' : 'disconnected'
  });
});

app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({ message: 'Database is temporarily unavailable. Please try again shortly.' });
});

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
app.use('/api/stock-flags', stockFlagRoutes);

const frontendDirectory = path.join(__dirname, 'public');
const frontendEntry = path.join(frontendDirectory, 'index.html');
app.use(express.static(frontendDirectory));
app.get('/', (req, res) => {
  res.status(503).json({ message: 'Frontend build is missing. Build the frontend before deploying the backend.' });
});
app.use((req, res, next) => {
  if (req.method !== 'GET' || /^\/api(?:\/|$)/.test(req.path)) return next();
  res.sendFile(frontendEntry, error => {
    if (error) next(error);
  });
});

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
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI
  || (process.env.NODE_ENV === 'production' ? null : 'mongodb://127.0.0.1:27017/welgama-auto');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

let loginAccountsInitialized = false;
let mongoRetryTimer;

const connectToMongo = async () => {
  if (!mongoUri) {
    console.error('MongoDB URI is missing. Set MONGO_URI or MONGODB_URI in the backend environment.');
    return;
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
      console.log('Connected to MongoDB');
    }
    if (!loginAccountsInitialized) {
      await ensureLoginAccounts();
      loginAccountsInitialized = true;
    }
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    mongoRetryTimer = setTimeout(connectToMongo, 10000);
  }
};

connectToMongo().catch(err => {
  console.error('MongoDB initialization failed', err);
  mongoRetryTimer = setTimeout(connectToMongo, 10000);
});
