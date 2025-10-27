const express = require('express');
const { body, validationResult, query } = require('express-validator');
const InwardStock = require('../models/InwardStock');
const Item = require('../models/Item');
const Supplier = require('../models/Supplier');
const { protect, authorize, logActivity } = require('../middleware/auth');
const { validateObjectId, validateBodyObjectIds } = require('../middleware/validateObjectId');

const router = express.Router();

// @desc    Get all inward stock entries (only for logged-in user)
// @route   GET /api/inward
// @access  Private (Any authenticated user)
router.get('/', [
  protect,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('supplier').optional().isMongoId().withMessage('Supplier must be a valid ID'),
  query('item').optional().isMongoId().withMessage('Item must be a valid ID')
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
    
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        filter.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.date.$lte = new Date(req.query.endDate);
      }
    }
    
    if (req.query.supplier) {
      filter.supplier = req.query.supplier;
    }
    
    if (req.query.item) {
      filter.item = req.query.item;
    }

    // Add user filter to only show entries created by the authenticated user
    filter.createdBy = req.user._id;

    const inwardEntries = await InwardStock.find(filter)
      .populate('supplier', 'name contactPerson email phone')
      .populate('item', 'name category unit')
      .populate('createdBy', 'name email')
      .sort({ date: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const total = await InwardStock.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: inwardEntries.length,
      total,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: inwardEntries
    });
  } catch (error) {
    console.error('Get inward entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single inward stock entry (only user's own)
// @route   GET /api/inward/:id
// @access  Private (Any authenticated user)
router.get('/:id', [protect], async (req, res) => {
  try {
    const inwardEntry = await InwardStock.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    })
      .populate('supplier', 'name contactPerson email phone address gstNumber')
      .populate('item', 'name category unit currentStock')
      .populate('createdBy', 'name email');

    if (!inwardEntry) {
      return res.status(404).json({
        success: false,
        message: 'Inward stock entry not found'
      });
    }

    res.status(200).json({
      success: true,
      data: inwardEntry
    });
  } catch (error) {
    console.error('Get inward entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create new inward stock entry (for logged-in user)
// @route   POST /api/inward
// @access  Private (Any authenticated user)
router.post('/', [
  protect,
  body('challanNo').notEmpty().trim().withMessage('Challan number is required'),
  body('vehicleNumber').optional().trim().isLength({ max: 20 }).withMessage('Vehicle number cannot exceed 20 characters'),
  body('supplier').notEmpty().withMessage('Supplier is required').isMongoId().withMessage('Invalid supplier ID format'),
  body('item').notEmpty().withMessage('Item is required').isMongoId().withMessage('Invalid item ID format'),
  body('quantityReceived').notEmpty().withMessage('Quantity is required').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0'),
  body('date').optional().isISO8601().withMessage('Date must be valid')
], logActivity('INWARD_CREATE', 'InwardStock', (req, data) => data.data._id), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Please check all required fields',
        errors: errors.array().map(err => ({
          field: err.path || err.param,
          message: err.msg
        }))
      });
    }

    // Validate supplier exists
    const supplier = await Supplier.findById(req.body.supplier);
    if (!supplier || !supplier.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive supplier'
      });
    }

    // Validate item exists
    const item = await Item.findById(req.body.item);
    if (!item || !item.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive item'
      });
    }

    // Check for duplicate challan number for the same supplier
    const existingEntry = await InwardStock.findOne({
      challanNo: req.body.challanNo,
      supplier: req.body.supplier
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Challan number already exists for this supplier'
      });
    }

    const inwardData = {
      ...req.body,
      createdBy: req.user._id
    };

    const inwardEntry = await InwardStock.create(inwardData);

    await inwardEntry.populate([
      { path: 'supplier', select: 'name contactPerson email phone' },
      { path: 'item', select: 'name category unit' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Inward stock entry created successfully',
      data: inwardEntry
    });
  } catch (error) {
    console.error('Create inward entry error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Challan number already exists for this supplier'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update inward stock entry (only user's own)
// @route   PUT /api/inward/:id
// @access  Private (Any authenticated user)
router.put('/:id', [
  protect,
  body('challanNo').optional().notEmpty().trim().withMessage('Challan number cannot be empty'),
  body('vehicleNumber').optional().trim().isLength({ max: 20 }).withMessage('Vehicle number cannot exceed 20 characters'),
  body('supplier').optional().isMongoId().withMessage('Valid supplier is required'),
  body('item').optional().isMongoId().withMessage('Valid item is required'),
  body('quantityReceived').optional().isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0'),
  // unit removed
  // rate removed
], logActivity('INWARD_UPDATE', 'InwardStock'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const inwardEntry = await InwardStock.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!inwardEntry) {
      return res.status(404).json({
        success: false,
        message: 'Inward stock entry not found'
      });
    }

    // If updating supplier or challan number, check for duplicates
    if (req.body.supplier || req.body.challanNo) {
      const supplierId = req.body.supplier || inwardEntry.supplier;
      const challanNo = req.body.challanNo || inwardEntry.challanNo;
      
      const existingEntry = await InwardStock.findOne({
        _id: { $ne: req.params.id },
        challanNo,
        supplier: supplierId,
        createdBy: req.user._id
      });

      if (existingEntry) {
        return res.status(400).json({
          success: false,
          message: 'Challan number already exists for this supplier'
        });
      }
    }

    // If updating item or quantity, validate stock adjustment
    if (req.body.item || req.body.quantityReceived) {
      const newItemId = req.body.item || inwardEntry.item;
      const newQuantity = req.body.quantityReceived || inwardEntry.quantityReceived;
      
      // Check if the new item exists and is active
      const item = await Item.findById(newItemId);
      if (!item || !item.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive item'
        });
      }
    }

    const updatedEntry = await InwardStock.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'supplier', select: 'name contactPerson email phone' },
      { path: 'item', select: 'name category unit' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Inward stock entry updated successfully',
      data: updatedEntry
    });
  } catch (error) {
    console.error('Update inward entry error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Challan number already exists for this supplier'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete inward stock entry (only user's own)
// @route   DELETE /api/inward/:id
// @access  Private (Any authenticated user)
router.delete('/:id', [
  protect
], logActivity('INWARD_DELETE', 'InwardStock'), async (req, res) => {
  try {
    const inwardEntry = await InwardStock.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!inwardEntry) {
      return res.status(404).json({
        success: false,
        message: 'Inward stock entry not found'
      });
    }

    await InwardStock.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Inward stock entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete inward entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get inward stock summary (only user's own)
// @route   GET /api/inward/summary
// @access  Private (Any authenticated user)
router.get('/summary', [
  protect,
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
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

    // Build date filter
    const dateFilter = {};
    if (req.query.startDate || req.query.endDate) {
      dateFilter.date = {};
      if (req.query.startDate) {
        dateFilter.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        dateFilter.date.$lte = new Date(req.query.endDate);
      }
    }

    const summary = await InwardStock.aggregate([
      { $match: { ...dateFilter, createdBy: req.user._id } },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalQuantity: { $sum: '$quantityReceived' },
          totalAmount: { $sum: '$totalAmount' },
          averageQuantity: { $avg: '$quantityReceived' },
          averageAmount: { $avg: '$totalAmount' }
        }
      }
    ]);

    const supplierSummary = await InwardStock.aggregate([
      { $match: { ...dateFilter, createdBy: req.user._id } },
      {
        $group: {
          _id: '$supplier',
          totalEntries: { $sum: 1 },
          totalQuantity: { $sum: '$quantityReceived' },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: '$supplier' },
      {
        $project: {
          supplierName: '$supplier.name',
          totalEntries: 1,
          totalQuantity: 1,
          totalAmount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    const itemSummary = await InwardStock.aggregate([
      { $match: { ...dateFilter, createdBy: req.user._id } },
      {
        $group: {
          _id: '$item',
          totalEntries: { $sum: 1 },
          totalQuantity: { $sum: '$quantityReceived' },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'items',
          localField: '_id',
          foreignField: '_id',
          as: 'item'
        }
      },
      { $unwind: '$item' },
      {
        $project: {
          itemName: '$item.name',
          itemCategory: '$item.category',
          totalEntries: 1,
          totalQuantity: 1,
          totalAmount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overall: summary[0] || {
          totalEntries: 0,
          totalQuantity: 0,
          totalAmount: 0,
          averageQuantity: 0,
          averageAmount: 0
        },
        topSuppliers: supplierSummary,
        topItems: itemSummary
      }
    });
  } catch (error) {
    console.error('Get inward summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
