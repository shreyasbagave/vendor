const express = require('express');
const { query, validationResult } = require('express-validator');
const InwardStock = require('../models/InwardStock');
const OutwardStock = require('../models/OutwardStock');
const Item = require('../models/Item');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Get unified transaction history for an item
// @route   GET /api/transactions/item/:itemId
// @access  Private (Any authenticated user)
router.get('/item/:itemId', [
  protect,
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
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

    const { itemId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    // Build date filter
    const dateFilter = {};
    if (req.query.startDate) {
      dateFilter.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      dateFilter.$lte = new Date(req.query.endDate);
    }

    const filter = {
      item: itemId,
      createdBy: req.user._id // Only user's own transactions
    };

    if (Object.keys(dateFilter).length > 0) {
      filter.date = dateFilter;
    }

    // Get item details
    const item = await Item.findOne({ _id: itemId, createdBy: req.user._id });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Get inward transactions
    const inwardTransactions = await InwardStock.find(filter)
      .populate('supplier', 'name')
      .select('date challanNo quantityReceived vehicleNumber remarks createdAt')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // Get outward transactions
    const outwardTransactions = await OutwardStock.find(filter)
      .populate('customer', 'name')
      .select('date challanNo okQty crQty mrQty asCastQty totalQty vehicleNumber remarks createdAt')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // Format inward transactions
    const formattedInward = inwardTransactions.map(t => ({
      _id: t._id,
      entryType: 'INWARD',
      date: t.date,
      dateTime: t.createdAt,
      challanNo: t.challanNo,
      quantity: t.quantityReceived,
      party: t.supplier?.name || 'N/A',
      partyType: 'Supplier',
      vehicleNumber: t.vehicleNumber || '-',
      note: t.remarks || '',
      details: {
        quantityReceived: t.quantityReceived
      }
    }));

    // Format outward transactions
    const formattedOutward = outwardTransactions.map(t => ({
      _id: t._id,
      entryType: 'OUTWARD',
      date: t.date,
      dateTime: t.createdAt,
      challanNo: t.challanNo,
      quantity: t.totalQty,
      party: t.customer?.name || 'N/A',
      partyType: 'Customer',
      vehicleNumber: t.vehicleNumber || '-',
      note: t.remarks || '',
      details: {
        okQty: t.okQty,
        crQty: t.crQty,
        mrQty: t.mrQty,
        asCastQty: t.asCastQty,
        totalQty: t.totalQty
      }
    }));

    // Combine and sort by date
    const allTransactions = [...formattedInward, ...formattedOutward]
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
      .slice(0, limit);

    // Calculate running balance
    let runningBalance = 0;
    const transactionsWithBalance = allTransactions.reverse().map(t => {
      if (t.entryType === 'INWARD') {
        runningBalance += t.quantity;
      } else {
        runningBalance -= t.quantity;
      }
      return {
        ...t,
        balanceAfter: runningBalance
      };
    }).reverse();

    res.status(200).json({
      success: true,
      data: {
        item: {
          _id: item._id,
          name: item.name,
          currentStock: item.currentStock,
          unit: item.unit
        },
        transactions: transactionsWithBalance,
        count: transactionsWithBalance.length,
        summary: {
          totalInward: inwardTransactions.reduce((sum, t) => sum + t.quantityReceived, 0),
          totalOutward: outwardTransactions.reduce((sum, t) => sum + t.totalQty, 0),
          currentStock: item.currentStock
        }
      }
    });
  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get all recent transactions (both inward and outward)
// @route   GET /api/transactions/recent
// @access  Private (Any authenticated user)
router.get('/recent', [
  protect,
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

    const limit = parseInt(req.query.limit) || 20;
    const filter = { createdBy: req.user._id };

    // Get recent inward transactions
    const inwardTransactions = await InwardStock.find(filter)
      .populate('item', 'name')
      .populate('supplier', 'name')
      .select('date challanNo quantityReceived vehicleNumber item supplier createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Get recent outward transactions
    const outwardTransactions = await OutwardStock.find(filter)
      .populate('item', 'name')
      .populate('customer', 'name')
      .select('date challanNo totalQty vehicleNumber item customer createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Format and combine
    const formattedInward = inwardTransactions.map(t => ({
      _id: t._id,
      entryType: 'INWARD',
      date: t.date,
      dateTime: t.createdAt,
      challanNo: t.challanNo,
      quantity: t.quantityReceived,
      vehicleNumber: t.vehicleNumber || '-',
      itemName: t.item?.name || 'N/A',
      partyName: t.supplier?.name || 'N/A'
    }));

    const formattedOutward = outwardTransactions.map(t => ({
      _id: t._id,
      entryType: 'OUTWARD',
      date: t.date,
      dateTime: t.createdAt,
      challanNo: t.challanNo,
      quantity: t.totalQty,
      vehicleNumber: t.vehicleNumber || '-',
      itemName: t.item?.name || 'N/A',
      partyName: t.customer?.name || 'N/A'
    }));

    const allTransactions = [...formattedInward, ...formattedOutward]
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
      .slice(0, limit);

    res.status(200).json({
      success: true,
      data: allTransactions,
      count: allTransactions.length
    });
  } catch (error) {
    console.error('Get recent transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

