const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
      const decoded = jwt.verify(token, secret);
      
      // Get user from token
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No user found with this token'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      if (user.isLocked) {
        return res.status(401).json({
          success: false,
          message: 'User account is locked due to multiple failed login attempts'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Log activity middleware
const logActivity = (action, entity, getEntityId = null) => {
  return async (req, res, next) => {
    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to log after response
    res.json = function(data) {
      // Log activity if request was successful
      if (data.success !== false) {
        const entityId = getEntityId ? getEntityId(req, data) : req.params.id;
        const description = generateDescription(action, entity, req, data);
        
        ActivityLog.logActivity(
          req.user._id,
          action,
          entity,
          entityId,
          description,
          req
        ).catch(err => console.error('Error logging activity:', err));
      }
      
      // Call original json method
      originalJson.call(this, data);
    };
    
    next();
  };
};

// Generate description for activity log
const generateDescription = (action, entity, req, data) => {
  const userName = req.user.name;
  const entityName = data.data?.name || data.data?.challanNo || req.params.id;
  
  switch (action) {
    case 'LOGIN':
      return `${userName} logged in successfully`;
    case 'LOGOUT':
      return `${userName} logged out`;
    case 'PASSWORD_CHANGE':
      return `${userName} changed their password`;
    case 'ITEM_CREATE':
      return `${userName} created new item: ${entityName}`;
    case 'ITEM_UPDATE':
      return `${userName} updated item: ${entityName}`;
    case 'ITEM_DELETE':
      return `${userName} deleted item: ${entityName}`;
    case 'SUPPLIER_CREATE':
      return `${userName} created new supplier: ${entityName}`;
    case 'SUPPLIER_UPDATE':
      return `${userName} updated supplier: ${entityName}`;
    case 'SUPPLIER_DELETE':
      return `${userName} deleted supplier: ${entityName}`;
    case 'CUSTOMER_CREATE':
      return `${userName} created new customer: ${entityName}`;
    case 'CUSTOMER_UPDATE':
      return `${userName} updated customer: ${entityName}`;
    case 'CUSTOMER_DELETE':
      return `${userName} deleted customer: ${entityName}`;
    case 'INWARD_CREATE':
      return `${userName} created inward stock entry: ${entityName}`;
    case 'INWARD_UPDATE':
      return `${userName} updated inward stock entry: ${entityName}`;
    case 'INWARD_DELETE':
      return `${userName} deleted inward stock entry: ${entityName}`;
    case 'OUTWARD_CREATE':
      return `${userName} created outward stock entry: ${entityName}`;
    case 'OUTWARD_UPDATE':
      return `${userName} updated outward stock entry: ${entityName}`;
    case 'OUTWARD_DELETE':
      return `${userName} deleted outward stock entry: ${entityName}`;
    case 'REPORT_GENERATE':
      return `${userName} generated ${entity} report`;
    case 'EXPORT_EXCEL':
      return `${userName} exported ${entity} data to Excel`;
    case 'EXPORT_PDF':
      return `${userName} exported ${entity} data to PDF`;
    default:
      return `${userName} performed ${action} on ${entity}`;
  }
};

module.exports = {
  protect,
  authorize,
  logActivity
};
