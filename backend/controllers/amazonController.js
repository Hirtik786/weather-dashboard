const crypto = require('crypto');
const amazonService = require('../services/amazon/amazonService');
const amazonConnectionModel = require('../models/amazonConnectionModel');
const { encrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const amazonController = {
  getStatus(req, res) {
    try {
      const userId = req.user.id;
      const connection = amazonConnectionModel.findByUserId(userId);
      const mode = amazonService.getMode();
      const simMode = amazonService.getSimulationMode(userId);

      const isConnected = connection && connection.status === 'CONNECTED';

      return res.json({
        success: true,
        mode,
        isMock: mode === 'mock',
        connected: isConnected,
        connection: isConnected
          ? {
              sellerId: connection.seller_id,
              marketplaceId: connection.marketplace_id,
              region: connection.region,
              status: connection.status,
              mode: connection.mode,
              connectedAt: connection.created_at
            }
          : null,
        simulationMode: simMode
      });
    } catch (err) {
      logger.error('Error fetching Amazon status', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve Amazon connection status'
      });
    }
  },

  async connect(req, res) {
    try {
      const userId = req.user.id;
      const state = crypto.randomBytes(16).toString('hex');

      const authData = await amazonService.getAuthUrl(state, { userId });
      return res.json({
        success: true,
        ...authData,
        state
      });
    } catch (err) {
      logger.error('Error generating Amazon auth URL', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to initiate Amazon connection'
      });
    }
  },

  async callback(req, res) {
    try {
      const userId = req.user.id;
      const { code, state, sellerId, marketplaceId } = req.body || {};

      const result = await amazonService.exchangeAuthCode(code, {
        userId,
        sellerId,
        marketplaceId
      });

      // Encrypt real tokens if present
      const refreshTokenEncrypted = result.refreshToken ? encrypt(result.refreshToken) : null;
      const accessTokenEncrypted = result.accessToken ? encrypt(result.accessToken) : null;

      const connection = amazonConnectionModel.upsertConnection({
        userId,
        sellerId: result.sellerId,
        marketplaceId: result.marketplaceId,
        region: result.region || 'na',
        status: 'CONNECTED',
        mode: result.mode,
        refreshTokenEncrypted,
        accessTokenEncrypted,
        tokenExpiresAt: result.tokenExpiresAt
      });

      logger.info('Amazon connection saved successfully', { userId, sellerId: result.sellerId });

      return res.json({
        success: true,
        message: result.mode === 'mock'
          ? 'Demo Amazon account connected successfully'
          : 'Amazon Seller account connected successfully',
        connection: {
          sellerId: connection.seller_id,
          marketplaceId: connection.marketplace_id,
          region: connection.region,
          status: connection.status,
          mode: connection.mode
        }
      });
    } catch (err) {
      logger.error('Amazon OAuth callback error', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to complete Amazon connection'
      });
    }
  },

  disconnect(req, res) {
    try {
      const userId = req.user.id;
      amazonConnectionModel.disconnect(userId);

      logger.info('Amazon account disconnected', { userId });
      return res.json({
        success: true,
        message: 'Amazon account disconnected successfully'
      });
    } catch (err) {
      logger.error('Error disconnecting Amazon', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to disconnect Amazon account'
      });
    }
  },

  setSimulation(req, res) {
    try {
      const userId = req.user.id;
      const { mode } = req.body || {};
      const activeMode = amazonService.setSimulationMode(userId, mode);

      return res.json({
        success: true,
        simulationMode: activeMode
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update simulation mode'
      });
    }
  }
};

module.exports = amazonController;
