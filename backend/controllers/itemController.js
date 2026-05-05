const Shop = require('../models/Shop');

// Helper: determine item array key based on category
const getItemKey = (category) => {
  return category === 'food' ? 'menuItems' : 'services';
};

// @route  GET /api/shops/:id/items
// @access Public
const getItems = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const itemKey = getItemKey(shop.category);
    res.status(200).json({
      success: true,
      category: shop.category,
      itemKey,
      items: shop[itemKey]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  POST /api/shops/:id/items
// @access Private (provider)
const addItem = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    // Verify ownership
    if (shop.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const itemKey = getItemKey(shop.category);
    const newItem = buildItem(shop.category, req.body);

    shop[itemKey].push(newItem);
    await shop.save();

    const addedItem = shop[itemKey][shop[itemKey].length - 1];

    res.status(201).json({
      success: true,
      message: 'Item added successfully!',
      item: addedItem
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  PUT /api/shops/:id/items/:itemId
// @access Private (provider)
const updateItem = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    if (shop.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const itemKey = getItemKey(shop.category);
    const itemIndex = shop[itemKey].findIndex(
      item => item._id.toString() === req.params.itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Update only provided fields
    const existingItem = shop[itemKey][itemIndex].toObject();
    const updateFields = buildItem(shop.category, req.body, true);

    shop[itemKey][itemIndex] = {
      ...existingItem,
      ...updateFields
    };

    await shop.save();

    res.status(200).json({
      success: true,
      message: 'Item updated!',
      item: shop[itemKey][itemIndex]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route  DELETE /api/shops/:id/items/:itemId
// @access Private (provider)
const deleteItem = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    if (shop.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const itemKey = getItemKey(shop.category);
    shop[itemKey] = shop[itemKey].filter(
      item => item._id.toString() !== req.params.itemId
    );

    await shop.save();

    res.status(200).json({ success: true, message: 'Item deleted!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper: build item object based on category
const buildItem = (category, data, isUpdate = false) => {
  const item = {};

  if (data.name) item.name = data.name;
  if (data.price !== undefined) item.price = parseFloat(data.price);
  if (data.image !== undefined) item.image = data.image;

  if (category === 'food') {
    if (data.inStock !== undefined) item.inStock = data.inStock;
    else if (!isUpdate) item.inStock = true;
  } else {
    if (data.duration !== undefined) item.duration = parseInt(data.duration);
    else if (!isUpdate) item.duration = 30;
  }

  return item;
};

module.exports = { getItems, addItem, updateItem, deleteItem };