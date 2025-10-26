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
// @access  Private
router.get('/stock-statement', [
  protect,
  authorize('admin'),
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
            $lte: ['$currentStock', '$minimumStock']
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
// @access  Private
router.get('/monthly', [
  protect,
  authorize('admin'),
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

    let detailedInward = null;
    let detailedOutward = null;

    if (includeDetails) {
      // Get detailed inward entries
      detailedInward = await InwardStock.find({
        date: { $gte: startDate, $lte: endDate }
      })
      .populate('supplier', 'name contactPerson')
      .populate('item', 'name category unit')
      .populate('createdBy', 'name')
      .sort({ date: 1, createdAt: 1 })
      .select('date challanNo supplier item quantityReceived unit rate totalAmount remarks createdBy');

      // Get detailed outward entries
      detailedOutward = await OutwardStock.find({
        date: { $gte: startDate, $lte: endDate }
      })
      .populate('customer', 'name contactPerson')
      .populate('item', 'name category unit')
      .populate('createdBy', 'name')
      .sort({ date: 1, createdAt: 1 })
      .select('date challanNo customer item okQty crQty mrQty asCastQty totalQty unit rate totalAmount crReason mrReason remarks createdBy');
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
        itemBreakdown,
        detailedInward,
        detailedOutward
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
// @access  Private
router.get('/item-history', [
  protect,
  authorize('admin'),
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
    .select('date challanNo supplier quantityReceived unit rate totalAmount remarks createdBy');

    // Get outward transactions
    const outwardTransactions = await OutwardStock.find({
      item: itemId,
      ...dateFilter
    })
    .populate('customer', 'name contactPerson')
    .populate('createdBy', 'name')
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .select('date challanNo customer okQty crQty mrQty asCastQty totalQty unit rate totalAmount crReason mrReason remarks createdBy');

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
// @access  Private
router.get('/supplier-performance', [
  protect,
  authorize('admin'),
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
// @access  Private
router.get('/customer-performance', [
  protect,
  authorize('admin'),
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
  authorize('admin'),
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
        const detailedInward = await InwardStock.find({ date: { $gte: startDate, $lte: endDate } })
          .populate('supplier', 'name')
          .populate('item', 'name')
          .sort({ date: 1, createdAt: 1 })
          .select('date challanNo supplier item quantityReceived unit rate totalAmount remarks');
        const detailedOutward = await OutwardStock.find({ date: { $gte: startDate, $lte: endDate } })
          .populate('customer', 'name')
          .populate('item', 'name')
          .sort({ date: 1, createdAt: 1 })
          .select('date challanNo customer item okQty crQty mrQty asCastQty totalQty unit rate totalAmount remarks');

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
  authorize('admin'),
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

    const detailedInward = await InwardStock.find({ 
      date: { $gte: startDate, $lte: endDate },
      createdBy: req.user._id
    })
      .populate('supplier', 'name')
      .sort({ date: 1, createdAt: 1 })
      .select('date challanNo supplier quantityReceived totalAmount');
    const detailedOutward = await OutwardStock.find({ 
      date: { $gte: startDate, $lte: endDate },
      createdBy: req.user._id
    })
      .populate('customer', 'name')
      .sort({ date: 1, createdAt: 1 })
      .select('date challanNo customer okQty crQty mrQty asCastQty totalQty');

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

    // Summary section
    doc.fontSize(12).text('SUMMARY', { underline: true });
    const inward = inwardSummary[0] || { totalEntries: 0, totalQuantity: 0, totalAmount: 0 };
    const outward = outwardSummary[0] || { totalEntries: 0, totalQuantity: 0, totalAmount: 0, totalOkQty: 0, totalCrQty: 0, totalMrQty: 0, totalAsCastQty: 0 };
    doc.moveDown(0.5);
    doc.text(`Inward - Entries: ${inward.totalEntries}, Qty: ${inward.totalQuantity}, Amount: ${inward.totalAmount}`);
    doc.text(`Outward - Entries: ${outward.totalEntries}, Qty: ${outward.totalQuantity}, OK: ${outward.totalOkQty}, CR: ${outward.totalCrQty}, MR: ${outward.totalMrQty}, As Cast: ${outward.totalAsCastQty}, Amount: ${outward.totalAmount}`);

    // Tables helper with visible borders
    const drawTable = (headers, rows) => {
      const paddingX = 4;
      const paddingY = 4;
      const rowHeight = 16;
      const headerHeight = 18;
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
      doc.save().fontSize(10);
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

    doc.moveDown();
    doc.fontSize(12).text('INWARD', { underline: true });
    drawTable(['DATE', 'CH.NO', 'QTY', 'TOTAL'], detailedInward.map(t => {
      const date = new Date(t.date);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return [`${day}/${month}/${year}`, t.challanNo, t.quantityReceived, t.totalAmount ?? '-'];
    }));

    doc.addPage();
    doc.fontSize(12).text('OUTWARD', { underline: true });
    drawTable(['DATE', 'CH.NO', 'OK QTY', 'CR', 'MR', 'AS CAST', 'TOTAL'], detailedOutward.map(t => {
      const date = new Date(t.date);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return [`${day}/${month}/${year}`, t.challanNo, t.okQty, t.crQty, t.mrQty, t.asCastQty, t.totalQty];
    }));

    doc.end();
  } catch (error) {
    console.error('Export monthly pdf error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

