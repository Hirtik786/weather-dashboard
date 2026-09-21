const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

const authController = {
  async register(req, res) {
    try {
      const { email, password } = req.body || {};

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: 'A valid email address is required'
        });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      const existingUser = userModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists'
        });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const newUser = userModel.createUser({ email, passwordHash });

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      logger.info('User registered successfully', { userId: newUser.id, email: newUser.email });

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        token,
        user: {
          id: newUser.id,
          email: newUser.email
        }
      });
    } catch (err) {
      logger.error('Registration error', err);
      return res.status(500).json({
        success: false,
        message: 'Registration failed due to an internal server error'
      });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const user = userModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return res.json({
        success: true,
        message: 'Logged in successfully',
        token,
        user: {
          id: user.id,
          email: user.email
        }
      });
    } catch (err) {
      logger.error('Login error', err);
      return res.status(500).json({
        success: false,
        message: 'Login failed due to an internal server error'
      });
    }
  },

  me(req, res) {
    return res.json({
      success: true,
      user: req.user
    });
  },

  logout(req, res) {
    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
};

module.exports = authController;
