const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const {
  createShop, getAllShops, getShopById,
  updateShop, toggleShopStatus, getMyShop,
  getAllShopsAdmin, approveShop, deleteShop
} = require('../controllers/shopController');
const itemController = require('../controllers/itemController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// ── Reusable validation error handler ──────────────────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array({ onlyFirstError: true })[0];
    return res.status(400).json({
      success: false,
      message: firstError.msg
    });
  }
  next();
};

// Public
router.get('/', getAllShops);
router.get('/:id', getShopById);

// Provider
router.post('/create',
  protect,
  authorizeRoles('provider', 'admin'),
  [
    body('shopName').trim().not().isEmpty().withMessage('Shop name is required'),
    body('category').not().isEmpty().withMessage('Category is required'),
    body('address').not().isEmpty().withMessage('Address is required'),
    body('phone').not().isEmpty().withMessage('Phone is required'),
  ],
  handleValidation,
  createShop
);

router.get('/provider/my-shop', protect, authorizeRoles('provider', 'admin'), getMyShop);

router.put('/:id',
  protect,
  authorizeRoles('provider', 'admin'),
  [
    body('shopName').optional().trim().not().isEmpty().withMessage('Shop name cannot be empty'),
    body('phone').optional().not().isEmpty().withMessage('Phone cannot be empty'),
  ],
  handleValidation,
  updateShop
);

router.put('/:id/toggle-status', protect, authorizeRoles('provider', 'admin'), toggleShopStatus);

// Item/Service Management
router.get('/:id/items', itemController.getItems);
router.post('/:id/items', protect, authorizeRoles('provider', 'admin'), itemController.addItem);
router.put('/:id/items/:itemId', protect, authorizeRoles('provider', 'admin'), itemController.updateItem);
router.delete('/:id/items/:itemId', protect, authorizeRoles('provider', 'admin'), itemController.deleteItem);

// Admin
router.get('/admin/all', protect, authorizeRoles('admin'), getAllShopsAdmin);
router.put('/:id/approve', protect, authorizeRoles('admin'), approveShop);
router.delete('/:id', protect, authorizeRoles('admin'), deleteShop);

module.exports = router;