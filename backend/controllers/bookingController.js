const Booking = require('../models/Booking');
const Shop = require('../models/Shop');

// @route  POST /api/bookings/book
// @access Private (customer)
const createBooking = async (req, res) => {
  try {
    const { shopId, service, bookingType, timeSlot, notes } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    if (!shop.isOpen) {
      return res.status(400).json({ message: 'Shop is currently closed' });
    }

    let queueNumber = 0;
    let estimatedWaitTime = 0;

    // If queue type (for barbers)
    if (bookingType === 'queue') {
      shop.currentQueue += 1;
      await shop.save();
      queueNumber = shop.currentQueue;
      estimatedWaitTime = queueNumber * (service.duration || 30);
    }

    const booking = await Booking.create({
      userId: req.user.id,
      shopId,
      service,
      bookingType,
      timeSlot: timeSlot || '',
      queueNumber,
      estimatedWaitTime,
      notes
    });

    await booking.populate('shopId', 'shopName address phone');
    await booking.populate('userId', 'name phone');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully!',
      booking
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  GET /api/bookings/my-bookings
// @access Private (customer)
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate('shopId', 'shopName address category phone')
      .sort({ bookingDate: -1 });

    res.status(200).json({ success: true, count: bookings.length, bookings });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  GET /api/bookings/shop-bookings
// @access Private (provider)
const getShopBookings = async (req, res) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user.id });
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const bookings = await Booking.find({ shopId: shop._id })
      .populate('userId', 'name phone')
      .sort({ bookingDate: -1 });

    res.status(200).json({ success: true, count: bookings.length, bookings });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  PUT /api/bookings/:id/status
// @access Private (provider)
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.status = status;
    await booking.save();

    res.status(200).json({
      success: true,
      message: `Booking ${status}`,
      booking
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  DELETE /api/bookings/:id/cancel
// @access Private (customer)
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed booking' });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Reduce queue count if queue booking
    if (booking.bookingType === 'queue') {
      const shop = await Shop.findById(booking.shopId);
      if (shop && shop.currentQueue > 0) {
        shop.currentQueue -= 1;
        await shop.save();
      }
    }

    res.status(200).json({ success: true, message: 'Booking cancelled' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getShopBookings,
  updateBookingStatus,
  cancelBooking
};