const Message = require('../models/Message');
const Booking = require('../models/Booking');
const Shop = require('../models/Shop');
const mongoose = require('mongoose');

// @route   GET /api/chat/:id
// @access  Private
const getChatHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, page = 1, limit = 20 } = req.query;

    let messages;
    let isAuthorized = false;
    let query = {};

    if (type === 'booking') {
      const booking = await Booking.findById(id).populate('shopId', 'ownerId');
      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      const isCustomer = booking.userId.toString() === req.user.id;
      const isProvider = booking.shopId.ownerId.toString() === req.user.id;
      if (isCustomer || isProvider || req.user.role === 'admin') isAuthorized = true;

      query = { bookingId: id };
    } else {
      const customerId = req.query.customerId || req.user.id;
      const shop = await Shop.findById(id);
      if (!shop) return res.status(404).json({ message: 'Shop not found' });

      const isCustomer = customerId === req.user.id;
      const isProvider = shop.ownerId.toString() === req.user.id;
      if (isCustomer || isProvider || req.user.role === 'admin') isAuthorized = true;

      query = { 
        shopId: id, 
        bookingId: { $exists: false },
        $or: [{ senderId: customerId }, { receiverId: customerId }]
      };
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to view this chat' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments(query);

    // Populate sender details for all messages
    const populatedMessages = await Message.populate(messages, {
      path: 'senderId',
      select: 'name profileImage'
    });

    // Return newest first for the client (better for inverted FlatList)
    res.status(200).json({ 
      success: true, 
      messages: populatedMessages,
      hasMore: total > skip + messages.length
    });
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

// @route   POST /api/chat/audio
// @access  Private
const uploadChatAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }
    res.status(200).json({
      success: true,
      audioUrl: req.file.path
    });
  } catch (error) {
    res.status(500).json({ message: 'Audio upload failed', error: error.message });
  }
};

// @route   PUT /api/chat/:bookingId/read
// @access  Private
const markMessagesAsRead = async (req, res) => {
  try {
    const { bookingId } = req.params;
    // bookingId can be an ObjectId or an inquiry string
    await Message.updateMany(
      { bookingId, receiverId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/chat/list
// @access  Private
const getChatList = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const isProvider = req.user.role === 'provider';

    const chats = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            shop: '$shopId',
            booking: { $ifNull: ['$bookingId', 'inquiry'] },
            otherUser: {
              $cond: [{ $eq: ['$senderId', userId] }, '$receiverId', '$senderId']
            }
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', userId] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'shops',
          localField: '_id.shop',
          foreignField: '_id',
          as: 'shopDetails'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.otherUser',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $project: {
          _id: 0,
          shopId: '$_id.shop',
          shopName: { $arrayElemAt: ['$shopDetails.shopName', 0] },
          bookingId: {
            $cond: [{ $eq: ['$_id.booking', 'inquiry'] }, null, '$_id.booking']
          },
          lastMessage: 1,
          unreadCount: 1,
          customer: {
            $cond: [
              isProvider,
              { $arrayElemAt: ['$userDetails', 0] },
              null
            ]
          },
          shopOwner: {
            $cond: [
              !isProvider,
              { $arrayElemAt: ['$userDetails', 0] },
              null
            ]
          }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    res.status(200).json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getChatHistory, uploadChatImage, uploadChatAudio, markMessagesAsRead, getChatList };
