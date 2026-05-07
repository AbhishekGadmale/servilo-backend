const express      = require('express');
const dotenv       = require('dotenv');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const connectDB    = require('./config/db');

// ── Load env variables first ───────────────────────────
dotenv.config();
const Sentry = require('@sentry/node');

// ── Initialize Sentry FIRST before everything else ────
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  enabled: !!process.env.SENTRY_DSN, // only runs if DSN is set

  // Scrub sensitive fields from payloads
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data;
      if (data.password) data.password = '[REDACTED]';
      if (data.token)    data.token    = '[REDACTED]';
    }
    return event;
  }
});
connectDB();

const app = express();
const server = require('http').createServer(app);

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
  'http://localhost:5173',
  'http://192.168.31.135:5000'   // your local IP for mobile testing
];

const io = require('socket.io')(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});
const Message = require('./models/Message');
const User = require('./models/User');

const onlineUsers = new Map(); // userId -> Set(socketIds)

// Socket.io Logic
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  socket.on('register_user', (userId) => {
    socket.userId = userId;
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);
    io.emit('user_status_change', { userId, status: 'online' });
  });

  socket.on('get_user_status', (userId, callback) => {
    const isOnline = onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
    if (typeof callback === 'function') {
      callback({ isOnline });
    }
  });

  socket.on('join_room', (bookingId) => {
    socket.join(bookingId);
    console.log(`👤 User ${socket.id} joined room: ${bookingId}`);
  });

  socket.on('typing', (data) => {
    const { bookingId, userId } = data;
    socket.to(bookingId).emit('user_typing', { userId });
  });

  socket.on('stop_typing', (data) => {
    const { bookingId, userId } = data;
    socket.to(bookingId).emit('user_stop_typing', { userId });
  });

  socket.on('mark_read', (data) => {
    const { bookingId, userId } = data;
    socket.to(bookingId).emit('messages_read', { userId });
  });

  socket.on('send_message', async (data) => {
    const { bookingId, shopId, senderId, receiverId, message, image, audio } = data;

    try {
      const isObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
      const isBookingIdValid = isObjectId(bookingId);

      const clientsInRoom = io.sockets.adapter.rooms.get(bookingId);
      const numClients = clientsInRoom ? clientsInRoom.size : 0;
      const isDelivered = numClients >= 2;

      const newMessage = await Message.create({
        bookingId: isBookingIdValid ? bookingId : undefined,
        isInquiry: !isBookingIdValid,
        shopId,
        senderId,
        receiverId,
        message: message || '',
        image: image || '',
        audio: audio || '',
        isDelivered
      });

      const populatedMessage = await newMessage.populate('senderId', 'name profileImage');
      
      // Always emit to the room name provided by the client (ObjectId or inquiry string)
      io.to(bookingId).emit('receive_message', populatedMessage);
      console.log(`📩 Message sent in room ${bookingId}`);

      // --- PUSH NOTIFICATION LOGIC ---
      // If the receiver is not in the room, send a push notification
      if (numClients < 2) {
        try {
          const { notifyUser, notifyProvider } = require('./utils/notifications');
          const receiver = await User.findById(receiverId);
          const sender = await User.findById(senderId);
          
          if (receiver && receiver.expoPushToken) {
            const title = `New message from ${sender?.name || 'Someone'}`;
            let body = message;
            if (!body) {
              if (image) body = '📷 Sent an image';
              else if (audio) body = '🎤 Sent a voice message';
              else body = 'New message';
            }
            
            const notificationData = { 
              bookingId: isBookingIdValid ? bookingId : undefined, 
              shopId, 
              type: 'chat',
              screen: 'ChatScreen' 
            };

            if (receiver.role === 'provider') {
              await notifyProvider(receiverId, title, body, notificationData);
            } else {
              await notifyUser(receiverId, title, body, notificationData);
            }
          }
        } catch (err) {
          console.error('❌ Push notification error in socket:', err.message);
        }
      }
    } catch (error) {
      console.error('❌ Socket message error:', error.message);
    }
  });

  socket.on('update_location', async (data) => {
    const { bookingId, latitude, longitude } = data;
    try {
      // Broadcast to room (customer)
      io.to(bookingId).emit('location_updated', { latitude, longitude });

      // Save to DB (throttled/optional)
      const Booking = require('./models/Booking');
      await Booking.findByIdAndUpdate(bookingId, {
        providerLocation: {
          latitude,
          longitude,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('❌ Socket location error:', error.message);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId && onlineUsers.has(socket.userId)) {
      const userSockets = onlineUsers.get(socket.userId);
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(socket.userId);
        io.emit('user_status_change', { userId: socket.userId, status: 'offline' });
      }
    }
    console.log('👋 User disconnected');
  });
});

// ─────────────────────────────────────────────────────────
// 1. HELMET — Secure HTTP Headers
// ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // allow images from Cloudinary
}));

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
app.options(/(.*)/, cors(corsOptions)); // Handle preflight for all routes

// NOTE: @sentry/node v8+ instruments Express automatically via Sentry.init().
// The old Sentry.Handlers.requestHandler() / tracingHandler() were removed in v8.
// No manual middleware needed here.

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
// 5. RATE LIMITERS
//    - globalLimiter   → all /api routes (300 req / 15 min)
//    - loginLimiter    → POST /api/auth/login only
//    - signupLimiter   → POST /api/auth/signup only
//
//    Admin dashboard routes (GET /api/auth/admin/*, /api/shops/admin/*)
//    are covered ONLY by globalLimiter — never blocked by auth-attempt limits.
// ─────────────────────────────────────────────────────────
const { globalLimiter } = require('./middleware/rateLimiters');
app.use('/api', globalLimiter);

// ─────────────────────────────────────────────────────────
// 6. ROUTES
// ─────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/shops',    require('./routes/shopRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/reviews',  require('./routes/reviewRoutes'));
app.use('/api/upload',   require('./routes/uploadRoutes'));
app.use('/api/chat',     require('./routes/chatRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/staff',      require('./routes/staffRoutes'));

// Sentry error handler (must be after all controllers but before any custom error middleware)
Sentry.setupExpressErrorHandler(app);

// ─────────────────────────────────────────────────────────
// 7. HEALTH CHECK
// ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Servilo Backend is running!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// TEMPORARY — remove after Sentry test
app.get('/api/test-sentry', (req, res) => {
  throw new Error('Sentry backend test error!');
});

// ─────────────────────────────────────────────────────────
// 8. 404 HANDLER
// ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// ─────────────────────────────────────────────────────────
// 9. GLOBAL ERROR HANDLER
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
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Helmet: enabled`);
  console.log(`🛡️  Rate limiting: global (300/15m) + login (10 fails/15m) + signup (5/hr)`);
  console.log(`📝 Morgan logging: enabled`);
});