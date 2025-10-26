const mongoose = require('mongoose');

const outwardStockSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  challanNo: {
    type: String,
    required: [true, 'Challan number is required'],
    trim: true,
    maxlength: [50, 'Challan number cannot exceed 50 characters']
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'Item is required']
  },
  okQty: {
    type: Number,
    required: [true, 'OK quantity is required'],
    min: [0, 'OK quantity cannot be negative']
  },
  crQty: {
    type: Number,
    default: 0,
    min: [0, 'CR quantity cannot be negative']
  },
  mrQty: {
    type: Number,
    default: 0,
    min: [0, 'MR quantity cannot be negative']
  },
  asCastQty: {
    type: Number,
    default: 0,
    min: [0, 'As Cast quantity cannot be negative']
  },
  totalQty: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    enum: ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'box', 'packet'],
    default: 'pcs'
  },
  rate: {
    type: Number,
    min: [0, 'Rate cannot be negative']
  },
  totalAmount: {
    type: Number,
    min: [0, 'Total amount cannot be negative']
  },
  crReason: {
    type: String,
    trim: true,
    maxlength: [500, 'CR reason cannot exceed 500 characters']
  },
  mrReason: {
    type: String,
    trim: true,
    maxlength: [500, 'MR reason cannot exceed 500 characters']
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
outwardStockSchema.index({ date: -1 });
outwardStockSchema.index({ challanNo: 1 });
outwardStockSchema.index({ customer: 1 });
outwardStockSchema.index({ item: 1 });
outwardStockSchema.index({ createdBy: 1 });

// Compound index for unique challan per customer
outwardStockSchema.index({ challanNo: 1, customer: 1 }, { unique: true });

// Pre-save middleware to calculate total quantity and amount
outwardStockSchema.pre('save', function(next) {
  // Calculate total quantity
  this.totalQty = this.okQty + this.crQty + this.mrQty + this.asCastQty;
  
  // Calculate total amount
  if (this.rate && this.totalQty) {
    this.totalAmount = this.rate * this.totalQty;
  }
  
  next();
});

// Pre-save middleware to validate stock availability
outwardStockSchema.pre('save', async function(next) {
  try {
    const Item = mongoose.model('Item');
    const item = await Item.findById(this.item);
    
    if (!item) {
      return next(new Error('Item not found'));
    }
    
    if (item.currentStock < this.totalQty) {
      return next(new Error(`Insufficient stock. Available: ${item.currentStock}, Required: ${this.totalQty}`));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Post-save middleware to update item stock
outwardStockSchema.post('save', async function() {
  try {
    const Item = mongoose.model('Item');
    await Item.findByIdAndUpdate(
      this.item,
      { $inc: { currentStock: -this.totalQty } }
    );
  } catch (error) {
    console.error('Error updating item stock:', error);
  }
});

// Post-remove middleware to update item stock when deleting
outwardStockSchema.post('remove', async function() {
  try {
    const Item = mongoose.model('Item');
    await Item.findByIdAndUpdate(
      this.item,
      { $inc: { currentStock: this.totalQty } }
    );
  } catch (error) {
    console.error('Error updating item stock on delete:', error);
  }
});

module.exports = mongoose.model('OutwardStock', outwardStockSchema);
