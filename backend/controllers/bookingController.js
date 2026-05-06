const Booking = require('../models/Booking');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { notifyUser, notifyProvider, sendPushNotification } = require('../utils/notifications');

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
    const { shopId, staffId, serviceType, bookingType, isForFriend,
      friendName, friendPhone, barberData, orderData,
      electricianData, plumberData, mechanicData } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });
    if (!shop.isOpen) return res.status(400).json({ message: 'Shop is currently closed' });

    // ── Check Operating Hours ────────────────────────────
    const currentTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    const { openTime, closeTime } = shop;
    let isClosed = false;

    if (openTime <= closeTime) {
      // Normal hours: e.g. 09:00 - 21:00
      isClosed = (currentTimeStr < openTime || currentTimeStr > closeTime);
    } else {
      // Overnight hours: e.g. 18:00 - 02:00
      isClosed = (currentTimeStr < openTime && currentTimeStr > closeTime);
    }

    if (isClosed) {
      return res.status(400).json({
        message: `Shop is closed. Operating hours: ${openTime} - ${closeTime}`
      });
    }

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

    // ── Staff & Queue Logic ──────────────────────────────
    let finalBarberData = barberData || { duration: shop.averageServiceTime || 30 };
    let assignedStaffId = staffId;

    if (serviceType === 'barber') {
      if (assignedStaffId) {
        // Queue for specific staff
        const staff = await require('../models/Staff').findByIdAndUpdate(
          assignedStaffId,
          { $inc: { currentQueue: 1 } },
          { returnDocument: 'after' }
        );
        if (!staff) return res.status(404).json({ message: 'Staff member not found' });
        
        finalBarberData.queueNumber = staff.currentQueue;
        finalBarberData.estimatedWaitTime = staff.currentQueue * (finalBarberData.duration || shop.averageServiceTime || 30);
      } else {
        // General Shop Queue
        const updatedShop = await Shop.findByIdAndUpdate(
          shopId,
          { $inc: { currentQueue: 1 } },
          { returnDocument: 'after' }
        );
        finalBarberData.queueNumber = updatedShop.currentQueue;
        finalBarberData.estimatedWaitTime = updatedShop.currentQueue * (finalBarberData.duration || shop.averageServiceTime || 30);
      }
    }

    const booking = await Booking.create({
      userId: req.user.id,
      shopId,
      staffId: assignedStaffId,
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

    await booking.populate('shopId', 'shopName address phone category ownerId');
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
      .populate('shopId', 'shopName address category phone photos ownerId')
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
      .populate('userId', 'name phone profileImage')
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
      .populate('shopId', 'shopName currentQueue ownerId');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Authorization check: only shop owner or admin can update status
    if (booking.shopId.ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this booking' });
    }

    const previousStatus = booking.status;
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
    const terminalStates = ['completed', 'rejected', 'cancelled'];
    if (booking.serviceType === 'barber' && terminalStates.includes(status) && !terminalStates.includes(previousStatus)) {
      const shop = await Shop.findById(booking.shopId);
      if (shop && shop.currentQueue > 0) {
        shop.currentQueue -= 1;
        await shop.save();
      }

      // Decrement staff queue if assigned
      if (booking.staffId) {
        const staff = await require('../models/Staff').findById(booking.staffId);
        if (staff && staff.currentQueue > 0) {
          staff.currentQueue -= 1;
          await staff.save();
        }
      }
      
      await notifyQueuePositions(booking.shopId._id);
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

    const terminalStates = ['completed', 'cancelled', 'rejected'];
    if (terminalStates.includes(booking.status)) {
      return res.status(400).json({
        message: `Cannot cancel booking that is already ${booking.status}`
      });
    }

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

    // ─── Get Booking Progress (Real-time UX) ────────────────
    const getBookingProgress = async (req, res) => {
    try {
    const booking = await Booking.findById(req.params.id)
      .populate('shopId', 'shopName location currentQueue');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Ensure only the user who booked or an admin can see the progress
    if (booking.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    let progressData = {
      status: booking.status,
      shopName: booking.shopId.shopName,
      shopLocation: booking.shopId.location
    };

    if (booking.serviceType === 'barber' && ['pending', 'confirmed'].includes(booking.status)) {
      // Calculate current position in queue
      const position = await Booking.countDocuments({
        shopId: booking.shopId._id,
        serviceType: 'barber',
        status: { $in: ['pending', 'confirmed'] },
        'barberData.queueNumber': { $lt: booking.barberData.queueNumber }
      }) + 1;

      progressData.queuePosition = position;
      progressData.estimatedWaitTime = position * (booking.barberData.duration || 30);
    }

    res.status(200).json({ success: true, progress: progressData });
    } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
    }
    };

    // ─── Next Customer (One-click Efficiency) ────────────────
    const nextCustomer = async (req, res) => {
    try {
    const shop = await Shop.findOne({ ownerId: req.user.id });
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    // 1. Find the current 'in_progress' or oldest 'confirmed' booking
    const currentBooking = await Booking.findOne({
      shopId: shop._id,
      serviceType: 'barber',
      status: { $in: ['in_progress', 'confirmed'] }
    }).sort({ 'barberData.queueNumber': 1 });

    if (!currentBooking) {
      return res.status(404).json({ message: 'No active bookings in queue' });
    }

    // 2. Mark current as completed
    currentBooking.status = 'completed';
    await currentBooking.save();

    // 3. Update shop queue count
    if (shop.currentQueue > 0) {
      shop.currentQueue -= 1;
      await shop.save();
    }

    // 4. Notify new queue positions
    await notifyQueuePositions(shop._id);

    // 5. Auto-confirm/notify the NEXT person if they exist
    const nextInLine = await Booking.findOne({
      shopId: shop._id,
      serviceType: 'barber',
      status: 'pending'
    }).sort({ 'barberData.queueNumber': 1 });

    if (nextInLine) {
      nextInLine.status = 'confirmed';
      await nextInLine.save();
      await notifyUser(nextInLine.userId, '🔔 You are Next!', `The barber is ready for you at ${shop.shopName}!`);
    }

    res.status(200).json({
      success: true,
      message: 'Queue advanced. Next customer notified.',
      completedBooking: currentBooking._id,
      nextBooking: nextInLine ? nextInLine._id : null
    });
    } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
    }
    };

    // ─── Get Provider Stats (Analytics) ──────────────────────
    const getProviderStats = async (req, res) => {
    try {
    const shop = await Shop.findOne({ ownerId: req.user.id });
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const totalBookings = await Booking.countDocuments({ shopId: shop._id });
    const completedBookings = await Booking.countDocuments({ shopId: shop._id, status: 'completed' });

    // Calculate Total Revenue
    const bookings = await Booking.find({ shopId: shop._id, status: 'completed' });
    let totalRevenue = 0;
    bookings.forEach(b => {
      if (b.serviceType === 'barber') totalRevenue += b.barberData.price || 0;
      else if (['food', 'hardware'].includes(b.serviceType)) totalRevenue += b.orderData.totalAmount || 0;
      else if (b.serviceType === 'electrician') totalRevenue += b.electricianData.visitCharge || 0;
      else if (b.serviceType === 'plumber') totalRevenue += b.plumberData.estimatedCost || 0;
    });

    // Popular Services (Top 3)
    const popularServices = await Booking.aggregate([
      { $match: { shopId: shop._id } },
      { $group: { _id: '$barberData.serviceName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalBookings,
        completedBookings,
        totalRevenue,
        popularServices
      }
    });
    } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
    }
    };

    module.exports = {
    createBooking, getMyBookings, getShopBookings,
    updateBookingStatus, cancelBooking, markArrived,
    getBookingProgress, nextCustomer, getProviderStats
    };