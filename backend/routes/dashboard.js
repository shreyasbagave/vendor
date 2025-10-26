const express = require('express');
const { query, validationResult } = require('express-validator');
const Item = require('../models/Item');
const InwardStock = require('../models/InwardStock');
const OutwardStock = require('../models/OutwardStock');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get dashboard overview data
// @route   GET /api/dashboard/overview
// @access  Private
router.get('/overview', [
  protect,
  authorize('admin'),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030')
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

    const currentDate = new Date();
    const month = parseInt(req.query.month) || currentDate.getMonth() + 1;
    const year = parseInt(req.query.year) || currentDate.getFullYear();

    // Create date range for the specified month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get current month inward summary
    const inwardSummary = await InwardStock.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id
        }
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$quantityReceived' },
          totalAmount: { $sum: '$totalAmount' },
          totalEntries: { $sum: 1 }
        }
      }
    ]);

    // Get current month outward summary
    const outwardSummary = await OutwardStock.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id
        }
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$totalQty' },
          totalOkQty: { $sum: '$okQty' },
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalAsCastQty: { $sum: '$asCastQty' },
          totalAmount: { $sum: '$totalAmount' },
          totalEntries: { $sum: 1 }
        }
      }
    ]);

    // Get current stock balance
    const currentStock = await Item.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
          lowStockItems: {
            $sum: {
              $cond: [
                { $lte: ['$currentStock', '$minimumStock'] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get CR/MR summary for the month
    const crMrSummary = await OutwardStock.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id,
          $or: [
            { crQty: { $gt: 0 } },
            { mrQty: { $gt: 0 } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalRejects: { $sum: { $add: ['$crQty', '$mrQty'] } },
          rejectEntries: { $sum: 1 }
        }
      }
    ]);

    // Get top 5 items by inward quantity this month
    const topInwardItems = await InwardStock.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id
        }
      },
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
          itemCategory: '$item.category',
          totalQuantity: 1,
          totalAmount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]);

    // Get top 5 items by outward quantity this month
    const topOutwardItems = await OutwardStock.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id
        }
      },
      {
        $group: {
          _id: '$item',
          totalQuantity: { $sum: '$totalQty' },
          totalOkQty: { $sum: '$okQty' },
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
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
          totalQuantity: 1,
          totalOkQty: 1,
          totalCrQty: 1,
          totalMrQty: 1,
          totalAmount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]);

    // Get monthly trend data for the last 6 months
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const trendDate = new Date(year, month - 1 - i, 1);
      const trendStartDate = new Date(trendDate.getFullYear(), trendDate.getMonth(), 1);
      const trendEndDate = new Date(trendDate.getFullYear(), trendDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const [inwardTrend, outwardTrend] = await Promise.all([
        InwardStock.aggregate([
          {
            $match: {
              date: { $gte: trendStartDate, $lte: trendEndDate },
              createdBy: req.user._id
            }
          },
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$quantityReceived' },
              totalAmount: { $sum: '$totalAmount' }
            }
          }
        ]),
        OutwardStock.aggregate([
          {
            $match: {
              date: { $gte: trendStartDate, $lte: trendEndDate },
              createdBy: req.user._id
            }
          },
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$totalQty' },
              totalAmount: { $sum: '$totalAmount' }
            }
          }
        ])
      ]);

      trendData.push({
        month: trendDate.getMonth() + 1,
        year: trendDate.getFullYear(),
        monthName: trendDate.toLocaleString('default', { month: 'short' }),
        inward: {
          quantity: inwardTrend[0]?.totalQuantity || 0,
          amount: inwardTrend[0]?.totalAmount || 0
        },
        outward: {
          quantity: outwardTrend[0]?.totalQuantity || 0,
          amount: outwardTrend[0]?.totalAmount || 0
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        period: {
          month,
          year,
          monthName: startDate.toLocaleString('default', { month: 'long' })
        },
        inward: inwardSummary[0] || {
          totalQuantity: 0,
          totalAmount: 0,
          totalEntries: 0
        },
        outward: outwardSummary[0] || {
          totalQuantity: 0,
          totalOkQty: 0,
          totalCrQty: 0,
          totalMrQty: 0,
          totalAsCastQty: 0,
          totalAmount: 0,
          totalEntries: 0
        },
        currentStock: currentStock[0] || {
          totalItems: 0,
          totalStock: 0,
          lowStockItems: 0
        },
        crMrSummary: crMrSummary[0] || {
          totalCrQty: 0,
          totalMrQty: 0,
          totalRejects: 0,
          rejectEntries: 0
        },
        topInwardItems,
        topOutwardItems,
        trendData
      }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get low stock alerts
// @route   GET /api/dashboard/alerts/low-stock
// @access  Private
router.get('/alerts/low-stock', [protect, authorize('admin')], async (req, res) => {
  try {
    const lowStockItems = await Item.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    })
    .select('name category unit currentStock minimumStock')
    .sort({ currentStock: 1 });

    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems
    });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get CR/MR alerts
// @route   GET /api/dashboard/alerts/rejects
// @access  Private
router.get('/alerts/rejects', [protect, authorize('admin')], async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rejectAlerts = await OutwardStock.aggregate([
      {
        $match: {
          date: { $gte: thirtyDaysAgo },
          createdBy: req.user._id,
          $or: [
            { crQty: { $gt: 0 } },
            { mrQty: { $gt: 0 } }
          ]
        }
      },
      {
        $group: {
          _id: '$item',
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalRejects: { $sum: { $add: ['$crQty', '$mrQty'] } },
          rejectEntries: { $sum: 1 },
          lastRejectDate: { $max: '$date' }
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
          totalCrQty: 1,
          totalMrQty: 1,
          totalRejects: 1,
          rejectEntries: 1,
          lastRejectDate: 1
        }
      },
      { $sort: { totalRejects: -1 } },
      { $limit: 10 }
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

// @desc    Get recent activities
// @route   GET /api/dashboard/activities
// @access  Private
router.get('/activities', [
  protect,
  authorize('admin'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
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

    const limit = parseInt(req.query.limit) || 10;

    const ActivityLog = require('../models/ActivityLog');
    
    const activities = await ActivityLog.find()
      .populate('user', 'name email')
      .sort({ createdAt: 1 })
      .limit(limit)
      .select('action entity description createdAt');

    res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
