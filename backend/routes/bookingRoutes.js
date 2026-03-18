const express = require('express');
const router = express.Router();
const {
  createBooking, getMyBookings, getShopBookings,
  updateBookingStatus, cancelBooking, markArrived
} = require('../controllers/bookingController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/book', protect, createBooking);
router.get('/my-bookings', protect, getMyBookings);
router.get('/shop-bookings', protect, authorizeRoles('provider', 'admin'), getShopBookings);
router.put('/:id/status', protect, authorizeRoles('provider', 'admin'), updateBookingStatus);
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/arrived', protect, markArrived);

module.exports = router;