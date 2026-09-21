const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { getCachedUserSession, cacheUserSession } = require('../services/redisService');

const JWT_SECRET = process.env.JWT_SECRET || 'weather-dashboard-default-dev-jwt-secret';

async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    // 1. Check Redis session cache first for fast lookup
    const cachedUser = await getCachedUserSession(token);
    if (cachedUser) {
      req.user = cachedUser;
      req.token = token;
      return next();
    }

    // 2. Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = userModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session or user not found'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name || null,
      amazon_user_id: user.amazon_user_id || null,
      auth_provider: user.auth_provider || 'local'
    };
    req.token = token;

    // Cache in Redis for 7 days
    await cacheUserSession(token, req.user);

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token'
    });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const cachedUser = await getCachedUserSession(token);
    if (cachedUser) {
      req.user = cachedUser;
      req.token = token;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = userModel.findById(decoded.id);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name || null,
        amazon_user_id: user.amazon_user_id || null,
        auth_provider: user.auth_provider || 'local'
      };
      req.token = token;
      await cacheUserSession(token, req.user);
    }
  } catch {
    // Ignore optional auth failure
  }
  next();
}

module.exports = {
  authenticateUser,
  optionalAuth,
  JWT_SECRET
};
