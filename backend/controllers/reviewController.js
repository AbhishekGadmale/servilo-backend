const Review = require('../models/Review');
const Shop = require('../models/Shop');

// @route  POST /api/reviews
// @access Private (customer)
const addReview = async (req, res) => {
  try {
    const { shopId, rating, comment } = req.body;

    // Check if already reviewed
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

    // Update shop rating
    const allReviews = await Review.find({ shopId });
    const avgRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;

   await Shop.findByIdAndUpdate(shopId, {
  rating: avgRating.toFixed(1),
  totalReviews: allReviews.length
}, { returnDocument: 'after' });

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

module.exports = { addReview, getShopReviews };