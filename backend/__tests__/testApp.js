// Separate Express app for testing (no server.listen)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.test' });

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('../routes/authRoutes'));
app.use('/api/shops', require('../routes/shopRoutes'));
app.use('/api/bookings', require('../routes/bookingRoutes'));
app.use('/api/reviews', require('../routes/reviewRoutes'));
app.use('/api/upload', require('../routes/uploadRoutes'));

app.get('/', (req, res) => res.json({ message: '🚀 Servilo Test Server' }));

module.exports = app;