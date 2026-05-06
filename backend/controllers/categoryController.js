const Category = require('../models/Category');

// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({ success: true, count: categories.length, categories });
  } catch (error) {
    console.error('Error in getCategories:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/categories
// @access  Private (Admin only)
const createCategory = async (req, res) => {
  try {
    const { name, icon, description } = req.body;
    console.log('Step 1: Received request to create category:', { name, icon });

    if (!name) {
      console.log('Step 2: Validation failed - name missing');
      return res.status(400).json({ message: 'Category name is required' });
    }

    console.log('Step 3: Checking for existing category...');
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      console.log('Step 4: Category already exists:', existing.name);
      return res.status(400).json({ message: 'Category already exists' });
    }

    console.log('Step 5: Generating slug...');
    const slug = name.trim().toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    
    console.log('Step 6: Attempting to create category in DB...');
    const category = await Category.create({ name: name.trim(), slug, icon, description });
    
    console.log('Step 7: Category created successfully:', category._id);
    res.status(201).json({ success: true, category });
  } catch (error) {
    console.error('CRITICAL Error in createCategory:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   PUT /api/categories/:id
// @access  Private (Admin only)
const updateCategory = async (req, res) => {
  try {
    const { name, icon, description, isActive } = req.body;
    const updateData = { icon, description, isActive };
    
    if (name) {
      updateData.name = name.trim();
      updateData.slug = name.trim().toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      
      // Check if name is taken by another category
      const existing = await Category.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ message: 'Category name already taken' });
      }
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ success: true, category });
  } catch (error) {
    console.error('Error in updateCategory:', error);
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

    await category.deleteOne();
    res.status(200).json({ success: true, message: 'Category removed' });
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
