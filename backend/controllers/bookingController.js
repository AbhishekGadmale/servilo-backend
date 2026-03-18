const Booking = require('../models/Booking');
const Shop = require('../models/Shop');

// @route  POST /api/bookings/book
const createBooking = async (req, res) => {
  try {
    const {
      shopId, bookingType, service,
      timeSlot, notes, foodItems, totalAmount,
      isForFriend, friendName, friendPhone
    } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });
    if (!shop.isOpen) return res.status(400).json({ message: 'Shop is currently closed' });

    // Check booking limit (max 2 active bookings)
    const activeBookings = await Booking.countDocuments({
      userId: req.user.id,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (activeBookings >= 2) {
      return res.status(400).json({
        message: 'You can only have 2 active bookings at a time (1 for yourself, 1 for a friend)'
      });
    }

    let queueNumber = 0;
    let estimatedWaitTime = 0;

    if (bookingType === 'queue') {
      shop.currentQueue += 1;
      await shop.save();
      queueNumber = shop.currentQueue;
      estimatedWaitTime = queueNumber * (service?.duration || 30);
    }

    const booking = await Booking.create({
      userId: req.user.id,
      shopId,
      bookingType,
      service: service || {},
      foodItems: foodItems || [],
      totalAmount: totalAmount || service?.price || 0,
      timeSlot: timeSlot || '',
      queueNumber,
      estimatedWaitTime,
      isForFriend: isForFriend || false,
      friendName: friendName || '',
      friendPhone: friendPhone || '',
      notes: notes || ''
    });

    await booking.populate('shopId', 'shopName address phone category');
    await booking.populate('userId', 'name phone');

    // Send notification to provider
    await sendProviderNotification(shop.ownerId, booking, shop.shopName);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully!',
      booking
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Send push notification to provider
const sendProviderNotification = async (ownerId, booking, shopName) => {
  try {
    const User = require('../models/User');
    const owner = await User.findById(ownerId);
    if (!owner?.expoPushToken || !owner?.notificationsEnabled) return;

    const message = booking.bookingType === 'food_order'
      ? `New food order at ${shopName}! Total: ₹${booking.totalAmount}`
      : `New booking at ${shopName} for ${booking.service?.name}`;

    await sendPushNotification(owner.expoPushToken, '🔔 New Booking!', message);
  } catch (error) {
    console.log('Notification error:', error.message);
  }
};

// Send push notification to customer
const sendCustomerNotification = async (userId, title, message) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user?.expoPushToken || !user?.notificationsEnabled) return;
    await sendPushNotification(user.expoPushToken, title, message);
  } catch (error) {
    console.log('Notification error:', error.message);
  }
};

// Expo push notification sender
const sendPushNotification = async (token, title, body) => {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default' })
    });
  } catch (error) {
    console.log('Push error:', error.message);
  }
};

// @route  GET /api/bookings/my-bookings
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate('shopId', 'shopName address category phone photos')
      .sort({ bookingDate: -1 });
    res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  GET /api/bookings/shop-bookings
const getShopBookings = async (req, res) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user.id });
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const bookings = await Booking.find({ shopId: shop._id })
      .populate('userId', 'name phone')
      .sort({ bookingDate: -1 });

    res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  PUT /api/bookings/:id/status
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('shopId', 'shopName currentQueue');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = status;
    await booking.save();

    // Notify customer
    const statusMessages = {
      confirmed: `Your booking at ${booking.shopId?.shopName} has been confirmed! ✅`,
      cancelled: `Your booking at ${booking.shopId?.shopName} was cancelled ❌`,
      completed: `Your service at ${booking.shopId?.shopName} is complete! Please leave a review ⭐`
    };

    if (statusMessages[status]) {
      await sendCustomerNotification(
        booking.userId,
        status === 'confirmed' ? '✅ Booking Confirmed!' :
        status === 'cancelled' ? '❌ Booking Cancelled' : '🎉 Service Complete!',
        statusMessages[status]
      );
    }

    // Queue position notifications
    if (booking.bookingType === 'queue' && status === 'completed') {
      const shop = await Shop.findById(booking.shopId);
      if (shop && shop.currentQueue > 0) {
        shop.currentQueue -= 1;
        await shop.save();
        await notifyQueuePositions(booking.shopId._id);
      }
    }

    res.status(200).json({ success: true, message: `Booking ${status}`, booking });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Notify customers at queue position 2 and 3
const notifyQueuePositions = async (shopId) => {
  try {
    const queueBookings = await Booking.find({
      shopId,
      status: { $in: ['pending', 'confirmed'] },
      bookingType: 'queue'
    }).sort({ queueNumber: 1 }).populate('userId', 'expoPushToken notificationsEnabled name');

    for (let i = 0; i < queueBookings.length; i++) {
      const position = i + 1;
      const b = queueBookings[i];
      if (!b.userId?.expoPushToken || !b.userId?.notificationsEnabled) continue;

      if (position === 3) {
        await sendPushNotification(
          b.userId.expoPushToken,
          '⏰ Almost Your Turn!',
          'You are 3rd in queue. Please get ready!'
        );
      } else if (position === 2) {
        await sendPushNotification(
          b.userId.expoPushToken,
          '🔔 Next Up!',
          'You are 2nd in queue. Head to the shop now!'
        );
      } else if (position === 1) {
        await sendPushNotification(
          b.userId.expoPushToken,
          '✅ Your Turn Now!',
          'You are next! Please proceed.'
        );
      }
    }
  } catch (error) {
    console.log('Queue notification error:', error);
  }
};

// @route  PUT /api/bookings/:id/cancel
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.userId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorized' });
    if (booking.status === 'completed')
      return res.status(400).json({ message: 'Cannot cancel completed booking' });

    booking.status = 'cancelled';
    await booking.save();

    if (booking.bookingType === 'queue') {
      const shop = await Shop.findById(booking.shopId);
      if (shop && shop.currentQueue > 0) {
        shop.currentQueue -= 1;
        await shop.save();
        await notifyQueuePositions(booking.shopId);
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