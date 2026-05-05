const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Public route to get all active categories
router.get('/', getCategories);

// Admin only routes for CRUD
router.post('/', protect, authorizeRoles('admin'), createCategory);
router.put('/:id', protect, authorizeRoles('admin'), updateCategory);
router.delete('/:id', protect, authorizeRoles('admin'), deleteCategory);

module.exports = router;
