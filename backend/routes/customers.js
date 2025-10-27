const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Customer = require('../models/Customer');
const { protect, authorize, logActivity } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all customers (only for logged-in user)
// @route   GET /api/customers
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

    // Add user filter to only show customers created by the authenticated user
    filter.createdBy = req.user._id;

    const customers = await Customer.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Customer.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: customers.length,
      total,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: customers
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single customer (only user's own)
// @route   GET /api/customers/:id
// @access  Private (Any authenticated user)
router.get('/:id', [protect], async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    })
      .populate('createdBy', 'name email');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create new customer (for logged-in user)
// @route   POST /api/customers
// @access  Private (Any authenticated user)
router.post('/', [
  protect,
  body('name').notEmpty().trim().withMessage('Customer name is required'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('gstNumber').optional().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).withMessage('Please provide a valid GST number'),
  body('panNumber').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Please provide a valid PAN number')
], logActivity('CUSTOMER_CREATE', 'Customer', (req, data) => data.data._id), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const customerData = {
      ...req.body,
      createdBy: req.user._id
    };

    const customer = await Customer.create(customerData);

    await customer.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email or GST number already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update customer (only user's own)
// @route   PUT /api/customers/:id
// @access  Private (Any authenticated user)
router.put('/:id', [
  protect,
  body('name').optional().notEmpty().trim().withMessage('Customer name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('gstNumber').optional().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).withMessage('Please provide a valid GST number'),
  body('panNumber').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Please provide a valid PAN number')
], logActivity('CUSTOMER_UPDATE', 'Customer'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email or GST number already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete customer (only user's own)
// @route   DELETE /api/customers/:id
// @access  Private (Any authenticated user)
router.delete('/:id', [
  protect
], logActivity('CUSTOMER_DELETE', 'Customer'), async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has any transactions
    const OutwardStock = require('../models/OutwardStock');
    const outwardCount = await OutwardStock.countDocuments({ customer: req.params.id });
    
    if (outwardCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing transactions. Deactivate instead.'
      });
    }

    await Customer.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get customer statistics
// @route   GET /api/customers/:id/stats
// @access  Private
router.get('/:id/stats', [protect, authorize('admin')], async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const OutwardStock = require('../models/OutwardStock');
    
    const stats = await OutwardStock.aggregate([
      { $match: { customer: customer._id } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalQuantity: { $sum: '$totalQty' },
          totalOkQty: { $sum: '$okQty' },
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalAsCastQty: { $sum: '$asCastQty' },
          totalAmount: { $sum: '$totalAmount' },
          lastTransaction: { $max: '$date' }
        }
      }
    ]);

    const itemStats = await OutwardStock.aggregate([
      { $match: { customer: customer._id } },
      {
        $group: {
          _id: '$item',
          totalQuantity: { $sum: '$totalQty' },
          totalOkQty: { $sum: '$okQty' },
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalAsCastQty: { $sum: '$asCastQty' },
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
          totalOkQty: 1,
          totalCrQty: 1,
          totalMrQty: 1,
          totalAsCastQty: 1,
          totalAmount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        customer: {
          id: customer._id,
          name: customer.name
        },
        statistics: stats[0] || {
          totalTransactions: 0,
          totalQuantity: 0,
          totalOkQty: 0,
          totalCrQty: 0,
          totalMrQty: 0,
          totalAsCastQty: 0,
          totalAmount: 0,
          lastTransaction: null
        },
        topItems: itemStats
      }
    });
  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
