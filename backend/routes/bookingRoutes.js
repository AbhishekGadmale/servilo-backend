const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getShopBookings,
  updateBookingStatus,
  cancelBooking
} = require('../controllers/bookingController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/book', protect, authorizeRoles('customer'), createBooking);
router.get('/my-bookings', protect, authorizeRoles('customer'), getMyBookings);
router.get('/shop-bookings', protect, authorizeRoles('provider', 'admin'), getShopBookings);
router.put('/:id/status', protect, authorizeRoles('provider', 'admin'), updateBookingStatus);
router.put('/:id/cancel', protect, authorizeRoles('customer'), cancelBooking);

module.exports = router;