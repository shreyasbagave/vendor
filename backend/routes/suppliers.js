const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Supplier = require('../models/Supplier');
const { protect, authorize, logActivity } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all suppliers (only for logged-in user)
// @route   GET /api/suppliers
// @access  Private (Any authenticated user)
router.get('/', [
  protect,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
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
        { contactPerson: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
        { gstNumber: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    // Add user filter to only show suppliers created by the authenticated user
    filter.createdBy = req.user._id;

    const suppliers = await Supplier.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Supplier.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: suppliers.length,
      total,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: suppliers
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single supplier (only user's own)
// @route   GET /api/suppliers/:id
// @access  Private (Any authenticated user)
router.get('/:id', [protect], async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    })
      .populate('createdBy', 'name email');

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create new supplier (for logged-in user)
// @route   POST /api/suppliers
// @access  Private (Any authenticated user)
router.post('/', [
  protect,
  body('name').notEmpty().trim().withMessage('Supplier name is required'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('gstNumber').optional().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).withMessage('Please provide a valid GST number'),
  body('panNumber').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Please provide a valid PAN number')
], logActivity('SUPPLIER_CREATE', 'Supplier', (req, data) => data.data._id), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const supplierData = {
      ...req.body,
      createdBy: req.user._id
    };

    const supplier = await Supplier.create(supplierData);

    await supplier.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Supplier with this email or GST number already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update supplier (only user's own)
// @route   PUT /api/suppliers/:id
// @access  Private (Any authenticated user)
router.put('/:id', [
  protect,
  body('name').optional().notEmpty().trim().withMessage('Supplier name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('gstNumber').optional().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).withMessage('Please provide a valid GST number'),
  body('panNumber').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Please provide a valid PAN number')
], logActivity('SUPPLIER_UPDATE', 'Supplier'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: updatedSupplier
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Supplier with this email or GST number already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete supplier (only user's own)
// @route   DELETE /api/suppliers/:id
// @access  Private (Any authenticated user)
router.delete('/:id', [
  protect
], logActivity('SUPPLIER_DELETE', 'Supplier'), async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Check if supplier has any transactions
    const InwardStock = require('../models/InwardStock');
    const inwardCount = await InwardStock.countDocuments({ supplier: req.params.id });
    
    if (inwardCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete supplier with existing transactions. Deactivate instead.'
      });
    }

    await Supplier.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get supplier statistics
// @route   GET /api/suppliers/:id/stats
// @access  Private
router.get('/:id/stats', [protect, authorize('admin')], async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const InwardStock = require('../models/InwardStock');
    
    const stats = await InwardStock.aggregate([
      { $match: { supplier: supplier._id } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalQuantity: { $sum: '$quantityReceived' },
          totalAmount: { $sum: '$totalAmount' },
          lastTransaction: { $max: '$date' }
        }
      }
    ]);

    const itemStats = await InwardStock.aggregate([
      { $match: { supplier: supplier._id } },
      {
        $group: {
          _id: '$item',
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
        supplier: {
          id: supplier._id,
          name: supplier.name
        },
        statistics: stats[0] || {
          totalTransactions: 0,
          totalQuantity: 0,
          totalAmount: 0,
          lastTransaction: null
        },
        topItems: itemStats
      }
    });
  } catch (error) {
    console.error('Get supplier stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
