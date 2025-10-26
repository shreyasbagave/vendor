const express = require('express');
const { body, validationResult, query } = require('express-validator');
const OutwardStock = require('../models/OutwardStock');
const Item = require('../models/Item');
const Customer = require('../models/Customer');
const { protect, authorize, logActivity } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all outward stock entries
// @route   GET /api/outward
// @access  Private
router.get('/', [
  protect,
  authorize('admin'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('customer').optional().isMongoId().withMessage('Customer must be a valid ID'),
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
    
    if (req.query.customer) {
      filter.customer = req.query.customer;
    }
    
    if (req.query.item) {
      filter.item = req.query.item;
    }

    // Add user filter to only show entries created by the authenticated user
    filter.createdBy = req.user._id;

    const outwardEntries = await OutwardStock.find(filter)
      .populate('customer', 'name contactPerson email phone')
      .populate('item', 'name category unit currentStock')
      .populate('createdBy', 'name email')
      .sort({ date: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const total = await OutwardStock.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: outwardEntries.length,
      total,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: outwardEntries
    });
  } catch (error) {
    console.error('Get outward entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single outward stock entry
// @route   GET /api/outward/:id
// @access  Private
router.get('/:id', [protect, authorize('admin')], async (req, res) => {
  try {
    const outwardEntry = await OutwardStock.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    })
      .populate('customer', 'name contactPerson email phone address gstNumber')
      .populate('item', 'name category unit currentStock')
      .populate('createdBy', 'name email');

    if (!outwardEntry) {
      return res.status(404).json({
        success: false,
        message: 'Outward stock entry not found'
      });
    }

    res.status(200).json({
      success: true,
      data: outwardEntry
    });
  } catch (error) {
    console.error('Get outward entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create new outward stock entry
// @route   POST /api/outward
// @access  Private
router.post('/', [
  protect,
  authorize('admin'),
  body('challanNo').notEmpty().trim().withMessage('Challan number is required'),
  body('customer').isMongoId().withMessage('Valid customer is required'),
  body('item').isMongoId().withMessage('Valid item is required'),
  body('okQty').isFloat({ min: 0 }).withMessage('OK quantity must be non-negative'),
  body('crQty').optional().isFloat({ min: 0 }).withMessage('CR quantity must be non-negative'),
  body('mrQty').optional().isFloat({ min: 0 }).withMessage('MR quantity must be non-negative'),
  body('asCastQty').optional().isFloat({ min: 0 }).withMessage('As Cast quantity must be non-negative'),
  // unit removed
  // rate removed
  body('date').optional().isISO8601().withMessage('Date must be valid')
], logActivity('OUTWARD_CREATE', 'OutwardStock', (req, data) => data.data._id), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Validate customer exists
    const customer = await Customer.findById(req.body.customer);
    if (!customer || !customer.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive customer'
      });
    }

    // Validate item exists and check stock
    const item = await Item.findById(req.body.item);
    if (!item || !item.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive item'
      });
    }

    // Calculate total quantity
    const totalQty = (req.body.okQty || 0) + (req.body.crQty || 0) + (req.body.mrQty || 0) + (req.body.asCastQty || 0);

    if (totalQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total quantity must be greater than 0'
      });
    }

    // Check stock availability
    if (item.currentStock < totalQty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${item.currentStock}, Required: ${totalQty}`
      });
    }

    // Check for duplicate challan number for the same customer
    const existingEntry = await OutwardStock.findOne({
      challanNo: req.body.challanNo,
      customer: req.body.customer
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Challan number already exists for this customer'
      });
    }

    const outwardData = {
      ...req.body,
      totalQty,
      createdBy: req.user._id
    };

    const outwardEntry = await OutwardStock.create(outwardData);

    await outwardEntry.populate([
      { path: 'customer', select: 'name contactPerson email phone' },
      { path: 'item', select: 'name category unit currentStock' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Outward stock entry created successfully',
      data: outwardEntry
    });
  } catch (error) {
    console.error('Create outward entry error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Challan number already exists for this customer'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update outward stock entry
// @route   PUT /api/outward/:id
// @access  Private
router.put('/:id', [
  protect,
  authorize('admin'),
  body('challanNo').optional().notEmpty().trim().withMessage('Challan number cannot be empty'),
  body('customer').optional().isMongoId().withMessage('Valid customer is required'),
  body('item').optional().isMongoId().withMessage('Valid item is required'),
  body('okQty').optional().isFloat({ min: 0 }).withMessage('OK quantity must be non-negative'),
  body('crQty').optional().isFloat({ min: 0 }).withMessage('CR quantity must be non-negative'),
  body('mrQty').optional().isFloat({ min: 0 }).withMessage('MR quantity must be non-negative'),
  body('asCastQty').optional().isFloat({ min: 0 }).withMessage('As Cast quantity must be non-negative'),
  // unit removed
  // rate removed
], logActivity('OUTWARD_UPDATE', 'OutwardStock'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const outwardEntry = await OutwardStock.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!outwardEntry) {
      return res.status(404).json({
        success: false,
        message: 'Outward stock entry not found'
      });
    }

    // If updating customer or challan number, check for duplicates
    if (req.body.customer || req.body.challanNo) {
      const customerId = req.body.customer || outwardEntry.customer;
      const challanNo = req.body.challanNo || outwardEntry.challanNo;
      
      const existingEntry = await OutwardStock.findOne({
        _id: { $ne: req.params.id },
        challanNo,
        customer: customerId,
        createdBy: req.user._id
      });

      if (existingEntry) {
        return res.status(400).json({
          success: false,
          message: 'Challan number already exists for this customer'
        });
      }
    }

    // If updating quantities, validate stock availability
    if (req.body.okQty !== undefined || req.body.crQty !== undefined || 
        req.body.mrQty !== undefined || req.body.asCastQty !== undefined) {
      
      const okQty = req.body.okQty !== undefined ? req.body.okQty : outwardEntry.okQty;
      const crQty = req.body.crQty !== undefined ? req.body.crQty : outwardEntry.crQty;
      const mrQty = req.body.mrQty !== undefined ? req.body.mrQty : outwardEntry.mrQty;
      const asCastQty = req.body.asCastQty !== undefined ? req.body.asCastQty : outwardEntry.asCastQty;
      
      const newTotalQty = okQty + crQty + mrQty + asCastQty;
      
      if (newTotalQty <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Total quantity must be greater than 0'
        });
      }

      // Check stock availability (considering the current entry will be updated)
      const itemId = req.body.item || outwardEntry.item;
      const item = await Item.findById(itemId);
      
      if (!item || !item.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive item'
        });
      }

      // Calculate available stock (current stock + old quantity - new quantity)
      const availableStock = item.currentStock + outwardEntry.totalQty - newTotalQty;
      
      if (availableStock < 0) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available after adjustment: ${availableStock}`
        });
      }
    }

    const updatedEntry = await OutwardStock.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'customer', select: 'name contactPerson email phone' },
      { path: 'item', select: 'name category unit currentStock' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Outward stock entry updated successfully',
      data: updatedEntry
    });
  } catch (error) {
    console.error('Update outward entry error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Challan number already exists for this customer'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete outward stock entry
// @route   DELETE /api/outward/:id
// @access  Private
router.delete('/:id', [
  protect,
  authorize('admin')
], logActivity('OUTWARD_DELETE', 'OutwardStock'), async (req, res) => {
  try {
    const outwardEntry = await OutwardStock.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!outwardEntry) {
      return res.status(404).json({
        success: false,
        message: 'Outward stock entry not found'
      });
    }

    await OutwardStock.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Outward stock entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete outward entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get outward stock summary
// @route   GET /api/outward/summary
// @access  Private
router.get('/summary', [
  protect,
  authorize('admin'),
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

    const summary = await OutwardStock.aggregate([
      { $match: { ...dateFilter, createdBy: req.user._id } },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalQuantity: { $sum: '$totalQty' },
          totalOkQty: { $sum: '$okQty' },
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalAsCastQty: { $sum: '$asCastQty' },
          totalAmount: { $sum: '$totalAmount' },
          averageQuantity: { $avg: '$totalQty' },
          averageAmount: { $avg: '$totalAmount' }
        }
      }
    ]);

    const customerSummary = await OutwardStock.aggregate([
      { $match: { ...dateFilter, createdBy: req.user._id } },
      {
        $group: {
          _id: '$customer',
          totalEntries: { $sum: 1 },
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
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $project: {
          customerName: '$customer.name',
          totalEntries: 1,
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

    const itemSummary = await OutwardStock.aggregate([
      { $match: { ...dateFilter, createdBy: req.user._id } },
      {
        $group: {
          _id: '$item',
          totalEntries: { $sum: 1 },
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
          itemCategory: '$item.category',
          totalEntries: 1,
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
        overall: summary[0] || {
          totalEntries: 0,
          totalQuantity: 0,
          totalOkQty: 0,
          totalCrQty: 0,
          totalMrQty: 0,
          totalAsCastQty: 0,
          totalAmount: 0,
          averageQuantity: 0,
          averageAmount: 0
        },
        topCustomers: customerSummary,
        topItems: itemSummary
      }
    });
  } catch (error) {
    console.error('Get outward summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get CR/MR alerts (items with high rejection rates)
// @route   GET /api/outward/alerts/rejects
// @access  Private
router.get('/alerts/rejects', [protect, authorize('admin')], async (req, res) => {
  try {
    const rejectAlerts = await OutwardStock.aggregate([
      {
        $group: {
          _id: '$item',
          totalQuantity: { $sum: '$totalQty' },
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalRejects: { $sum: { $add: ['$crQty', '$mrQty'] } },
          recentRejects: {
            $sum: {
              $cond: [
                { $gte: ['$date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                { $add: ['$crQty', '$mrQty'] },
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          rejectionRate: {
            $cond: [
              { $gt: ['$totalQuantity', 0] },
              { $multiply: [{ $divide: ['$totalRejects', '$totalQuantity'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $match: {
          $or: [
            { rejectionRate: { $gte: 10 } }, // 10% or higher rejection rate
            { recentRejects: { $gt: 0 } } // Any recent rejects
          ]
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
          totalQuantity: 1,
          totalCrQty: 1,
          totalMrQty: 1,
          totalRejects: 1,
          recentRejects: 1,
          rejectionRate: { $round: ['$rejectionRate', 2] }
        }
      },
      { $sort: { rejectionRate: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: rejectAlerts.length,
      data: rejectAlerts
    });
  } catch (error) {
    console.error('Get reject alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
