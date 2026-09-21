const crypto = require('crypto');
const SendboxServiceInterface = require('./sendboxInterface');
const mockAmazonService = require('../amazon/mockAmazonService');
const logger = require('../../utils/logger');

class MockSendboxService extends SendboxServiceInterface {
  async createProduct(userId, product) {
    const simMode = mockAmazonService.getSimulationMode(userId);
    logger.info('Mock Sendbox createProduct called', { userId, sku: product.sku, simMode });

    await new Promise((resolve) => setTimeout(resolve, 120));

    if (simMode === 'SENDBOX_FAIL' || simMode === 'BOTH_FAIL') {
      logger.warn('Mock Sendbox simulating creation failure', { userId, sku: product.sku });
      return {
        success: false,
        status: 'ERROR',
        error: 'Sendbox Mock API Error [502]: Simulated inventory registration failure'
      };
    }

    const sendboxProductId = `SND-MOCK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    return {
      success: true,
      sendboxProductId,
      status: 'SYNCED',
      syncedAt: new Date().toISOString()
    };
  }

  async updateProduct(userId, sendboxProductId, updates) {
    const simMode = mockAmazonService.getSimulationMode(userId);
    logger.info('Mock Sendbox updateProduct called', { userId, sendboxProductId, simMode });

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (simMode === 'SENDBOX_FAIL' || simMode === 'BOTH_FAIL') {
      return {
        success: false,
        error: 'Sendbox Mock API Error [500]: Simulated update failure'
      };
    }

    return {
      success: true,
      sendboxProductId,
      status: 'SYNCED',
      updatedAt: new Date().toISOString()
    };
  }

  async deleteProduct(userId, sendboxProductId) {
    logger.info('Mock Sendbox deleteProduct called', { userId, sendboxProductId });
    await new Promise((resolve) => setTimeout(resolve, 80));

    return {
      success: true,
      sendboxProductId,
      status: 'DEACTIVATED'
    };
  }

  async getStatus(userId) {
    return {
      connected: true,
      status: 'Demo Connected',
      mode: 'mock',
      accountNumber: `SND-ACC-${userId.slice(-6).toUpperCase()}`,
      provider: 'Sendbox (Development Demo)'
    };
  }
}

module.exports = new MockSendboxService();
