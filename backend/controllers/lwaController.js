const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const lwaService = require('../services/amazon/lwaService');
const userModel = require('../models/userModel');
const { cacheUserSession, invalidateUserSession } = require('../services/redisService');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const TOKEN_EXPIRY = '7d';

const lwaController = {
  /**
   * Initiates Login with Amazon OAuth 2.0 flow.
   * GET /api/auth/amazon/login
   */
  initiateLogin(req, res) {
    const state = crypto.randomBytes(16).toString('hex');
    const authData = lwaService.getAuthorizationUrl(state);

    if (!authData.configured) {
      // If frontend asks for JSON
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          configured: false,
          message: authData.message,
          setupInstructions: {
            step1: 'Sign in to https://developer.amazon.com with your Amazon account.',
            step2: 'Navigate to Login with Amazon and create a Security Profile.',
            step3: 'Set Allowed Return URLs to: ' + lwaService.getRedirectUri(),
            step4: 'Add LWA_CLIENT_ID and LWA_CLIENT_SECRET to your backend/.env file.'
          }
        });
      }
      return res.redirect('/amazon.html?config_error=credentials_missing');
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        configured: true,
        authUrl: authData.authUrl,
        state
      });
    }

    return res.redirect(authData.authUrl);
  },

  /**
   * Handles official Amazon OAuth 2.0 callback redirect.
   * GET /api/auth/amazon/callback
   */
  async handleCallback(req, res) {
    const { code, error, error_description } = req.query;

    if (error) {
      logger.warn('Amazon OAuth callback returned error', { error, error_description });
      return res.redirect(`/amazon.html?error=${encodeURIComponent(error_description || error)}`);
    }

    if (!code) {
      logger.warn('Amazon OAuth callback missing authorization code');
      return res.redirect('/amazon.html?error=missing_authorization_code');
    }

    try {
      // 1. Exchange authorization code for tokens
      const tokens = await lwaService.exchangeCodeForTokens(code);

      // 2. Fetch customer profile from https://api.amazon.com/user/profile
      const profile = await lwaService.getAmazonProfile(tokens.accessToken);

      logger.info('Amazon customer profile retrieved successfully', {
        amazonUserId: profile.amazonUserId,
        name: profile.name
      });

      // 3. Upsert into application database
      const user = userModel.upsertAmazonUser(profile);

      // 4. Issue application JWT session token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          amazon_user_id: user.amazon_user_id
        },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      // 5. Cache user session in Redis (if online)
      await cacheUserSession(token, {
        id: user.id,
        email: user.email,
        name: user.name,
        amazon_user_id: user.amazon_user_id,
        auth_provider: 'amazon'
      });

      // 6. Redirect back to frontend with session token
      return res.redirect(`/amazon.html?auth_token=${encodeURIComponent(token)}&auth_provider=amazon`);
    } catch (err) {
      logger.error('Amazon OAuth callback processing failed', err);
      return res.redirect(`/amazon.html?error=${encodeURIComponent(err.message || 'Amazon login failed')}`);
    }
  },

  /**
   * Returns current Amazon authentication status and LWA configuration state.
   * GET /api/auth/amazon/status (or /api/amazon/status)
   */
  getStatus(req, res) {
    const isConfigured = lwaService.isConfigured();
    const user = req.user;

    const isConnectedWithAmazon = Boolean(user && user.amazon_user_id);

    return res.json({
      success: true,
      configured: isConfigured,
      redirectUri: lwaService.getRedirectUri(),
      connected: isConnectedWithAmazon,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name || (user.email ? user.email.split('@')[0] : 'User'),
            amazonUserId: user.amazon_user_id || null,
            authProvider: user.auth_provider || 'local'
          }
        : null
    });
  },

  /**
   * Disconnects Amazon session.
   * POST /api/auth/amazon/disconnect
   */
  async disconnect(req, res) {
    const token = req.token;
    if (token) {
      await invalidateUserSession(token);
    }
    return res.json({
      success: true,
      message: 'Amazon account disconnected successfully'
    });
  }
};

module.exports = lwaController;
