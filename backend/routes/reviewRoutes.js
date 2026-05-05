const express = require('express');
const router = express.Router();
const { addReview, getShopReviews, getAllReviewsAdmin, deleteReview } = require('../controllers/reviewController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/', protect, authorizeRoles('customer'), addReview);
router.get('/:shopId', getShopReviews);

// Admin routes
router.get('/admin/all', protect, authorizeRoles('admin'), getAllReviewsAdmin);
router.delete('/:id', protect, authorizeRoles('admin'), deleteReview);

module.exports = router;