const express = require('express');
const router = express.Router();
const {
  createShop,
  getAllShops,
  getShopById,
  updateShop,
  toggleShopStatus,
  getMyShop
} = require('../controllers/shopController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllShops);
router.get('/:id', getShopById);

// Private routes
router.post('/create', protect, authorizeRoles('provider', 'admin'), createShop);
router.get('/provider/my-shop', protect, authorizeRoles('provider', 'admin'), getMyShop);
router.put('/:id', protect, authorizeRoles('provider', 'admin'), updateShop);
router.put('/:id/toggle-status', protect, authorizeRoles('provider', 'admin'), toggleShopStatus);

module.exports = router;