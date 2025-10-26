const mongoose = require('mongoose');

const inwardStockSchema = new mongoose.Schema({
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
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Supplier is required']
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'Item is required']
  },
  quantityReceived: {
    type: Number,
    required: [true, 'Quantity received is required'],
    min: [0.01, 'Quantity must be greater than 0']
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
inwardStockSchema.index({ date: -1 });
inwardStockSchema.index({ challanNo: 1 });
inwardStockSchema.index({ supplier: 1 });
inwardStockSchema.index({ item: 1 });
inwardStockSchema.index({ createdBy: 1 });

// Compound index for unique challan per supplier
inwardStockSchema.index({ challanNo: 1, supplier: 1 }, { unique: true });

// Pre-save middleware to calculate total amount
inwardStockSchema.pre('save', function(next) {
  if (this.rate && this.quantityReceived) {
    this.totalAmount = this.rate * this.quantityReceived;
  }
  next();
});

// Post-save middleware to update item stock
inwardStockSchema.post('save', async function() {
  try {
    const Item = mongoose.model('Item');
    await Item.findByIdAndUpdate(
      this.item,
      { $inc: { currentStock: this.quantityReceived } }
    );
  } catch (error) {
    console.error('Error updating item stock:', error);
  }
});

// Post-remove middleware to update item stock when deleting
inwardStockSchema.post('remove', async function() {
  try {
    const Item = mongoose.model('Item');
    await Item.findByIdAndUpdate(
      this.item,
      { $inc: { currentStock: -this.quantityReceived } }
    );
  } catch (error) {
    console.error('Error updating item stock on delete:', error);
  }
});

module.exports = mongoose.model('InwardStock', inwardStockSchema);
