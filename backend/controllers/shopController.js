const Shop = require('../models/Shop');

// @route  POST /api/shops/create
// @access Private (provider only)
const createShop = async (req, res) => {
  try {
    const {
      shopName, category, description,
      address, phone, services,
      openTime, closeTime, coordinates,
      weeklySchedule
    } = req.body;

    // Default schedule if not provided
    const defaultSchedule = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ].map(day => ({
      day,
      isOpen: true,
      openTime: openTime || '09:00',
      closeTime: closeTime || '21:00'
    }));

    const shop = await Shop.create({
      ownerId: req.user.id,
      shopName,
      category,
      description,
      address,
      phone,
      services,
      openTime,
      closeTime,
      weeklySchedule: weeklySchedule || defaultSchedule,
      location: {
        type: 'Point',
        coordinates: coordinates || [0, 0]
      }
    });

    // Invalidate shops cache
    await clearCache('shops:*');

    res.status(201).json({
      success: true,
      message: 'Shop created! Waiting for admin approval.',
      shop
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  GET /api/shops
// @access Public
// Default radius per service type (in meters)
const SERVICE_RADIUS = {
  barber:      5000,   // 5 km
  food:        5000,   // 5 km
  hardware:    10000,  // 10 km
  electrician: 15000,  // 15 km
  plumber:     15000,  // 15 km
  mechanic:    20000,  // 20 km
  default:     10000   // 10 km fallback
};

// Haversine formula — calculate distance between two coordinates
const getDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const { getCache, setCache, clearCache } = require('../utils/cacheHelper');

// @route  GET /api/shops
// @access Public
const getAllShops = async (req, res) => {
  try {
    const { category, lat, lng, radius, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    let query = { isApproved: true };
    if (category) query.category = category;
    
    // Use text search if available, otherwise fallback to regex
    if (search) {
      query.$text = { $search: search };
    }

    // --- Redis Caching Logic ---
    let cacheKey = `shops:list:page=${page}:limit=${limit}:cat=${category || 'all'}:search=${search || 'none'}`;
    let dynamicRadius = radius ? parseInt(radius) : (SERVICE_RADIUS[category] || SERVICE_RADIUS.default);

    if (lat && lng) {
      // Round lat/lng to 2 decimal places (~1.1km clustering) for cache hits
      cacheKey += `:lat=${parseFloat(lat).toFixed(2)}:lng=${parseFloat(lng).toFixed(2)}:rad=${dynamicRadius}`;
    }

    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      // Attach precise distance for cached location queries dynamically
      if (lat && lng) {
        cachedResponse.shops = cachedResponse.shops.map(shop => {
          const coords = shop.location?.coordinates;
          if (coords) {
            shop.distanceKm = Math.round(getDistanceKm(parseFloat(lat), parseFloat(lng), coords[1], coords[0]) * 10) / 10;
          }
          return shop;
        });
      }
      return res.status(200).json(cachedResponse);
    }
    // ---------------------------

    let shops;
    let total;

    if (lat && lng) {
      // Note: $near logic with limit/skip
      shops = await Shop.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: dynamicRadius
          }
        }
      })
      .select('shopName category isOpen photos rating currentQueue location isApproved')
      .populate('ownerId', 'name phone')
      .skip(skip)
      .limit(limit)
      .lean();

      // Get total count for pagination (using $geoWithin because $near is not supported in countDocuments)
      total = await Shop.countDocuments({
        ...query,
        location: {
          $geoWithin: {
            $centerSphere: [
              [parseFloat(lng), parseFloat(lat)],
              dynamicRadius / 6371000 // Convert meters to radians (6371km radius)
            ]
          }
        }
      });

      // Attach distance in km to each shop
      shops = shops.map(shop => {
        const coords = shop.location?.coordinates;
        if (coords) {
          const distanceKm = getDistanceKm(
            parseFloat(lat), parseFloat(lng),
            coords[1], coords[0]
          );
          shop.distanceKm = Math.round(distanceKm * 10) / 10;
        }
        shop.searchRadiusKm = Math.round(dynamicRadius / 1000);
        return shop;
      });

    } else {
      total = await Shop.countDocuments(query);
      shops = await Shop.find(query)
        .populate('ownerId', 'name phone')
        .sort({ rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const responseData = {
      success: true,
      count: shops.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalShops: total
      },
      shops
    };

    // Cache for 10 minutes (600 seconds) - shops can update their queues often
    await setCache(cacheKey, responseData, 600);

    res.status(200).json(responseData);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  GET /api/shops/:id
// @access Public
const getShopById = async (req, res) => {
  try {
    const cacheKey = `shop:details:${req.params.id}`;
    const cachedShop = await getCache(cacheKey);

    if (cachedShop) {
      return res.status(200).json({ success: true, shop: cachedShop });
    }

    const shop = await Shop.findById(req.params.id)
      .populate('ownerId', 'name phone email')
      .lean();

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Cache for 30 minutes
    await setCache(cacheKey, shop, 1800);

    res.status(200).json({ success: true, shop });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  PUT /api/shops/:id
// @access Private (owner only)
const updateShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check ownership
    if (shop.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const {
      shopName, category, description,
      address, phone, services,
      openTime, closeTime, coordinates,
      weeklySchedule
    } = req.body;

    const updateData = {
      shopName,
      category,
      description,
      address,
      phone,
      services,
      openTime,
      closeTime,
      weeklySchedule
    };

    if (coordinates) {
      updateData.location = {
        type: 'Point',
        coordinates: coordinates
      };
    }

    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );

    // Invalidate caches
    await clearCache(`shop:details:${req.params.id}`);
    await clearCache('shops:*');

    res.status(200).json({ success: true, shop: updatedShop });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  PUT /api/shops/:id/toggle-status
// @access Private (owner only)
const toggleShopStatus = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    if (shop.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    shop.isOpen = !shop.isOpen;
    await shop.save();

    // Invalidate caches
    await clearCache(`shop:details:${req.params.id}`);
    await clearCache('shops:*');

    res.status(200).json({
      success: true,
      message: `Shop is now ${shop.isOpen ? 'Open' : 'Closed'}`,
      isOpen: shop.isOpen
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  GET /api/shops/my-shop
// @access Private (provider only)
const getMyShop = async (req, res) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user.id });

    if (!shop) {
      return res.status(404).json({ message: 'You have not created a shop yet' });
    }

    res.status(200).json({ success: true, shop });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// @route  GET /api/shops/admin/all
// @access Private (admin only)
const getAllShopsAdmin = async (req, res) => {
  try {
    const shops = await Shop.find()
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: shops.length, shops });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const { notifyProvider } = require('../utils/notifications');

// @route  PUT /api/shops/:id/approve
// @access Private (admin only)
const approveShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    shop.isApproved = true;
    await shop.save();

    // Invalidate caches
    await clearCache(`shop:details:${req.params.id}`);
    await clearCache('shops:*');

    // Notify provider
    await notifyProvider(
      shop.ownerId,
      '🎉 Shop Approved!',
      `Congratulations! Your shop "${shop.shopName}" has been approved and is now live.`,
      { screen: 'Dashboard', type: 'approval' }
    );

    res.status(200).json({ success: true, message: 'Shop approved successfully', shop });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  DELETE /api/shops/:id
// @access Private (admin only)
const deleteShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
        return res.status(404).json({ message: 'Shop not found' });
    }
    await shop.deleteOne();

    // Invalidate caches
    await clearCache(`shop:details:${req.params.id}`);
    await clearCache('shops:*');

    res.status(200).json({ success: true, message: 'Shop removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
module.exports = {
  createShop,
  getAllShops,
  getShopById,
  updateShop,
  toggleShopStatus,
  getMyShop,
  getAllShopsAdmin,
  approveShop,
  deleteShop
};