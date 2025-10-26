const express = require('express');
const { query, validationResult, body } = require('express-validator');
const ActivityLog = require('../models/ActivityLog');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get activity logs
// @route   GET /api/logs
// @access  Private
router.get('/', [
  protect,
  authorize('admin'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('action').optional().isString().withMessage('Action must be a string'),
  query('entity').optional().isString().withMessage('Entity must be a string'),
  query('userId').optional().isMongoId().withMessage('User ID must be a valid ID')
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
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }
    
    if (req.query.action) {
      filter.action = { $regex: req.query.action, $options: 'i' };
    }
    
    if (req.query.entity) {
      filter.entity = req.query.entity;
    }
    
    if (req.query.userId) {
      filter.user = req.query.userId;
    }

    const logs = await ActivityLog.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .select('action entity entityId description ipAddress userAgent metadata createdAt user');

    const total = await ActivityLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: logs
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get activity log statistics
// @route   GET /api/logs/statistics
// @access  Private
router.get('/statistics', [
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
      dateFilter.createdAt = {};
      if (req.query.startDate) {
        dateFilter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        dateFilter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    // Get overall statistics
    const overallStats = await ActivityLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' }
        }
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      }
    ]);

    // Get action-wise statistics
    const actionStats = await ActivityLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get entity-wise statistics
    const entityStats = await ActivityLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$entity',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get user-wise statistics
    const userStats = await ActivityLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          userName: '$user.name',
          userEmail: '$user.email',
          count: 1,
          lastActivity: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get daily activity for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyActivity = await ActivityLog.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overall: overallStats[0] || {
          totalLogs: 0,
          uniqueUserCount: 0
        },
        actionStats,
        entityStats,
        userStats,
        dailyActivity
      }
    });
  } catch (error) {
    console.error('Get log statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get user activity summary
// @route   GET /api/logs/user/:userId
// @access  Private
router.get('/user/:userId', [
  protect,
  authorize('admin'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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

    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 50;

    // Build date filter
    const dateFilter = { user: userId };
    if (req.query.startDate || req.query.endDate) {
      dateFilter.createdAt = {};
      if (req.query.startDate) {
        dateFilter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        dateFilter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    // Get user details
    const User = require('../models/User');
    const user = await User.findById(userId).select('name email role lastLogin createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user activity logs
    const userLogs = await ActivityLog.find(dateFilter)
      .sort({ createdAt: 1 })
      .limit(limit)
      .select('action entity entityId description ipAddress userAgent createdAt');

    // Get user activity summary
    const activitySummary = await ActivityLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get login statistics
    const loginStats = await ActivityLog.aggregate([
      {
        $match: {
          user: userId,
          action: 'LOGIN',
          ...(req.query.startDate || req.query.endDate ? {
            createdAt: {
              ...(req.query.startDate ? { $gte: new Date(req.query.startDate) } : {}),
              ...(req.query.endDate ? { $lte: new Date(req.query.endDate) } : {})
            }
          } : {})
        }
      },
      {
        $group: {
          _id: null,
          totalLogins: { $sum: 1 },
          firstLogin: { $min: '$createdAt' },
          lastLogin: { $max: '$createdAt' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        },
        activitySummary,
        loginStats: loginStats[0] || {
          totalLogins: 0,
          firstLogin: null,
          lastLogin: null
        },
        recentActivities: userLogs
      }
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete activity log
// @route   DELETE /api/logs/:id
// @access  Private
router.delete('/:id', [
  protect,
  authorize('admin')
], async (req, res) => {
  try {
    const log = await ActivityLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found'
      });
    }

    await ActivityLog.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Activity log deleted successfully'
    });
  } catch (error) {
    console.error('Delete activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update activity log
// @route   PUT /api/logs/:id
// @access  Private
router.put('/:id', [
  protect,
  authorize('admin'),
  body('description').optional().isString().isLength({ min: 1, max: 500 }).withMessage('Description must be between 1 and 500 characters'),
  body('action').optional().isString().withMessage('Action must be a string'),
  body('entity').optional().isString().withMessage('Entity must be a string')
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

    const log = await ActivityLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found'
      });
    }

    const updatedLog = await ActivityLog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    res.status(200).json({
      success: true,
      message: 'Activity log updated successfully',
      data: updatedLog
    });
  } catch (error) {
    console.error('Update activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
