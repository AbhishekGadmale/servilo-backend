const express = require('express');
const router = express.Router();
const {
  createShop, getAllShops, getShopById,
  updateShop, toggleShopStatus, getMyShop,
  getAllShopsAdmin, approveShop, deleteShop
} = require('../controllers/shopController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Public
router.get('/', getAllShops);
router.get('/:id', getShopById);

// Provider
router.post('/create', protect, authorizeRoles('provider', 'admin'), createShop);
router.get('/provider/my-shop', protect, authorizeRoles('provider', 'admin'), getMyShop);
router.put('/:id', protect, authorizeRoles('provider', 'admin'), updateShop);
router.put('/:id/toggle-status', protect, authorizeRoles('provider', 'admin'), toggleShopStatus);

// Admin
router.get('/admin/all', protect, authorizeRoles('admin'), getAllShopsAdmin);
router.put('/:id/approve', protect, authorizeRoles('admin'), approveShop);
router.delete('/:id', protect, authorizeRoles('admin'), deleteShop);

module.exports = router;