const Booking = require('../models/Booking');
const Shop = require('../models/Shop');
const User = require('../models/User');

// ─── Push Notification Helper ────────────────────────────
const sendPushNotification = async (token, title, body) => {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default' })
    });
  } catch (err) {
    console.log('Push error:', err.message);
  }
};

const notifyUser = async (userId, title, body) => {
  const user = await User.findById(userId);
  if (user?.expoPushToken && user?.notificationsEnabled)
    await sendPushNotification(user.expoPushToken, title, body);
};

const notifyProvider = async (ownerId, title, body) => {
  const owner = await User.findById(ownerId);
  if (owner?.expoPushToken && owner?.notificationsEnabled)
    await sendPushNotification(owner.expoPushToken, title, body);
};

// ─── Notify Queue Positions ──────────────────────────────
const notifyQueuePositions = async (shopId) => {
  const queueBookings = await Booking.find({
    shopId,
    serviceType: 'barber',
    status: { $in: ['pending', 'confirmed'] }
  })
    .sort({ 'barberData.queueNumber': 1 })
    .populate('userId', 'expoPushToken notificationsEnabled name');

  for (let i = 0; i < queueBookings.length; i++) {
    const position = i + 1;
    const b = queueBookings[i];
    if (!b.userId?.expoPushToken || !b.userId?.notificationsEnabled) continue;

    if (position === 3)
      await sendPushNotification(b.userId.expoPushToken,
        '⏰ Almost Your Turn!', 'You are 3rd in queue. Get ready!');
    else if (position === 2)
      await sendPushNotification(b.userId.expoPushToken,
        '🔔 Next Up!', 'You are 2nd in queue. Head to the shop!');
    else if (position === 1)
      await sendPushNotification(b.userId.expoPushToken,
        '✅ Your Turn!', 'You are next! Please proceed.');
  }
};

// ─── Create Booking ──────────────────────────────────────
const createBooking = async (req, res) => {
  try {
    const { shopId, serviceType, bookingType, isForFriend,
      friendName, friendPhone, barberData, orderData,
      electricianData, plumberData, mechanicData } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });
    if (!shop.isOpen) return res.status(400).json({ message: 'Shop is currently closed' });

    // Check active booking limit
    const activeCount = await Booking.countDocuments({
      userId: req.user.id,
      status: { $in: ['pending', 'confirmed', 'in_progress'] }
    });
    if (activeCount >= 2) {
      return res.status(400).json({
        message: 'You can only have 2 active bookings at a time'
      });
    }

    // Queue logic for barber
    let finalBarberData = barberData || {};
    if (serviceType === 'barber') {
      shop.currentQueue += 1;
      await shop.save();
      finalBarberData.queueNumber = shop.currentQueue;
      finalBarberData.estimatedWaitTime =
        shop.currentQueue * (barberData?.duration || 30);
    }

    const booking = await Booking.create({
      userId: req.user.id,
      shopId,
      serviceType,
      bookingType,
      isForFriend: isForFriend || false,
      friendName: friendName || '',
      friendPhone: friendPhone || '',
      barberData: finalBarberData,
      orderData: orderData || { items: [], totalAmount: 0 },
      electricianData: electricianData || {},
      plumberData: plumberData || {},
      mechanicData: mechanicData || {}
    });

    await booking.populate('shopId', 'shopName address phone category');
    await booking.populate('userId', 'name phone');

    // Notify provider
    const notifMessages = {
      barber: `New queue booking for ${barberData?.serviceName}`,
      food: `New food order! Total: ₹${orderData?.totalAmount}`,
      hardware: `New product order! Total: ₹${orderData?.totalAmount}`,
      electrician: `New electrician request: ${electricianData?.issueType}`,
      plumber: `New plumber request: ${plumberData?.issueType}`,
      mechanic: `New mechanic request: ${mechanicData?.vehicleType} - ${mechanicData?.problemType}`
    };
    await notifyProvider(shop.ownerId, '🔔 New Booking!',
      notifMessages[serviceType] || 'New booking received');

    res.status(201).json({ success: true, message: 'Booking created!', booking });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── Get My Bookings ─────────────────────────────────────
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

// ─── Get Shop Bookings ───────────────────────────────────
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

// ─── Update Booking Status ───────────────────────────────
const updateBookingStatus = async (req, res) => {
  try {
    const { status, providerNote, visitCharge, estimatedCost } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('shopId', 'shopName currentQueue');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = status;
    if (providerNote) booking.providerNote = providerNote;

    // Update charges if provided
    if (visitCharge && booking.serviceType === 'electrician')
      booking.electricianData.visitCharge = visitCharge;
    if (estimatedCost && booking.serviceType === 'plumber')
      booking.plumberData.estimatedCost = estimatedCost;

    await booking.save();

    // Notify customer
    const msgs = {
      confirmed: { title: '✅ Booking Confirmed!', body: `Your booking at ${booking.shopId?.shopName} is confirmed!` },
      rejected: { title: '❌ Booking Rejected', body: `Your booking at ${booking.shopId?.shopName} was rejected.` },
      in_progress: { title: '🔧 Service Started', body: `Your service at ${booking.shopId?.shopName} has started!` },
      completed: { title: '🎉 Service Complete!', body: `Service at ${booking.shopId?.shopName} is complete. Please review!` },
      cancelled: { title: '❌ Booking Cancelled', body: `Your booking at ${booking.shopId?.shopName} was cancelled.` }
    };
    if (msgs[status])
      await notifyUser(booking.userId, msgs[status].title, msgs[status].body);

    // Queue notifications for barber
    if (booking.serviceType === 'barber' && status === 'completed') {
      const shop = await Shop.findById(booking.shopId);
      if (shop && shop.currentQueue > 0) {
        shop.currentQueue -= 1;
        await shop.save();
        await notifyQueuePositions(booking.shopId._id);
      }
    }

    res.status(200).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── Cancel Booking ──────────────────────────────────────
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

    // Update queue for barber
    if (booking.serviceType === 'barber') {
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

// ─── Mark Customer Arrived (Barber) ─────────────────────
const markArrived = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.userId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorized' });

    booking.barberData.customerArrived = true;
    await booking.save();

    await notifyProvider(
      (await Shop.findById(booking.shopId)).ownerId,
      '👤 Customer Arriving!',
      `Customer is on their way for queue #${booking.barberData.queueNumber}`
    );

    res.status(200).json({ success: true, message: 'Marked as arriving!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createBooking, getMyBookings, getShopBookings,
  updateBookingStatus, cancelBooking, markArrived
};