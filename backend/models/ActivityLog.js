const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: [
      'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE',
      'ITEM_CREATE', 'ITEM_UPDATE', 'ITEM_DELETE',
      'SUPPLIER_CREATE', 'SUPPLIER_UPDATE', 'SUPPLIER_DELETE',
      'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
      'INWARD_CREATE', 'INWARD_UPDATE', 'INWARD_DELETE',
      'OUTWARD_CREATE', 'OUTWARD_UPDATE', 'OUTWARD_DELETE',
      'REPORT_GENERATE', 'EXPORT_EXCEL', 'EXPORT_PDF'
    ]
  },
  entity: {
    type: String,
    enum: ['User', 'Item', 'Supplier', 'Customer', 'InwardStock', 'OutwardStock', 'Report']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better performance
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ entity: 1, entityId: 1 });
activityLogSchema.index({ createdAt: -1 });

// Static method to log activity
activityLogSchema.statics.logActivity = async function(userId, action, entity, entityId, description, req = null) {
  const logData = {
    user: userId,
    action,
    entity,
    entityId,
    description
  };

  if (req) {
    logData.ipAddress = req.ip || req.connection.remoteAddress;
    logData.userAgent = req.get('User-Agent');
  }

  return await this.create(logData);
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
