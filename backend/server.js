const express      = require('express');
const dotenv       = require('dotenv');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const connectDB    = require('./config/db');

// ── Load env variables first ───────────────────────────
dotenv.config();
connectDB();

const app = express();

// ─────────────────────────────────────────────────────────
// 1. HELMET — Secure HTTP Headers
// ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // allow images from Cloudinary
}));

// ─────────────────────────────────────────────────────────
// 2. CORS — Allowed Origins Only
// ─────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  // Render backend (self)
  'https://servilo-backend.onrender.com',
  // Admin panel (update with your real Netlify URL when deployed)
  'https://servilo-admin.netlify.app',
  // Local development
  'http://localhost:3000',
  'http://localhost:5000',
  'http://192.168.31.135:5000'   // your local IP for mobile testing
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked request from: ${origin}`);
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions)); // Handle preflight for all routes

// ─────────────────────────────────────────────────────────
// 3. MORGAN — Request Logger
// ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev')); // colourful dev output
} else {
  app.use(morgan('combined')); // Apache-style logs for production
}

// ─────────────────────────────────────────────────────────
// 4. BODY PARSER
// ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));  // limit payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────────────────────
// 5. GLOBAL RATE LIMITER — All /api routes
// ─────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,                   // 200 requests per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

app.use('/api', globalLimiter);

// ─────────────────────────────────────────────────────────
// 6. AUTH RATE LIMITER — Stricter on /api/auth
// ─────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // only 10 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed/errored requests
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
  }
});

// ─────────────────────────────────────────────────────────
// 7. ROUTES
// ─────────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, require('./routes/authRoutes'));
app.use('/api/shops',               require('./routes/shopRoutes'));
app.use('/api/bookings',            require('./routes/bookingRoutes'));
app.use('/api/reviews',             require('./routes/reviewRoutes'));
app.use('/api/upload',              require('./routes/uploadRoutes'));

// ─────────────────────────────────────────────────────────
// 8. HEALTH CHECK
// ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Servilo Backend is running!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ─────────────────────────────────────────────────────────
// 9. 404 HANDLER
// ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// ─────────────────────────────────────────────────────────
// 10. GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // CORS errors
  if (err.message?.startsWith('CORS policy')) {
    return res.status(403).json({
      success: false,
      message: err.message
    });
  }

  console.error('❌ Unhandled error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ─────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Helmet: enabled`);
  console.log(`🛡️  Rate limiting: enabled`);
  console.log(`📝 Morgan logging: enabled`);
});