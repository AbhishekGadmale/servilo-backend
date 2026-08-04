const Booking = require('../models/Booking');
const Shop = require('../models/Shop');
const User = require('../models/User');
const Staff = require('../models/Staff');
const { notifyUser, notifyProvider, sendPushNotification } = require('../utils/notifications');
const mongoose = require('mongoose');

// ─── Notify Queue Positions ──────────────────────────────
const notifyQueuePositions = async (shopId, staffId = null) => {
  const query = {
    shopId,
    serviceType: 'barber',
    status: { $in: ['pending', 'confirmed'] }
  };
  
  if (staffId) query.staffId = staffId;
  else query.staffId = { $exists: false };

  const queueBookings = await Booking.find(query)
    .sort({ 'barberData.queueNumber': 1 })
    .populate('userId', 'expoPushToken notificationsEnabled name');

  for (let i = 0; i < queueBookings.length; i++) {
    const position = i + 1;
    const b = queueBookings[i];
    if (!b.userId?.expoPushToken || !b.userId?.notificationsEnabled) continue;

    if (position === 3)
      await sendPushNotification(b.userId.expoPushToken,
        '⏰ Almost Your Turn!', 'You are 3rd in queue. Get ready!', { screen: 'Bookings', type: 'booking' });
    else if (position === 2)
      await sendPushNotification(b.userId.expoPushToken,
        '🔔 Next Up!', 'You are 2nd in queue. Head to the shop!', { screen: 'Bookings', type: 'booking' });
    else if (position === 1)
      await sendPushNotification(b.userId.expoPushToken,
        '✅ Your Turn!', 'You are next! Please proceed.', { screen: 'Bookings', type: 'booking' });
  }
};

// ─── Create Booking ──────────────────────────────────────
const createBooking = async (req, res, next) => {
  try {
    const { shopId, staffId, serviceType, bookingType, isForFriend,
      friendName, friendPhone, barberData, orderData,
      electricianData, plumberData, mechanicData } = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });
    if (!shop.isOpen) return res.status(400).json({ message: 'Shop is currently closed' });

    const now = new Date();
    const dayName = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long'
    }).format(now);

    const currentTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    // Find schedule for today
    const todaySchedule = shop.weeklySchedule?.find(s => s.day === dayName);
    
    let openTime = shop.openTime;
    let closeTime = shop.closeTime;
    let isDayClosed = false;

    if (todaySchedule) {
      if (!todaySchedule.isOpen) isDayClosed = true;
      openTime = todaySchedule.openTime;
      closeTime = todaySchedule.closeTime;
    }

    if (isDayClosed) {
      return res.status(400).json({ message: `Shop is closed today (${dayName})` });
    }

    let isClosed = false;

    if (openTime <= closeTime) {
      // Normal hours: e.g. 09:00 - 21:00
      isClosed = (currentTimeStr < openTime || currentTimeStr > closeTime);
    } else {
      // Overnight hours: e.g. 18:00 - 02:00
      isClosed = (currentTimeStr < openTime && currentTimeStr > closeTime);
    }

    if (isClosed && process.env.NODE_ENV !== 'test') {
      return res.status(400).json({
        message: `Shop is closed. Operating hours today: ${openTime} - ${closeTime}`
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
    let booking;
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (serviceType === 'barber') {
        if (assignedStaffId) {
          // Queue for specific staff - with ownership check
          const staff = await Staff.findOneAndUpdate(
            { _id: assignedStaffId, shopId: shopId },
            { $inc: { currentQueue: 1 } },
            { new: true, session }
          );
          if (!staff) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Staff member not found or does not belong to this shop' });
          }
          
          finalBarberData.queueNumber = staff.currentQueue;
          finalBarberData.estimatedWaitTime = staff.currentQueue * (finalBarberData.duration || shop.averageServiceTime || 30);
        } else {
          // General Shop Queue
          const updatedShop = await Shop.findByIdAndUpdate(
            shopId,
            { $inc: { currentQueue: 1 } },
            { new: true, session }
          );
          finalBarberData.queueNumber = updatedShop.currentQueue;
          finalBarberData.estimatedWaitTime = updatedShop.currentQueue * (finalBarberData.duration || shop.averageServiceTime || 30);
        }
      }

      const bookingList = await Booking.create([{
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
      }], { session });
      
      booking = bookingList[0];
      await session.commitTransaction();
      session.endSession();
    } catch (txnError) {
      await session.abortTransaction();
      session.endSession();
      throw txnError;
    }

    await booking.populate('shopId', 'shopName address phone category ownerId');
    await booking.populate('userId', 'name phone');

    // Notify provider
    const notifMessages = {
      barber: `New queue booking for ${barberData?.serviceName || 'a service'}`,
      food: `New food order! Total: ₹${orderData?.totalAmount || 0}`,
      hardware: `New product order! Total: ₹${orderData?.totalAmount || 0}`,
      electrician: `New electrician request: ${electricianData?.issueType?.replace(/_/g, ' ') || 'issue'}`,
      plumber: `New plumber request: ${plumberData?.issueType?.replace(/_/g, ' ') || 'issue'}`,
      mechanic: `New mechanic request: ${mechanicData?.vehicleType || 'vehicle'} - ${mechanicData?.problemType?.replace(/_/g, ' ') || 'problem'}`
    };
    await notifyProvider(shop.ownerId, '🔔 New Booking!',
      notifMessages[serviceType] || 'New booking received',
      { screen: 'Queue', bookingId: booking._id, type: 'booking' });

    // Emit socket event to update queues and providers in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`shop_${shopId}`).emit('booking_created', { bookingId: booking._id });
      if (serviceType === 'barber') {
        io.to(`shop_${shopId}`).emit('queue_updated', { shopId });
      }
    }

    const { clearCache } = require('../utils/cacheHelper');
    await clearCache(`shop:details:${shopId}`);
    await clearCache('shops:*');

    res.status(201).json({ success: true, message: 'Booking created!', booking });
  } catch (error) {
    next(error);
  }
};

// ─── Get My Bookings ─────────────────────────────────────
const getMyBookings = async (req, res, next) => {
  try {
    const { cursor, limit = 10 } = req.query;
    let query = { userId: req.user.id };
    
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const bookings = await Booking.find(query)
      .populate('shopId', 'shopName address category phone photos ownerId')
      .sort({ _id: -1 })
      .limit(parseInt(limit))
      .lean();

    const hasMore = bookings.length === parseInt(limit);
    const nextCursor = hasMore ? bookings[bookings.length - 1]._id : null;

    res.status(200).json({ success: true, count: bookings.length, bookings, hasMore, nextCursor });
  } catch (error) {
    next(error);
  }
};

// ─── Get Shop Bookings ───────────────────────────────────
const getShopBookings = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user.id });
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const { cursor, limit = 15 } = req.query;
    let query = { shopId: shop._id };
    
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const bookings = await Booking.find(query)
      .populate('userId', 'name phone profileImage')
      .sort({ _id: -1 })
      .limit(parseInt(limit))
      .lean();

    const hasMore = bookings.length === parseInt(limit);
    const nextCursor = hasMore ? bookings[bookings.length - 1]._id : null;

    res.status(200).json({ success: true, count: bookings.length, bookings, hasMore, nextCursor });
  } catch (error) {
    next(error);
  }
};

// ─── Update Booking Status ───────────────────────────────
const updateBookingStatus = async (req, res, next) => {
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

    // ─── Secure Status Transitions ───────────────────────────
    const validTransitions = {
      'pending': ['confirmed', 'rejected', 'cancelled'],
      'confirmed': ['in_progress', 'cancelled', 'completed'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': [],
      'rejected': []
    };

    if (previousStatus !== status && !validTransitions[previousStatus]?.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status transition from ${previousStatus} to ${status}` 
      });
    }

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
      await notifyUser(booking.userId, msgs[status].title, msgs[status].body, {
        screen: 'Bookings',
        bookingId: booking._id,
        type: 'booking'
      });

    // Queue notifications for barber
    const terminalStates = ['completed', 'rejected', 'cancelled'];
    if (booking.serviceType === 'barber' && terminalStates.includes(status) && !terminalStates.includes(previousStatus)) {
      // Atomic decrement shop queue
      await Shop.findOneAndUpdate(
        { _id: booking.shopId, currentQueue: { $gt: 0 } },
        { $inc: { currentQueue: -1 } }
      );

      // Atomic decrement staff queue if assigned
      if (booking.staffId) {
        await Staff.findOneAndUpdate(
          { _id: booking.staffId, currentQueue: { $gt: 0 } },
          { $inc: { currentQueue: -1 } }
        );
      }
      
      await notifyQueuePositions(booking.shopId._id, booking.staffId);
      
      const io = req.app.get('io');
      if (io) {
        io.to(`shop_${booking.shopId._id}`).emit('queue_updated', { shopId: booking.shopId._id });
      }
    }

    const io = req.app.get('io');
    if (io) {
      const payload = { bookingId: booking._id, status: booking.status };
      io.to(`shop_${booking.shopId._id}`).emit('booking_updated', payload);
      const customerUserId = booking.userId?._id || booking.userId;
      io.to(`user_${customerUserId}`).emit('booking_updated', payload);
    }

    if (booking.serviceType === 'barber' && terminalStates.includes(status) && !terminalStates.includes(previousStatus)) {
        const { clearCache } = require('../utils/cacheHelper');
        await clearCache(`shop:details:${booking.shopId._id}`);
        await clearCache('shops:*');
    }

    res.status(200).json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

// ─── Cancel Booking ──────────────────────────────────────
const cancelBooking = async (req, res, next) => {
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

    // Notify provider about customer cancellation
    const shop = await Shop.findById(booking.shopId);
    if (shop) {
      await notifyProvider(
        shop.ownerId,
        '❌ Booking Cancelled',
        `A customer has cancelled their booking for ${booking.serviceType}.`,
        { screen: 'Queue', bookingId: booking._id, type: 'booking' }
      );
    }

    // Queue notifications for barber
    if (booking.serviceType === 'barber') {
      await Shop.findOneAndUpdate(
        { _id: booking.shopId, currentQueue: { $gt: 0 } },
        { $inc: { currentQueue: -1 } }
      );
      if (booking.staffId) {
        await Staff.findOneAndUpdate(
          { _id: booking.staffId, currentQueue: { $gt: 0 } },
          { $inc: { currentQueue: -1 } }
        );
      }
      await notifyQueuePositions(booking.shopId, booking.staffId);
      
      const io = req.app.get('io');
      if (io) {
        io.to(`shop_${booking.shopId}`).emit('queue_updated', { shopId: booking.shopId });
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`shop_${booking.shopId}`).emit('booking_cancelled', booking._id);
      const customerUserId = booking.userId?._id || booking.userId;
      io.to(`user_${customerUserId}`).emit('booking_updated', { bookingId: booking._id, status: booking.status });
    }

    if (booking.serviceType === 'barber') {
        const { clearCache } = require('../utils/cacheHelper');
        await clearCache(`shop:details:${booking.shopId}`);
        await clearCache('shops:*');
    }

    res.status(200).json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    next(error);
  }
};

// ─── Mark Customer Arrived (Barber) ─────────────────────
const markArrived = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.userId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorized' });

    booking.barberData.customerArrived = true;
    await booking.save();

    const shop = await Shop.findById(booking.shopId);
    if (shop) {
      await notifyProvider(
        shop.ownerId,
        '👤 Customer Arriving!',
        `Customer is on their way for queue #${booking.barberData.queueNumber}`,
        { screen: 'Queue', bookingId: booking._id, type: 'booking' }
      );
    }

    res.status(200).json({ success: true, message: 'Marked as arriving!' });
  } catch (error) {
    next(error);
  }
};

// ─── Get Booking Progress (Real-time UX) ────────────────
const getBookingProgress = async (req, res, next) => {
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
      // Calculate current position in queue (staff-specific or global)
      const query = {
        shopId: booking.shopId._id,
        serviceType: 'barber',
        status: { $in: ['pending', 'confirmed'] },
        'barberData.queueNumber': { $lt: booking.barberData.queueNumber }
      };

      if (booking.staffId) query.staffId = booking.staffId;
      else query.staffId = { $exists: false };

      const position = await Booking.countDocuments(query) + 1;

      progressData.queuePosition = position;
      progressData.estimatedWaitTime = position * (booking.barberData.duration || 30);
    }

    res.status(200).json({ success: true, progress: progressData });
  } catch (error) {
    next(error);
  }
};

// ─── Next Customer (One-click Efficiency) ────────────────
const nextCustomer = async (req, res, next) => {
  try {
    const { staffId } = req.body; // Optional: advancement for specific staff
    const shop = await Shop.findOne({ ownerId: req.user.id });
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    // 1. Find the current 'in_progress' or oldest 'confirmed' booking
    const query = {
      shopId: shop._id,
      serviceType: 'barber',
      status: { $in: ['in_progress', 'confirmed'] }
    };
    if (staffId) query.staffId = staffId;
    else query.staffId = { $exists: false };

    const currentBooking = await Booking.findOne(query).sort({ 'barberData.queueNumber': 1 });

    if (!currentBooking) {
      return res.status(404).json({ message: 'No active bookings in queue' });
    }

    // 2. Mark current as completed
    currentBooking.status = 'completed';
    await currentBooking.save();

    // 3. Update shop queue count
    await Shop.findOneAndUpdate(
      { _id: shop._id, currentQueue: { $gt: 0 } },
      { $inc: { currentQueue: -1 } }
    );

    // Decrement staff queue if assigned
    if (currentBooking.staffId) {
      await Staff.findOneAndUpdate(
        { _id: currentBooking.staffId, currentQueue: { $gt: 0 } },
        { $inc: { currentQueue: -1 } }
      );
    }

    // 4. Notify new queue positions
    await notifyQueuePositions(shop._id, currentBooking.staffId);

    // 5. Auto-confirm/notify the NEXT person if they exist
    const nextQuery = {
      shopId: shop._id,
      serviceType: 'barber',
      status: 'pending'
    };
    if (currentBooking.staffId) nextQuery.staffId = currentBooking.staffId;
    else nextQuery.staffId = { $exists: false };

    const nextInLine = await Booking.findOne(nextQuery).sort({ 'barberData.queueNumber': 1 });

    if (nextInLine) {
      nextInLine.status = 'confirmed';
      await nextInLine.save();
      await notifyUser(nextInLine.userId, '🔔 You are Next!', `The barber is ready for you at ${shop.shopName}!`, {
        screen: 'Bookings',
        bookingId: nextInLine._id,
        type: 'booking'
      });
    }

    const { clearCache } = require('../utils/cacheHelper');
    await clearCache(`shop:details:${shop._id}`);
    await clearCache('shops:*');

    res.status(200).json({
      success: true,
      message: 'Queue advanced. Next customer notified.',
      completedBooking: currentBooking._id,
      nextBooking: nextInLine ? nextInLine._id : null
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Provider Stats (Analytics) ──────────────────────
const getProviderStats = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user.id });
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const shopId = shop._id;

    // Use Aggregation for all stats in parallel
    const [stats, popularServices] = await Promise.all([
      Booking.aggregate([
        { $match: { shopId: shopId } },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            completedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  {
                    $add: [
                      { $ifNull: ['$barberData.price', 0] },
                      { $ifNull: ['$orderData.totalAmount', 0] },
                      { $ifNull: ['$electricianData.visitCharge', 0] },
                      { $ifNull: ['$plumberData.estimatedCost', 0] }
                    ]
                  },
                  0
                ]
              }
            }
          }
        }
      ]),
      Booking.aggregate([
        { $match: { shopId: shopId } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$serviceType', 'barber'] }, '$barberData.serviceName',
                {
                  $cond: [
                    { $eq: ['$serviceType', 'electrician'] }, '$electricianData.issueType',
                    {
                      $cond: [
                        { $eq: ['$serviceType', 'plumber'] }, '$plumberData.issueType',
                        {
                          $cond: [
                            { $eq: ['$serviceType', 'mechanic'] }, '$mechanicData.problemType',
                            'Other'
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 3 }
      ])
    ]);

    const finalStats = stats[0] || {
      totalBookings: 0,
      completedBookings: 0,
      totalRevenue: 0
    };

    res.status(200).json({
      success: true,
      stats: {
        totalBookings: finalStats.totalBookings,
        completedBookings: finalStats.completedBookings,
        totalRevenue: finalStats.totalRevenue,
        popularServices
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking, getMyBookings, getShopBookings,
  updateBookingStatus, cancelBooking, markArrived,
  getBookingProgress, nextCustomer, getProviderStats
};