const Category = require('../models/Category');

// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({ success: true, count: categories.length, categories });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/categories
// @access  Private (Admin only)
const createCategory = async (req, res) => {
  try {
    const { name, icon, description } = req.body;

    const existing = await Category.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = await Category.create({ name, icon, description });
    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   PUT /api/categories/:id
// @access  Private (Admin only)
const updateCategory = async (req, res) => {
  try {
    const { name, icon, description, isActive } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, icon, description, isActive },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   DELETE /api/categories/:id
// @access  Private (Admin only)
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Optional: Check if any shops are using this category before deleting
    // const Shop = require('../models/Shop');
    // const shopCount = await Shop.countDocuments({ category: category.name });
    // if (shopCount > 0) return res.status(400).json({ message: 'Cannot delete category in use by shops' });

    await category.deleteOne();
    res.status(200).json({ success: true, message: 'Category removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
