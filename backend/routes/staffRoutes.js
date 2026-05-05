const express = require('express');
const router = express.Router();
const { getShopStaff, addStaff, updateStaff, deleteStaff } = require('../controllers/staffController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/:shopId', getShopStaff);
router.post('/', protect, authorizeRoles('provider', 'admin'), addStaff);
router.put('/:id', protect, authorizeRoles('provider', 'admin'), updateStaff);
router.delete('/:id', protect, authorizeRoles('provider', 'admin'), deleteStaff);

module.exports = router;
