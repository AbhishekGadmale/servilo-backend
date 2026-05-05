const Staff = require('../models/Staff');
const Shop = require('../models/Shop');

// @route   GET /api/staff/:shopId
// @access  Public
const getShopStaff = async (req, res) => {
  try {
    const staff = await Staff.find({ shopId: req.params.shopId, isAvailable: true });
    res.status(200).json({ success: true, count: staff.length, staff });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/staff
// @access  Private (Provider only)
const addStaff = async (req, res) => {
  try {
    const { name, specialization, photo } = req.body;
    
    // Find shop owned by this provider
    const shop = await Shop.findOne({ ownerId: req.user.id });
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found for this provider' });
    }

    const member = await Staff.create({
      shopId: shop._id,
      name,
      specialization,
      photo
    });

    res.status(201).json({ success: true, member });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   PUT /api/staff/:id
// @access  Private (Provider only)
const updateStaff = async (req, res) => {
  try {
    const { name, specialization, photo, isAvailable } = req.body;
    
    const member = await Staff.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Staff member not found' });

    // Verify ownership via shop
    const shop = await Shop.findById(member.shopId);
    if (shop.ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updatedMember = await Staff.findByIdAndUpdate(
      req.params.id,
      { name, specialization, photo, isAvailable },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, member: updatedMember });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   DELETE /api/staff/:id
// @access  Private (Provider only)
const deleteStaff = async (req, res) => {
  try {
    const member = await Staff.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Staff member not found' });

    const shop = await Shop.findById(member.shopId);
    if (shop.ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await member.deleteOne();
    res.status(200).json({ success: true, message: 'Staff member removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getShopStaff, addStaff, updateStaff, deleteStaff };
