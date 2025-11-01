const express = require('express');
const { query, validationResult } = require('express-validator');
const Item = require('../models/Item');
const InwardStock = require('../models/InwardStock');
const OutwardStock = require('../models/OutwardStock');
const { protect, authorize, logActivity } = require('../middleware/auth');
const ExcelExporter = require('../utils/excelExporter');
const PDFDocument = require('pdfkit');

const router = express.Router();

// @desc    Get current stock statement
// @route   GET /api/reports/stock-statement
// @access  Private (Any authenticated user)
router.get('/stock-statement', [
  protect,
  query('category').optional().isString().withMessage('Category must be a string'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], logActivity('REPORT_GENERATE', 'Report'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Build filter for items
    const itemFilter = {};
    if (req.query.category) {
      itemFilter.category = { $regex: req.query.category, $options: 'i' };
    }
    if (req.query.isActive !== undefined) {
      itemFilter.isActive = req.query.isActive === 'true';
    }

    const stockStatement = await Item.aggregate([
      { $match: itemFilter },
      {
        $lookup: {
          from: 'inwardstocks',
          localField: '_id',
          foreignField: 'item',
          as: 'inwardData'
        }
      },
      {
        $lookup: {
          from: 'outwardstocks',
          localField: '_id',
          foreignField: 'item',
          as: 'outwardData'
        }
      },
      {
        $addFields: {
          totalInward: {
            $sum: '$inwardData.quantityReceived'
          },
          totalOutward: {
            $sum: '$outwardData.totalQty'
          },
          totalOkQty: {
            $sum: '$outwardData.okQty'
          },
          totalCrQty: {
            $sum: '$outwardData.crQty'
          },
          totalMrQty: {
            $sum: '$outwardData.mrQty'
          },
          totalAsCastQty: {
            $sum: '$outwardData.asCastQty'
          },
          inwardAmount: {
            $sum: '$inwardData.totalAmount'
          },
          outwardAmount: {
            $sum: '$outwardData.totalAmount'
          }
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          category: 1,
          unit: 1,
          currentStock: 1,
          minimumStock: 1,
          isActive: 1,
          totalInward: 1,
          totalOutward: 1,
          totalOkQty: 1,
          totalCrQty: 1,
          totalMrQty: 1,
          totalAsCastQty: 1,
          inwardAmount: 1,
          outwardAmount: 1,
          isLowStock: {
            $and: [
              { $gt: ['$minimumStock', 0] }, // Only check if minimumStock is set
              { $lte: ['$currentStock', '$minimumStock'] }
            ]
          }
        }
      },
      { $sort: { category: 1, name: 1 } }
    ]);

    // Calculate summary
    const summary = stockStatement.reduce((acc, item) => {
      acc.totalItems++;
      acc.totalCurrentStock += item.currentStock;
      acc.totalInward += item.totalInward;
      acc.totalOutward += item.totalOutward;
      acc.totalOkQty += item.totalOkQty;
      acc.totalCrQty += item.totalCrQty;
      acc.totalMrQty += item.totalMrQty;
      acc.totalAsCastQty += item.totalAsCastQty;
      acc.totalInwardAmount += item.inwardAmount;
      acc.totalOutwardAmount += item.outwardAmount;
      if (item.isLowStock) acc.lowStockItems++;
      return acc;
    }, {
      totalItems: 0,
      totalCurrentStock: 0,
      totalInward: 0,
      totalOutward: 0,
      totalOkQty: 0,
      totalCrQty: 0,
      totalMrQty: 0,
      totalAsCastQty: 0,
      totalInwardAmount: 0,
      totalOutwardAmount: 0,
      lowStockItems: 0
    });

    res.status(200).json({
      success: true,
      data: {
        summary,
        items: stockStatement
      }
    });
  } catch (error) {
    console.error('Get stock statement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get monthly report
// @route   GET /api/reports/monthly
// @access  Private (Any authenticated user)
router.get('/monthly', [
  protect,
  query('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  query('includeDetails').optional().isBoolean().withMessage('includeDetails must be a boolean')
], logActivity('REPORT_GENERATE', 'Report'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);
    const includeDetails = req.query.includeDetails === 'true';

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Calculate opening stock for each item (stock at the start of the month)
    // Opening Stock = Current Stock - (Inward in month) + (Outward OK in month) - (Adjustments in month)
    const openingStockMap = new Map();
    
    // Get all items for the user
    const allItems = await Item.find({ createdBy: req.user._id }).select('_id name currentStock');
    
    // Initialize with current stock (will be adjusted)
    allItems.forEach(item => {
      openingStockMap.set(item._id.toString(), item.currentStock || 0);
    });
    
    // Subtract inward entries in current month (they were added during the month)
    const inwardInMonth = await InwardStock.find({
      date: { $gte: startDate, $lte: endDate },
      createdBy: req.user._id
    }).select('item quantityReceived');
    
    inwardInMonth.forEach(entry => {
      const itemId = entry.item.toString();
      const current = openingStockMap.get(itemId) || 0;
      openingStockMap.set(itemId, current - (entry.quantityReceived || 0));
    });
    
    // Add outward OK quantities in current month (they were subtracted during the month)
    const outwardInMonth = await OutwardStock.find({
      date: { $gte: startDate, $lte: endDate },
      createdBy: req.user._id
    }).select('item okQty');
    
    outwardInMonth.forEach(entry => {
      const itemId = entry.item.toString();
      const current = openingStockMap.get(itemId) || 0;
      openingStockMap.set(itemId, current + (entry.okQty || 0));
    });
    
    // Subtract adjustments in current month (they were added/subtracted during the month)
    const ActivityLog = require('../models/ActivityLog');
    const adjustmentsInMonth = await ActivityLog.find({
      action: 'STOCK_ADJUST',
      createdAt: { $gte: startDate, $lte: endDate },
      user: req.user._id
    }).select('entityId metadata');
    
    adjustmentsInMonth.forEach(adj => {
      const itemId = adj.entityId?.toString();
      if (itemId && adj.metadata?.adjustment) {
        const current = openingStockMap.get(itemId) || 0;
        openingStockMap.set(itemId, current - (adj.metadata.adjustment || 0));
      }
    });

    // Get inward summary
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
          totalEntries: { $sum: 1 },
          totalQuantity: { $sum: '$quantityReceived' },
          totalAmount: { $sum: '$totalAmount' },
          uniqueSuppliers: { $addToSet: '$supplier' },
          uniqueItems: { $addToSet: '$item' }
        }
      },
      {
        $addFields: {
          supplierCount: { $size: '$uniqueSuppliers' },
          itemCount: { $size: '$uniqueItems' }
        }
      }
    ]);

    // Get outward summary
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
          totalEntries: { $sum: 1 },
          totalQuantity: { $sum: '$totalQty' },
          totalOkQty: { $sum: '$okQty' },
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalAsCastQty: { $sum: '$asCastQty' },
          totalAmount: { $sum: '$totalAmount' },
          uniqueCustomers: { $addToSet: '$customer' },
          uniqueItems: { $addToSet: '$item' }
        }
      },
      {
        $addFields: {
          customerCount: { $size: '$uniqueCustomers' },
          itemCount: { $size: '$uniqueItems' }
        }
      }
    ]);

    // Get item-wise breakdown
    const itemBreakdown = await OutwardStock.aggregate([
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
          totalAsCastQty: { $sum: '$asCastQty' },
          totalAmount: { $sum: '$totalAmount' },
          entryCount: { $sum: 1 }
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
          itemId: '$_id',
          itemName: '$item.name',
          itemCategory: '$item.category',
          itemUnit: '$item.unit',
          totalQuantity: 1,
          totalOkQty: 1,
          totalCrQty: 1,
          totalMrQty: 1,
          totalAsCastQty: 1,
          totalAmount: 1,
          entryCount: 1,
          rejectionRate: {
            $cond: [
              { $gt: ['$totalQuantity', 0] },
              { $multiply: [{ $divide: [{ $add: ['$totalCrQty', '$totalMrQty'] }, '$totalQuantity'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { totalQuantity: -1 } }
    ]);

    // Add opening stock to item breakdown
    const itemBreakdownWithOpening = itemBreakdown.map(item => {
      const itemId = item.itemId?.toString();
      const openingStock = openingStockMap.get(itemId) || 0;
      return { ...item, openingStock };
    });

    let detailedInward = null;
    let detailedOutward = null;

    if (includeDetails) {
      // Get detailed inward entries
      const inwardEntries = await InwardStock.find({
        date: { $gte: startDate, $lte: endDate },
        createdBy: req.user._id
      })
      .populate('supplier', 'name contactPerson')
      .populate('item', 'name category unit')
      .populate('createdBy', 'name')
      .sort({ date: 1, createdAt: 1 })
      .select('date challanNo supplier item quantityReceived unit rate totalAmount vehicleNumber remarks createdBy');

      // Get stock adjustments from ActivityLog
      const ActivityLog = require('../models/ActivityLog');
      const adjustments = await ActivityLog.find({
        action: 'STOCK_ADJUST',
        createdAt: { $gte: startDate, $lte: endDate },
        user: req.user._id
      })
      .populate('user', 'name email')
      .populate({
        path: 'entityId',
        model: 'Item',
        select: 'name category unit'
      })
      .sort({ createdAt: 1 })
      .select('action entity entityId description metadata createdAt user');

      // Format adjustments as inward-like entries and merge with inward entries
      const adjustmentEntries = adjustments.map(adj => {
        const meta = adj.metadata || {};
        const item = adj.entityId || {};
        return {
          isAdjustment: true,
          date: null, // No date shown for adjustments
          createdAt: adj.createdAt, // For sorting only
          adjustmentQuantity: meta.adjustment || 0, // This will go in date column
          challanNo: 'ADJ', // Mark as adjustment
          item: {
            _id: adj.entityId?._id || null,
            name: meta.itemName || item.name || 'Unknown Item',
            category: item.category || '',
            unit: item.unit || ''
          },
          quantityReceived: meta.adjustment || 0, // For display in Qty column
          supplier: null,
          vehicleNumber: null,
          createdBy: { name: adj.user?.name || 'Unknown' }
        };
      });

      // Create opening stock entries as separate rows (one per unique item that has transactions)
      const itemsWithTransactions = new Set();
      
      // Collect all items that have transactions in this month
      inwardEntries.forEach(e => {
        const itemId = e.item?._id?.toString() || e.item?.toString();
        if (itemId) itemsWithTransactions.add(itemId);
      });
      
      adjustmentEntries.forEach(adj => {
        const itemId = adj.item?._id?.toString();
        if (itemId) itemsWithTransactions.add(itemId);
      });
      
      // Create opening stock entries
      const openingStockEntries = Array.from(itemsWithTransactions).map(itemId => {
        const openingStock = openingStockMap.get(itemId) || 0;
        const item = inwardEntries.find(e => (e.item?._id?.toString() || e.item?.toString()) === itemId)?.item ||
                     adjustmentEntries.find(adj => adj.item?._id?.toString() === itemId)?.item;
        
        return {
          isOpeningStock: true,
          date: startDate, // First day of month for sorting
          createdAt: startDate, // For sorting
          challanNo: 'Opening stock',
          item: item || { _id: itemId, name: 'Unknown Item', category: '', unit: '' },
          quantityReceived: openingStock,
          supplier: null,
          vehicleNumber: null,
          createdBy: null,
          openingStock: openingStock
        };
      }).sort((a, b) => {
        // Sort opening stock entries by item name
        const nameA = a.item?.name || '';
        const nameB = b.item?.name || '';
        return nameA.localeCompare(nameB);
      });

      // Mark regular entries
      const inwardWithOpening = inwardEntries.map(e => {
        return { ...e.toObject(), isAdjustment: false, isOpeningStock: false };
      });
      
      const adjustmentsWithOpening = adjustmentEntries.map(adj => {
        return { ...adj, isOpeningStock: false };
      });

      // Merge: Opening stock entries first, then regular entries sorted by date
      const regularEntries = [...inwardWithOpening, ...adjustmentsWithOpening].sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateA.getTime() - dateB.getTime();
      });
      
      detailedInward = [...openingStockEntries, ...regularEntries];

      // Get detailed outward entries
      detailedOutward = await OutwardStock.find({
        date: { $gte: startDate, $lte: endDate },
        createdBy: req.user._id
      })
      .populate('customer', 'name contactPerson')
      .populate('item', 'name category unit')
      .populate('createdBy', 'name')
      .sort({ date: 1, createdAt: 1 })
      .select('date challanNo customer item okQty crQty mrQty asCastQty totalQty unit rate totalAmount vehicleNumber crReason mrReason remarks createdBy');
    }

    res.status(200).json({
      success: true,
      data: {
        period: {
          month,
          year,
          monthName: startDate.toLocaleString('default', { month: 'long' }),
          startDate,
          endDate
        },
        inward: inwardSummary[0] || {
          totalEntries: 0,
          totalQuantity: 0,
          totalAmount: 0,
          supplierCount: 0,
          itemCount: 0
        },
        outward: outwardSummary[0] || {
          totalEntries: 0,
          totalQuantity: 0,
          totalOkQty: 0,
          totalCrQty: 0,
          totalMrQty: 0,
          totalAsCastQty: 0,
          totalAmount: 0,
          customerCount: 0,
          itemCount: 0
        },
        itemBreakdown: itemBreakdownWithOpening,
        detailedInward,
        detailedOutward,
        openingStockMap: Object.fromEntries(openingStockMap)
      }
    });
  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get item-wise history
// @route   GET /api/reports/item-history
// @access  Private (Any authenticated user)
router.get('/item-history', [
  protect,
  query('itemId').isMongoId().withMessage('Valid item ID is required'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
], logActivity('REPORT_GENERATE', 'Report'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const itemId = req.query.itemId;
    const limit = parseInt(req.query.limit) || 100;

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

    // Get item details
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Get inward transactions
    const inwardTransactions = await InwardStock.find({
      item: itemId,
      ...dateFilter
    })
    .populate('supplier', 'name contactPerson')
    .populate('createdBy', 'name')
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .select('date challanNo supplier quantityReceived unit rate totalAmount vehicleNumber remarks createdBy');

    // Get outward transactions
    const outwardTransactions = await OutwardStock.find({
      item: itemId,
      ...dateFilter
    })
    .populate('customer', 'name contactPerson')
    .populate('createdBy', 'name')
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .select('date challanNo customer okQty crQty mrQty asCastQty totalQty unit rate totalAmount vehicleNumber crReason mrReason remarks createdBy');

    // Calculate summary
    const inwardSummary = inwardTransactions.reduce((acc, t) => {
      acc.totalQuantity += t.quantityReceived;
      acc.totalAmount += t.totalAmount || 0;
      acc.transactionCount++;
      return acc;
    }, { totalQuantity: 0, totalAmount: 0, transactionCount: 0 });

    const outwardSummary = outwardTransactions.reduce((acc, t) => {
      acc.totalQuantity += t.totalQty;
      acc.totalOkQty += t.okQty;
      acc.totalCrQty += t.crQty;
      acc.totalMrQty += t.mrQty;
      acc.totalAsCastQty += t.asCastQty;
      acc.totalAmount += t.totalAmount || 0;
      acc.transactionCount++;
      return acc;
    }, { 
      totalQuantity: 0, 
      totalOkQty: 0, 
      totalCrQty: 0, 
      totalMrQty: 0, 
      totalAsCastQty: 0, 
      totalAmount: 0, 
      transactionCount: 0 
    });

    // Combine and sort all transactions
    const allTransactions = [
      ...inwardTransactions.map(t => ({ ...t.toObject(), type: 'inward' })),
      ...outwardTransactions.map(t => ({ ...t.toObject(), type: 'outward' }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({
      success: true,
      data: {
        item: {
          id: item._id,
          name: item.name,
          description: item.description,
          category: item.category,
          unit: item.unit,
          currentStock: item.currentStock,
          minimumStock: item.minimumStock,
          isActive: item.isActive
        },
        inwardSummary,
        outwardSummary,
        inwardTransactions,
        outwardTransactions,
        allTransactions: allTransactions.slice(0, limit)
      }
    });
  } catch (error) {
    console.error('Get item history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get supplier performance report
// @route   GET /api/reports/supplier-performance
// @access  Private (Any authenticated user)
router.get('/supplier-performance', [
  protect,
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
], logActivity('REPORT_GENERATE', 'Report'), async (req, res) => {
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

    const supplierPerformance = await InwardStock.aggregate([
      { $match: { ...dateFilter, createdBy: req.user._id } },
      {
        $group: {
          _id: '$supplier',
          totalTransactions: { $sum: 1 },
          totalQuantity: { $sum: '$quantityReceived' },
          totalAmount: { $sum: '$totalAmount' },
          averageQuantity: { $avg: '$quantityReceived' },
          averageAmount: { $avg: '$totalAmount' },
          firstTransaction: { $min: '$date' },
          lastTransaction: { $max: '$date' }
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
          supplierContact: '$supplier.contactPerson',
          supplierEmail: '$supplier.email',
          supplierPhone: '$supplier.phone',
          totalTransactions: 1,
          totalQuantity: 1,
          totalAmount: 1,
          averageQuantity: { $round: ['$averageQuantity', 2] },
          averageAmount: { $round: ['$averageAmount', 2] },
          firstTransaction: 1,
          lastTransaction: 1
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: supplierPerformance
    });
  } catch (error) {
    console.error('Get supplier performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get customer performance report
// @route   GET /api/reports/customer-performance
// @access  Private (Any authenticated user)
router.get('/customer-performance', [
  protect,
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
], logActivity('REPORT_GENERATE', 'Report'), async (req, res) => {
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

    const customerPerformance = await OutwardStock.aggregate([
      { $match: { ...dateFilter, createdBy: req.user._id } },
      {
        $group: {
          _id: '$customer',
          totalTransactions: { $sum: 1 },
          totalQuantity: { $sum: '$totalQty' },
          totalOkQty: { $sum: '$okQty' },
          totalCrQty: { $sum: '$crQty' },
          totalMrQty: { $sum: '$mrQty' },
          totalAsCastQty: { $sum: '$asCastQty' },
          totalAmount: { $sum: '$totalAmount' },
          averageQuantity: { $avg: '$totalQty' },
          averageAmount: { $avg: '$totalAmount' },
          firstTransaction: { $min: '$date' },
          lastTransaction: { $max: '$date' }
        }
      },
      {
        $addFields: {
          rejectionRate: {
            $cond: [
              { $gt: ['$totalQuantity', 0] },
              { $multiply: [{ $divide: [{ $add: ['$totalCrQty', '$totalMrQty'] }, '$totalQuantity'] }, 100] },
              0
            ]
          }
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
          customerContact: '$customer.contactPerson',
          customerEmail: '$customer.email',
          customerPhone: '$customer.phone',
          totalTransactions: 1,
          totalQuantity: 1,
          totalOkQty: 1,
          totalCrQty: 1,
          totalMrQty: 1,
          totalAsCastQty: 1,
          totalAmount: 1,
          averageQuantity: { $round: ['$averageQuantity', 2] },
          averageAmount: { $round: ['$averageAmount', 2] },
          rejectionRate: { $round: ['$rejectionRate', 2] },
          firstTransaction: 1,
          lastTransaction: 1
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: customerPerformance
    });
  } catch (error) {
    console.error('Get customer performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Export: Monthly report Excel with logs
router.get('/export/excel', [
  protect,
  query('month').isInt({ min: 1, max: 12 }),
  query('year').isInt({ min: 2020, max: 2030 })
], logActivity('REPORT_EXPORT', 'Report'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    // Reuse handler logic by calling our own monthly endpoint logic inline
    req.query.includeDetails = 'true';

    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const [monthlyRes] = await Promise.all([
      (async () => {
        // Build the same data structure as monthly route
        const inwardSummary = await InwardStock.aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate }, createdBy: req.user._id } },
          { $group: { _id: null, totalEntries: { $sum: 1 }, totalQuantity: { $sum: '$quantityReceived' }, totalAmount: { $sum: '$totalAmount' }, uniqueSuppliers: { $addToSet: '$supplier' }, uniqueItems: { $addToSet: '$item' } } },
          { $addFields: { supplierCount: { $size: '$uniqueSuppliers' }, itemCount: { $size: '$uniqueItems' } } }
        ]);
        const outwardSummary = await OutwardStock.aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate }, createdBy: req.user._id } },
          { $group: { _id: null, totalEntries: { $sum: 1 }, totalQuantity: { $sum: '$totalQty' }, totalOkQty: { $sum: '$okQty' }, totalCrQty: { $sum: '$crQty' }, totalMrQty: { $sum: '$mrQty' }, totalAsCastQty: { $sum: '$asCastQty' }, totalAmount: { $sum: '$totalAmount' }, uniqueCustomers: { $addToSet: '$customer' }, uniqueItems: { $addToSet: '$item' } } },
          { $addFields: { customerCount: { $size: '$uniqueCustomers' }, itemCount: { $size: '$uniqueItems' } } }
        ]);
        const itemBreakdown = await OutwardStock.aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate }, createdBy: req.user._id } },
          { $group: { _id: '$item', totalQuantity: { $sum: '$totalQty' }, totalOkQty: { $sum: '$okQty' }, totalCrQty: { $sum: '$crQty' }, totalMrQty: { $sum: '$mrQty' }, totalAsCastQty: { $sum: '$asCastQty' }, totalAmount: { $sum: '$totalAmount' }, entryCount: { $sum: 1 } } },
          { $lookup: { from: 'items', localField: '_id', foreignField: '_id', as: 'item' } },
          { $unwind: '$item' },
          { $project: { itemName: '$item.name', itemCategory: '$item.category', itemUnit: '$item.unit', totalQuantity: 1, totalOkQty: 1, totalCrQty: 1, totalMrQty: 1, totalAsCastQty: 1, totalAmount: 1, entryCount: 1, rejectionRate: { $cond: [{ $gt: ['$totalQuantity', 0] }, { $multiply: [{ $divide: [{ $add: ['$totalCrQty', '$totalMrQty'] }, '$totalQuantity'] }, 100] }, 0] } } },
          { $sort: { totalQuantity: -1 } }
        ]);
        // Calculate opening stock (same logic as monthly route)
        const openingStockMap = new Map();
        const allItems = await Item.find({ createdBy: req.user._id }).select('_id name currentStock');
        allItems.forEach(item => {
          openingStockMap.set(item._id.toString(), item.currentStock || 0);
        });
        
        const inwardInMonth = await InwardStock.find({
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id
        }).select('item quantityReceived');
        
        inwardInMonth.forEach(entry => {
          const itemId = entry.item.toString();
          const current = openingStockMap.get(itemId) || 0;
          openingStockMap.set(itemId, current - (entry.quantityReceived || 0));
        });
        
        const outwardInMonth = await OutwardStock.find({
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id
        }).select('item okQty');
        
        outwardInMonth.forEach(entry => {
          const itemId = entry.item.toString();
          const current = openingStockMap.get(itemId) || 0;
          openingStockMap.set(itemId, current + (entry.okQty || 0));
        });
        
        const ActivityLog = require('../models/ActivityLog');
        const adjustmentsInMonth = await ActivityLog.find({
          action: 'STOCK_ADJUST',
          createdAt: { $gte: startDate, $lte: endDate },
          user: req.user._id
        }).select('entityId metadata');
        
        adjustmentsInMonth.forEach(adj => {
          const itemId = adj.entityId?.toString();
          if (itemId && adj.metadata?.adjustment) {
            const current = openingStockMap.get(itemId) || 0;
            openingStockMap.set(itemId, current - (adj.metadata.adjustment || 0));
          }
        });

        // Get inward entries
        const inwardEntries = await InwardStock.find({ 
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id
        })
          .populate('supplier', 'name')
          .populate('item', 'name')
          .sort({ date: 1, createdAt: 1 })
          .select('date challanNo supplier item quantityReceived unit rate totalAmount vehicleNumber remarks createdBy');

        // Get stock adjustments from ActivityLog
        const adjustments = await ActivityLog.find({
          action: 'STOCK_ADJUST',
          createdAt: { $gte: startDate, $lte: endDate },
          user: req.user._id
        })
        .populate('user', 'name email')
        .populate({
          path: 'entityId',
          model: 'Item',
          select: 'name category unit'
        })
        .sort({ createdAt: 1 })
        .select('action entity entityId description metadata createdAt user');

        // Format adjustments as inward-like entries
        const adjustmentEntries = adjustments.map(adj => {
          const meta = adj.metadata || {};
          const item = adj.entityId || {};
          const itemId = item._id?.toString();
          const openingStock = openingStockMap.get(itemId) || 0;
          return {
            isAdjustment: true,
            date: null,
            createdAt: adj.createdAt,
            adjustmentQuantity: meta.adjustment || 0,
            challanNo: 'ADJ',
            item: {
              _id: adj.entityId?._id || null,
              name: meta.itemName || item.name || 'Unknown Item',
              category: item.category || '',
              unit: item.unit || ''
            },
            quantityReceived: meta.adjustment || 0,
            supplier: null,
            vehicleNumber: null,
            remarks: meta.reason || '',
            createdBy: { name: adj.user?.name || 'Unknown' },
            openingStock
          };
        });

        // Create opening stock entries as separate rows (one per unique item that has transactions)
        const itemsWithTransactions = new Set();
        
        inwardEntries.forEach(e => {
          const itemId = e.item?._id?.toString() || e.item?.toString();
          if (itemId) itemsWithTransactions.add(itemId);
        });
        
        adjustmentEntries.forEach(adj => {
          const itemId = adj.item?._id?.toString();
          if (itemId) itemsWithTransactions.add(itemId);
        });
        
        // Create opening stock entries
        const openingStockEntries = Array.from(itemsWithTransactions).map(itemId => {
          const openingStock = openingStockMap.get(itemId) || 0;
          const item = inwardEntries.find(e => (e.item?._id?.toString() || e.item?.toString()) === itemId)?.item ||
                       adjustmentEntries.find(adj => adj.item?._id?.toString() === itemId)?.item;
          
          return {
            isOpeningStock: true,
            date: startDate,
            createdAt: startDate,
            challanNo: 'Opening stock',
            item: item || { _id: itemId, name: 'Unknown Item', category: '', unit: '' },
            quantityReceived: openingStock,
            supplier: null,
            vehicleNumber: null,
            remarks: null,
            createdBy: null,
            openingStock: openingStock
          };
        }).sort((a, b) => {
          const nameA = a.item?.name || '';
          const nameB = b.item?.name || '';
          return nameA.localeCompare(nameB);
        });

        // Mark regular entries
        const inwardWithOpening = inwardEntries.map(e => {
          return { ...e.toObject(), isAdjustment: false, isOpeningStock: false };
        });
        
        const adjustmentsWithOpening = adjustmentEntries.map(adj => {
          return { ...adj, isOpeningStock: false };
        });

        // Merge: Opening stock entries first, then regular entries sorted by date
        const regularEntries = [...inwardWithOpening, ...adjustmentsWithOpening].sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0);
          const dateB = new Date(b.date || b.createdAt || 0);
          return dateA.getTime() - dateB.getTime();
        });
        
        const detailedInward = [...openingStockEntries, ...regularEntries];
        const detailedOutward = await OutwardStock.find({ 
          date: { $gte: startDate, $lte: endDate },
          createdBy: req.user._id
        })
          .populate('customer', 'name')
          .populate('item', 'name')
          .sort({ date: 1, createdAt: 1 })
          .select('date challanNo customer item okQty crQty mrQty asCastQty totalQty unit rate totalAmount vehicleNumber remarks');

        return {
          period: { month, year, monthName: startDate.toLocaleString('default', { month: 'long' }), startDate, endDate },
          inward: inwardSummary[0] || { totalEntries: 0, totalQuantity: 0, totalAmount: 0, supplierCount: 0, itemCount: 0 },
          outward: outwardSummary[0] || { totalEntries: 0, totalQuantity: 0, totalOkQty: 0, totalCrQty: 0, totalMrQty: 0, totalAsCastQty: 0, totalAmount: 0, customerCount: 0, itemCount: 0 },
          itemBreakdown,
          detailedInward,
          detailedOutward
        };
      })()
    ]);

    const exporter = new ExcelExporter();
    await exporter.exportMonthlyReportWithLogs(monthlyRes);
    const buffer = await exporter.exportToBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monthly_report_${req.query.month}_${req.query.year}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export monthly excel error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Export: Monthly report PDF with logs
router.get('/export/pdf', [
  protect,
  query('month').isInt({ min: 1, max: 12 }),
  query('year').isInt({ min: 2020, max: 2030 })
], logActivity('REPORT_EXPORT', 'Report'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const inwardSummary = await InwardStock.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate }, createdBy: req.user._id } },
      { $group: { _id: null, totalEntries: { $sum: 1 }, totalQuantity: { $sum: '$quantityReceived' }, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    const outwardSummary = await OutwardStock.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate }, createdBy: req.user._id } },
      { $group: { _id: null, totalEntries: { $sum: 1 }, totalQuantity: { $sum: '$totalQty' }, totalAmount: { $sum: '$totalAmount' }, totalOkQty: { $sum: '$okQty' }, totalCrQty: { $sum: '$crQty' }, totalMrQty: { $sum: '$mrQty' }, totalAsCastQty: { $sum: '$asCastQty' } } }
    ]);

    // Get inward entries
    const inwardEntries = await InwardStock.find({ 
      date: { $gte: startDate, $lte: endDate },
      createdBy: req.user._id
    })
      .populate('supplier', 'name')
      .sort({ date: 1, createdAt: 1 })
      .select('date challanNo supplier quantityReceived totalAmount vehicleNumber');

    // Get stock adjustments from ActivityLog
    const ActivityLog = require('../models/ActivityLog');
    const adjustments = await ActivityLog.find({
      action: 'STOCK_ADJUST',
      createdAt: { $gte: startDate, $lte: endDate },
      user: req.user._id
    })
    .populate('user', 'name email')
    .populate({
      path: 'entityId',
      model: 'Item',
      select: 'name category unit'
    })
    .sort({ createdAt: 1 })
    .select('action entity entityId description metadata createdAt user');

    // Calculate opening stock (same logic as monthly route)
    const openingStockMap = new Map();
    const allItems = await Item.find({ createdBy: req.user._id }).select('_id name currentStock');
    allItems.forEach(item => {
      openingStockMap.set(item._id.toString(), item.currentStock || 0);
    });
    
    inwardEntries.forEach(entry => {
      const itemId = entry.item?._id?.toString() || entry.item?.toString();
      const current = openingStockMap.get(itemId) || 0;
      openingStockMap.set(itemId, current - (entry.quantityReceived || 0));
    });
    
    const outwardInMonth = await OutwardStock.find({
      date: { $gte: startDate, $lte: endDate },
      createdBy: req.user._id
    }).select('item okQty');
    
    outwardInMonth.forEach(entry => {
      const itemId = entry.item.toString();
      const current = openingStockMap.get(itemId) || 0;
      openingStockMap.set(itemId, current + (entry.okQty || 0));
    });
    
    adjustments.forEach(adj => {
      const itemId = adj.entityId?.toString();
      if (itemId && adj.metadata?.adjustment) {
        const current = openingStockMap.get(itemId) || 0;
        openingStockMap.set(itemId, current - (adj.metadata.adjustment || 0));
      }
    });

    // Format adjustments as inward-like entries
    const adjustmentEntries = adjustments.map(adj => {
      const meta = adj.metadata || {};
      const item = adj.entityId || {};
      const itemId = item._id?.toString();
      const openingStock = openingStockMap.get(itemId) || 0;
      return {
        isAdjustment: true,
        date: null,
        createdAt: adj.createdAt,
        adjustmentQuantity: meta.adjustment || 0,
        challanNo: 'ADJ',
        supplier: null,
        quantityReceived: meta.adjustment || 0,
        vehicleNumber: null,
        openingStock
      };
    });

    // Create opening stock entries as separate rows (one per unique item that has transactions)
    const itemsWithTransactions = new Set();
    
    inwardEntries.forEach(e => {
      const itemId = e.item?._id?.toString() || e.item?.toString();
      if (itemId) itemsWithTransactions.add(itemId);
    });
    
    adjustments.forEach(adj => {
      const itemId = adj.entityId?.toString();
      if (itemId) itemsWithTransactions.add(itemId);
    });
    
    // Create opening stock entries
    const openingStockEntries = Array.from(itemsWithTransactions).map(itemId => {
      const openingStock = openingStockMap.get(itemId) || 0;
      const item = inwardEntries.find(e => (e.item?._id?.toString() || e.item?.toString()) === itemId)?.item;
      
      return {
        isOpeningStock: true,
        date: startDate,
        createdAt: startDate,
        challanNo: 'Opening stock',
        item: item || { _id: itemId, name: 'Unknown Item' },
        quantityReceived: openingStock,
        supplier: null,
        vehicleNumber: null,
        openingStock: openingStock
      };
    }).sort((a, b) => {
      const nameA = a.item?.name || '';
      const nameB = b.item?.name || '';
      return nameA.localeCompare(nameB);
    });

    // Mark regular entries
    const inwardWithOpening = inwardEntries.map(e => {
      return { ...e.toObject(), isAdjustment: false, isOpeningStock: false };
    });
    
    const adjustmentsWithOpening = adjustmentEntries.map(adj => {
      return { ...adj, isOpeningStock: false };
    });

    // Merge: Opening stock entries first, then regular entries sorted by date
    const regularEntries = [...inwardWithOpening, ...adjustmentsWithOpening].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateA.getTime() - dateB.getTime();
    });
    
    const detailedInward = [...openingStockEntries, ...regularEntries];

    const detailedOutward = await OutwardStock.find({ 
      date: { $gte: startDate, $lte: endDate },
      createdBy: req.user._id
    })
      .populate('customer', 'name')
      .sort({ date: 1, createdAt: 1 })
      .select('date challanNo customer okQty crQty mrQty asCastQty totalQty vehicleNumber');

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="monthly_report_${req.query.month}_${req.query.year}.pdf"`);
    doc.pipe(res);

    // Add company name as main heading
    doc.fontSize(20).text('OM ENGINEERING WORKS', { align: 'center' });
    doc.moveDown(0.5);
    
    const title = `STOCK STATEMENT - ${startDate.toLocaleString('default', { month: 'long' })} ${year}`;
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown();

    // Tables helper with visible borders
    const drawTable = (headers, rows, compact = false) => {
      const paddingX = compact ? 3 : 4;
      const paddingY = compact ? 2 : 4;
      const rowHeight = compact ? 12 : 16;
      const headerHeight = compact ? 14 : 18;
      const borderColor = '#444';
      const startX = 36; // left margin
      let y = doc.y + 8;

      // Compute column widths to fit page width
      const pageWidth = doc.page.width - 72; // total width inside margins
      const colCount = headers.length;
      const colWidths = Array(colCount).fill(Math.floor(pageWidth / colCount));
      colWidths[colCount - 1] = pageWidth - colWidths.slice(0, colCount - 1).reduce((a, b) => a + b, 0);

      const drawRowBorders = (yTop, height) => {
        doc.save().lineWidth(0.5).strokeColor(borderColor);
        doc.rect(startX, yTop, pageWidth, height).stroke();
        let x = startX;
        for (let i = 0; i < colCount - 1; i++) {
          x += colWidths[i];
          doc.moveTo(x, yTop).lineTo(x, yTop + height).stroke();
        }
        doc.restore();
      };

      const ensureSpace = (needed) => {
        if (y + needed > doc.page.height - 36) {
          doc.addPage();
          y = 36;
        }
      };

      // Header
      ensureSpace(headerHeight);
      doc.save().fontSize(compact ? 8 : 10);
      doc.save().fillColor('#f0f0f0').rect(startX, y, pageWidth, headerHeight).fill();
      drawRowBorders(y, headerHeight);
      let tx = startX;
      headers.forEach((h, i) => {
        doc.fillColor('#000').text(h, tx + paddingX, y + paddingY, { width: colWidths[i] - paddingX * 2 });
        tx += colWidths[i];
      });
      doc.restore();
      y += headerHeight;

      // Rows
      rows.forEach((r) => {
        ensureSpace(rowHeight);
        drawRowBorders(y, rowHeight);
        let cx = startX;
        doc.fontSize(compact ? 8 : 10);
        r.forEach((cell, i) => {
          const isNumeric = typeof cell === 'number';
          doc.fillColor('#000').text(String(cell ?? ''), cx + paddingX, y + paddingY, {
            width: colWidths[i] - paddingX * 2,
            align: isNumeric ? 'right' : 'left'
          });
          cx += colWidths[i];
        });
        y += rowHeight;
      });
      doc.moveDown();
    };

    // Summary section with side-by-side compact tables
    const inward = inwardSummary[0] || { totalEntries: 0, totalQuantity: 0, totalAmount: 0 };
    const outward = outwardSummary[0] || { totalEntries: 0, totalQuantity: 0, totalAmount: 0, totalOkQty: 0, totalCrQty: 0, totalMrQty: 0, totalAsCastQty: 0 };
    
    doc.moveDown();
    doc.fontSize(12).text('SUMMARY', { underline: true, align: 'center' });
    doc.moveDown(0.5);
    
    // Draw side-by-side tables
    const leftX = 36;
    const rightX = 310;
    const tableWidth = 250;
    const startY = doc.y;
    
    // Helper for side-by-side tables
    const drawSideBySideTable = (x, y, title, headers, rows, bgColor) => {
      const paddingX = 3;
      const paddingY = 2;
      const rowHeight = 12;
      const headerHeight = 14;
      const colWidth = tableWidth / 2;
      
      // Title
      doc.save();
      doc.fontSize(9).fillColor('#000').font('Helvetica-Bold');
      doc.rect(x, y, tableWidth, headerHeight).fillAndStroke(bgColor, '#444');
      doc.fillColor('#000').text(title, x, y + 3, { width: tableWidth, align: 'center' });
      doc.restore();
      y += headerHeight;
      
      // Headers
      doc.save();
      doc.fontSize(8).font('Helvetica-Bold');
      doc.rect(x, y, tableWidth, headerHeight).fillAndStroke('#f0f0f0', '#444');
      doc.moveTo(x + colWidth, y).lineTo(x + colWidth, y + headerHeight).stroke();
      doc.fillColor('#000').text(headers[0], x + paddingX, y + paddingY, { width: colWidth - paddingX * 2 });
      doc.text(headers[1], x + colWidth + paddingX, y + paddingY, { width: colWidth - paddingX * 2, align: 'right' });
      doc.restore();
      y += headerHeight;
      
      // Rows
      doc.fontSize(8).font('Helvetica');
      rows.forEach(([metric, value]) => {
        doc.rect(x, y, tableWidth, rowHeight).stroke('#444');
        doc.moveTo(x + colWidth, y).lineTo(x + colWidth, y + rowHeight).stroke();
        doc.fillColor('#000').text(metric, x + paddingX, y + paddingY, { width: colWidth - paddingX * 2 });
        doc.text(String(value), x + colWidth + paddingX, y + paddingY, { width: colWidth - paddingX * 2, align: 'right' });
        y += rowHeight;
      });
      
      return y;
    };
    
    // Inward Summary (Left)
    drawSideBySideTable(leftX, startY, 'INWARD SUMMARY', ['Metric', 'Value'], [
      ['Total Entries', inward.totalEntries],
      ['Total Quantity', inward.totalQuantity]
    ], '#D4EDDA');
    
    // Outward Summary (Right)
    drawSideBySideTable(rightX, startY, 'OUTWARD SUMMARY', ['Metric', 'Value'], [
      ['Total Entries', outward.totalEntries],
      ['Total Quantity', outward.totalQuantity],
      ['OK Quantity', outward.totalOkQty],
      ['CR Quantity', outward.totalCrQty],
      ['MR Quantity', outward.totalMrQty]
    ], '#FFF3CD');
    
    // Move down past the taller table
    doc.y = startY + (5 * 12) + 14 + 14 + 10; // outward rows + headers + title + margin

    doc.moveDown();
    doc.fontSize(12).text('INWARD TRANSACTIONS', 36, doc.y, { underline: true });
    
    // Helper to format date or show adjustment text
    const formatInwardRow = (t) => {
      const isAdjustment = t.isAdjustment === true;
      const isOpeningStock = t.isOpeningStock === true;
      const adjustmentQty = t.adjustmentQuantity || t.quantityReceived || 0;
      
      if (isOpeningStock) {
        // For opening stock: show date, "Opening stock" in Ch.No, opening quantity value
        const date = new Date(t.date);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return [`${day}/${month}/${year}`, t.challanNo || 'Opening stock', t.quantityReceived || t.openingStock || 0, '-'];
      } else if (isAdjustment) {
        // For adjustments: show "Adjusted Quantity" in date column, adjustment quantity in qty column
        return ['Adjusted Quantity', t.challanNo || 'ADJ', adjustmentQty, '-'];
      } else {
        // For regular entries: show date and quantity
        const date = new Date(t.date);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return [`${day}/${month}/${year}`, t.challanNo, t.quantityReceived, t.vehicleNumber || '-'];
      }
    };
    
    // Custom table drawing for inward with adjustment formatting
    const drawInwardTable = (headers, rows) => {
      const paddingX = 4;
      const paddingY = 4;
      const rowHeight = 16;
      const headerHeight = 18;
      const borderColor = '#444';
      const startX = 36;
      let y = doc.y + 8;
      const pageWidth = doc.page.width - 72;
      const colCount = headers.length;
      const colWidths = Array(colCount).fill(Math.floor(pageWidth / colCount));
      colWidths[colCount - 1] = pageWidth - colWidths.slice(0, colCount - 1).reduce((a, b) => a + b, 0);

      const drawRowBorders = (yTop, height) => {
        doc.save().lineWidth(0.5).strokeColor(borderColor);
        doc.rect(startX, yTop, pageWidth, height).stroke();
        let x = startX;
        for (let i = 0; i < colCount - 1; i++) {
          x += colWidths[i];
          doc.moveTo(x, yTop).lineTo(x, yTop + height).stroke();
        }
        doc.restore();
      };

      const ensureSpace = (needed) => {
        if (y + needed > doc.page.height - 36) {
          doc.addPage();
          y = 36;
        }
      };

      // Header
      ensureSpace(headerHeight);
      doc.save().fontSize(10);
      doc.save().fillColor('#f0f0f0').rect(startX, y, pageWidth, headerHeight).fill();
      drawRowBorders(y, headerHeight);
      let tx = startX;
      headers.forEach((h, i) => {
        doc.fillColor('#000').text(h, tx + paddingX, y + paddingY, { 
          width: colWidths[i] - paddingX * 2, 
          align: i === 2 ? 'right' : 'left' // Qty column (index 2) right-aligned
        });
        tx += colWidths[i];
      });
      doc.restore();
      y += headerHeight;

      // Rows
      rows.forEach((r, rowIdx) => {
        const t = detailedInward[rowIdx];
        const isAdjustment = t.isAdjustment === true;
        const isOpeningStock = t.isOpeningStock === true;
        ensureSpace(rowHeight);
        drawRowBorders(y, rowHeight);
        let cx = startX;
        doc.fontSize(10);
        r.forEach((cell, i) => {
          const isNumeric = typeof cell === 'number';
          const isAdjustmentQty = (isAdjustment && i === 2); // Qty column (index 2) for adjustments
          
          if (isAdjustmentQty) {
            // Format adjustment quantity with +/- sign
            const adjustmentQty = cell;
            const qtyText = adjustmentQty >= 0 ? `+${adjustmentQty}` : `${adjustmentQty}`;
            doc.fillColor(adjustmentQty >= 0 ? '#28a745' : '#dc3545').text(qtyText, cx + paddingX, y + paddingY, {
              width: colWidths[i] - paddingX * 2,
              align: 'right'
            });
          } else if (isOpeningStock && i === 2) {
            // Opening stock quantity: right-aligned, bold
            doc.fillColor('#000').font('Helvetica-Bold').text(String(cell ?? ''), cx + paddingX, y + paddingY, {
              width: colWidths[i] - paddingX * 2,
              align: 'right'
            });
            doc.font('Helvetica'); // Reset font
          } else {
            doc.fillColor('#000').text(String(cell ?? ''), cx + paddingX, y + paddingY, {
              width: colWidths[i] - paddingX * 2,
              align: isNumeric || i === 2 ? 'right' : 'left' // Qty column (index 2) right-aligned
            });
          }
          cx += colWidths[i];
        });
        y += rowHeight;
      });
      doc.y = y;
    };
    
    drawInwardTable(['DATE', 'CH.NO', 'QTY', 'VEHICLE NO'], detailedInward.map(formatInwardRow));

    doc.addPage();
    doc.fontSize(12).text('OUTWARD TRANSACTIONS', 36, doc.y, { underline: true });
    drawTable(['DATE', 'CH.NO', 'OK QTY', 'CR', 'MR', 'AS CAST', 'TOTAL', 'VEH NO'], detailedOutward.map(t => {
      const date = new Date(t.date);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return [`${day}/${month}/${year}`, t.challanNo, t.okQty, t.crQty, t.mrQty, t.asCastQty, t.totalQty, t.vehicleNumber || '-'];
    }));

    doc.end();
  } catch (error) {
    console.error('Export monthly pdf error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

