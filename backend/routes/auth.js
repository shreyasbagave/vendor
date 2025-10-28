const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, logActivity } = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('username').notEmpty().trim().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    console.log('🔐 Login attempt for username:', req.body.username);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Login validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Check for user by username or email
    const user = await User.findOne({ 
      $or: [
        { name: username },
        { email: username }
      ]
    }).select('+password');

    if (!user) {
      console.log('❌ User not found for username:', username);
      return res.status(401).json({
        success: false,
        message: 'Username or password is wrong'
      });
    }
    
    console.log('✅ User found:', { id: user._id, name: user.name, email: user.email });

    // Check if account is locked
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Account is locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Username or password is wrong'
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Log login activity
    const ActivityLog = require('../models/ActivityLog');
    await ActivityLog.logActivity(
      user._id,
      'LOGIN',
      'User',
      user._id,
      `${user.name} logged in successfully`,
      req
    );

    // Create token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (you may want to restrict in production)
router.post('/register', [
  body('username').notEmpty().trim().withMessage('Username is required'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    console.log('📝 Registration attempt with data:', { 
      username: req.body.username, 
      email: req.body.email, 
      hasPassword: !!req.body.password,
      bodyKeys: Object.keys(req.body)
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { username, email, password } = req.body;

    // Check if username or email already exists
    const existing = await User.findOne({ 
      $or: [
        { name: username },
        { email: email }
      ]
    });
    if (existing) {
      console.log('❌ User already exists:', { 
        requestedUsername: username, 
        requestedEmail: email,
        existingName: existing.name,
        existingEmail: existing.email
      });
      return res.status(400).json({
        success: false,
        message: 'User already exists with this username or email'
      });
    }

    const user = await User.create({ name: username, email, password, role: 'admin' });
    console.log('✅ User created successfully:', { id: user._id, name: user.name, email: user.email });

    const token = generateToken(user._id);

    // Optional: Log activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.logActivity(user._id, 'REGISTER', 'User', user._id, `${user.name} registered`, req);
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin
        }
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

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
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', [
  protect,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log password change activity
    const ActivityLog = require('../models/ActivityLog');
    await ActivityLog.logActivity(
      user._id,
      'PASSWORD_CHANGE',
      'User',
      user._id,
      `${user.name} changed their password`,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, logActivity('LOGOUT', 'User'), async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
