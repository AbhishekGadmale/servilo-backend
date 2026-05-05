const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const {
  createBooking, getMyBookings, getShopBookings,
  updateBookingStatus, cancelBooking, markArrived,
  getBookingProgress, nextCustomer, getProviderStats
} = require('../controllers/bookingController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// ── Reusable validation error handler ──────────────────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array({ onlyFirstError: true })[0];
    return res.status(400).json({
      success: false,
      message: firstError.msg
    });
  }
  next();
};

router.post('/book',
  protect,
  [
    body('shopId').isMongoId().withMessage('Invalid shop ID'),
    body('serviceType').isIn(['barber', 'food', 'hardware', 'electrician', 'plumber', 'mechanic'])
      .withMessage('Invalid service type'),
    body('bookingType').isIn(['queue', 'order', 'request'])
      .withMessage('Invalid booking type'),
  ],
  handleValidation,
  createBooking
);

router.get('/my-bookings', protect, getMyBookings);
router.get('/shop-bookings', protect, authorizeRoles('provider', 'admin'), getShopBookings);
router.get('/stats', protect, authorizeRoles('provider', 'admin'), getProviderStats);
router.get('/:id/progress', protect, getBookingProgress);
router.post('/next-customer', protect, authorizeRoles('provider', 'admin'), nextCustomer);

router.put('/:id/status',
  protect,
  authorizeRoles('provider', 'admin'),
  [
    body('status').isIn(['confirmed', 'rejected', 'in_progress', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
  ],
  handleValidation,
  updateBookingStatus
);

router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/arrived', protect, markArrived);

module.exports = router;