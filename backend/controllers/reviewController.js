const Review = require('../models/Review');
const Shop = require('../models/Shop');
const Booking = require('../models/Booking');
const { notifyProvider } = require('../utils/notifications');
const mongoose = require('mongoose');

// @route  POST /api/reviews
// @access Private (customer)
const addReview = async (req, res) => {
  try {
    const { shopId, rating, comment } = req.body;

    // 1. Production Rule: Only verified customers can leave a review
    const hasCompletedBooking = await Booking.findOne({
      userId: req.user.id,
      shopId,
      status: 'completed'
    });

    if (!hasCompletedBooking) {
      return res.status(403).json({ 
        message: 'You can only review a shop after you have a completed booking with them.' 
      });
    }

    // 2. Check if already reviewed
    const existing = await Review.findOne({
      userId: req.user.id,
      shopId
    });

    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this shop' });
    }

    const review = await Review.create({
      userId: req.user.id,
      shopId,
      rating,
      comment
    });

    // Update shop rating using aggregation (more efficient)
    const stats = await Review.aggregate([
      { $match: { shopId: review.shopId } },
      {
        $group: {
          _id: '$shopId',
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      const updatedShop = await Shop.findByIdAndUpdate(shopId, {
        rating: stats[0].avgRating.toFixed(1),
        totalReviews: stats[0].totalReviews
      }, { new: true });

      // Notify provider
      if (updatedShop) {
        await notifyProvider(
          updatedShop.ownerId,
          '⭐ New Review!',
          `Someone left a ${rating}-star review for "${updatedShop.shopName}".`,
          { screen: 'Dashboard', type: 'review' }
        );
      }
    }

    res.status(201).json({ success: true, message: 'Review added!', review });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  GET /api/reviews/:shopId
// @access Public
const getShopReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ shopId: req.params.shopId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: reviews.length, reviews });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  DELETE /api/reviews/:id
// @access Private (admin)
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const shopId = review.shopId;
    await Review.findByIdAndDelete(req.params.id);

    // Recalculate rating
    await recalculateShopRating(shopId);

    res.status(200).json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper to update shop rating
const recalculateShopRating = async (shopId) => {
  const stats = await Review.aggregate([
    { $match: { shopId: new mongoose.Types.ObjectId(shopId) } },
    {
      $group: {
        _id: '$shopId',
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await Shop.findByIdAndUpdate(shopId, {
      rating: stats[0].avgRating.toFixed(1),
      totalReviews: stats[0].totalReviews
    });
  } else {
    await Shop.findByIdAndUpdate(shopId, { rating: 0, totalReviews: 0 });
  }
};

// @route  GET /api/reviews/admin/all
// @access Private (admin)
const getAllReviewsAdmin = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('userId', 'name email')
      .populate('shopId', 'shopName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { addReview, getShopReviews, deleteReview, getAllReviewsAdmin };