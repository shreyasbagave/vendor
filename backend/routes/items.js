const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Item = require('../models/Item');
const { protect, authorize, logActivity } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validateObjectId');

const router = express.Router();

// @desc    Get all items (only for logged-in user)
// @route   GET /api/items
// @access  Private (Any authenticated user)
router.get('/', [
  protect,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    if (req.query.category) {
      filter.category = { $regex: req.query.category, $options: 'i' };
    }
    
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    // Add user filter to only show items created by the authenticated user
    filter.createdBy = req.user._id;

    const items = await Item.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Item.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: items.length,
      total,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: items
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single item (only user's own)
// @route   GET /api/items/:id
// @access  Private (Any authenticated user)
router.get('/:id', [protect, validateObjectId()], async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    })
      .populate('createdBy', 'name email');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create new item (for logged-in user)
// @route   POST /api/items
// @access  Private (Any authenticated user)
router.post('/', [
  protect,
  body('name').notEmpty().trim().withMessage('Item name is required'),
  body('category').notEmpty().trim().withMessage('Category is required'),
  // unit removed from application
  body('minimumStock').optional().isFloat({ min: 0 }).withMessage('Minimum stock must be non-negative')
], logActivity('ITEM_CREATE', 'Item', (req, data) => data.data._id), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const itemData = {
      ...req.body,
      createdBy: req.user._id
    };

    const item = await Item.create(itemData);

    await item.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Create item error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Item with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update item (only user's own)
// @route   PUT /api/items/:id
// @access  Private (Any authenticated user)
router.put('/:id', [
  protect,
  validateObjectId(),
  body('name').optional().notEmpty().trim().withMessage('Item name cannot be empty'),
  body('category').optional().notEmpty().trim().withMessage('Category cannot be empty'),
  // unit removed from application
  body('minimumStock').optional().isFloat({ min: 0 }).withMessage('Minimum stock must be non-negative')
], logActivity('ITEM_UPDATE', 'Item'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const item = await Item.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Update item error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Item with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete item (only user's own)
// @route   DELETE /api/items/:id
// @access  Private (Any authenticated user)
router.delete('/:id', [
  protect,
  validateObjectId()
], logActivity('ITEM_DELETE', 'Item'), async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found or you do not have permission to delete it'
      });
    }

    // Check if item has any transactions
    const InwardStock = require('../models/InwardStock');
    const OutwardStock = require('../models/OutwardStock');
    
    const inwardCount = await InwardStock.countDocuments({ item: req.params.id });
    const outwardCount = await OutwardStock.countDocuments({ item: req.params.id });
    
    if (inwardCount > 0 || outwardCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete item with existing transactions. Deactivate instead.'
      });
    }

    await Item.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get item categories (only user's own)
// @route   GET /api/items/categories/list
// @access  Private (Any authenticated user)
router.get('/categories/list', [protect], async (req, res) => {
  try {
    const categories = await Item.distinct('category', { 
      isActive: true,
      createdBy: req.user._id 
    });
    
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get low stock items (only user's own)
// @route   GET /api/items/alerts/low-stock
// @access  Private (Any authenticated user)
router.get('/alerts/low-stock', [protect], async (req, res) => {
  try {
    const lowStockItems = await Item.find({
      isActive: true,
      createdBy: req.user._id,
      minimumStock: { $gt: 0 }, // Only check if user has set a minimum stock
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    }).populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems
    });
  } catch (error) {
    console.error('Get low stock items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Adjust stock for an item (only user's own)
// @route   POST /api/items/:id/adjust
// @access  Private (Any authenticated user)
router.post('/:id/adjust', [
  protect,
  validateObjectId(),
  body('adjustment').notEmpty().withMessage('Adjustment amount is required').isFloat().withMessage('Adjustment must be a valid number'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const item = await Item.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    const adjustment = parseFloat(req.body.adjustment);
    const previousStock = item.currentStock;
    const newStock = previousStock + adjustment;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot adjust stock below 0. Current stock: ${previousStock}, Adjustment: ${adjustment}`
      });
    }

    item.currentStock = newStock;
    await item.save();

    await item.populate('createdBy', 'name email');

    // Log activity with metadata
    try {
      const ActivityLog = require('../models/ActivityLog');
      const adjustmentSign = adjustment >= 0 ? '+' : '';
      const description = `Stock adjusted for ${item.name}: ${previousStock} → ${newStock} (${adjustmentSign}${adjustment})${req.body.reason ? ` - Reason: ${req.body.reason}` : ''}`;
      
      await ActivityLog.logActivity(
        req.user._id,
        'STOCK_ADJUST',
        'Item',
        item._id,
        description,
        req
      );
      
      // Update the log with metadata
      const latestLog = await ActivityLog.findOne({ 
        user: req.user._id, 
        action: 'STOCK_ADJUST',
        entityId: item._id 
      }).sort({ createdAt: -1 });
      
      if (latestLog) {
        latestLog.metadata = {
          itemName: item.name,
          previousStock,
          adjustment,
          newStock,
          reason: req.body.reason || null,
          date: new Date()
        };
        await latestLog.save();
      }
    } catch (logError) {
      console.error('Error logging stock adjustment:', logError);
      // Don't fail the request if logging fails
    }

    res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        item,
        previousStock,
        adjustment,
        newStock: item.currentStock,
        reason: req.body.reason || null
      }
    });
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
