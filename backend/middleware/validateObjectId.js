const mongoose = require('mongoose');

// Middleware to validate MongoDB ObjectId
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format. Please provide a valid ID.`
      });
    }
    
    next();
  };
};

// Middleware to validate multiple ObjectIds in request body
const validateBodyObjectIds = (fields = []) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const field of fields) {
      if (req.body[field] && !mongoose.Types.ObjectId.isValid(req.body[field])) {
        errors.push({
          field,
          message: `Invalid ${field} format. Please provide a valid ID.`
        });
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
        errors
      });
    }
    
    next();
  };
};

module.exports = {
  validateObjectId,
  validateBodyObjectIds
};

