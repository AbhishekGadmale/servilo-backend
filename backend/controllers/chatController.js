const Message = require('../models/Message');
const Booking = require('../models/Booking');
const Shop = require('../models/Shop');

// @route   GET /api/chat/:id
// @access  Private
const getChatHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'booking' or 'inquiry'

    let messages;
    let isAuthorized = false;

    if (type === 'booking') {
      const booking = await Booking.findById(id).populate('shopId', 'ownerId');
      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      const isCustomer = booking.userId.toString() === req.user.id;
      const isProvider = booking.shopId.ownerId.toString() === req.user.id;
      if (isCustomer || isProvider || req.user.role === 'admin') isAuthorized = true;

      messages = await Message.find({ bookingId: id }).sort({ createdAt: 1 });
    } else {
      // Inquiry: id is shopId. We also need the user involved.
      // If customer is requesting, we use their id. 
      // If provider is requesting, they must pass the customerId in query.
      const customerId = req.query.customerId || req.user.id;
      
      const shop = await Shop.findById(id);
      if (!shop) return res.status(404).json({ message: 'Shop not found' });

      const isCustomer = customerId === req.user.id;
      const isProvider = shop.ownerId.toString() === req.user.id;
      if (isCustomer || isProvider || req.user.role === 'admin') isAuthorized = true;

      messages = await Message.find({ 
        shopId: id, 
        bookingId: { $exists: false },
        $or: [{ senderId: customerId }, { receiverId: customerId }]
      }).sort({ createdAt: 1 });
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to view this chat' });
    }

    // Populate sender details for all messages
    const populatedMessages = await Message.populate(messages, {
      path: 'senderId',
      select: 'name profileImage'
    });

    res.status(200).json({ success: true, messages: populatedMessages });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/chat/image
// @access  Private
const uploadChatImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }
    res.status(200).json({
      success: true,
      imageUrl: req.file.path
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};

// @route   PUT /api/chat/:bookingId/read
// @access  Private
const markMessagesAsRead = async (req, res) => {
  try {
    const { bookingId } = req.params;
    await Message.updateMany(
      { bookingId, receiverId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getChatHistory, uploadChatImage, markMessagesAsRead };
