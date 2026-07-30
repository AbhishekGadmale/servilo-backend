const Staff = require('../models/Staff');
const Shop = require('../models/Shop');

const { getCache, setCache, clearCache } = require('../utils/cacheHelper');

// @route   GET /api/staff/:shopId
// @access  Public
const getShopStaff = async (req, res) => {
  try {
    const cacheKey = `shop:staff:${req.params.shopId}`;
    const cachedStaff = await getCache(cacheKey);
    if (cachedStaff) {
      return res.status(200).json({ success: true, count: cachedStaff.length, staff: cachedStaff });
    }

    const staff = await Staff.find({ shopId: req.params.shopId, isAvailable: true }).lean();
    
    await setCache(cacheKey, staff, 1800); // Cache for 30 minutes
    
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

    await clearCache(`shop:staff:${shop._id}`);

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

    await clearCache(`shop:staff:${shop._id}`);

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
    await clearCache(`shop:staff:${shop._id}`);
    res.status(200).json({ success: true, message: 'Staff member removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getShopStaff, addStaff, updateStaff, deleteStaff };
