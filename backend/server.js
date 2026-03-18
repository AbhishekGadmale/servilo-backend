const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: '🚀 Servilo Backend is running!' });
});

// Routes (we'll uncomment these as we build)
// Routes
app.use('/api/auth', require('./routes/authRoutes'));
//app.use('/api/auth', require('./routes/authRoutes'));
 app.use('/api/shops', require('./routes/shopRoutes'));
 app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});