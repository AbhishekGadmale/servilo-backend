const express = require('express');
const router = express.Router();
const { addReview, getShopReviews } = require('../controllers/reviewController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/', protect, authorizeRoles('customer'), addReview);
router.get('/:shopId', getShopReviews);

module.exports = router;