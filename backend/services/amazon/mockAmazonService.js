const crypto = require('crypto');
const AmazonServiceInterface = require('./amazonInterface');
const logger = require('../../utils/logger');

// Per-user simulation mode: 'NONE' | 'AMAZON_FAIL' | 'SENDBOX_FAIL' | 'BOTH_FAIL'
const simulationModes = new Map();

class MockAmazonService extends AmazonServiceInterface {
  setSimulationMode(userId, mode) {
    const validModes = ['NONE', 'AMAZON_FAIL', 'SENDBOX_FAIL', 'BOTH_FAIL'];
    const selectedMode = validModes.includes(mode) ? mode : 'NONE';
    simulationModes.set(userId, selectedMode);
    logger.info('Amazon simulation mode updated', { userId, mode: selectedMode });
    return selectedMode;
  }

  getSimulationMode(userId) {
    return simulationModes.get(userId) || 'NONE';
  }

  async getAuthUrl(state, options = {}) {
    logger.info('Generating mock Amazon authorization URL', { state });
    return {
      authUrl: `/amazon.html?mock_oauth=true&state=${encodeURIComponent(state)}`,
      mode: 'mock',
      provider: 'Amazon Seller Central (Development Demo)'
    };
  }

  async exchangeAuthCode(code, options = {}) {
    const userId = options.userId || 'USER-DEV';
    logger.info('Simulating Amazon OAuth token exchange', { userId });

    // Generate clearly identifiable mock seller identifiers
    const sellerSuffix = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'DEMO01';
    const sellerId = `MOCK-SELLER-${sellerSuffix}`;
    const marketplaceId = 'ATVPDKIKX0DER-MOCK';

    return {
      sellerId,
      marketplaceId,
      region: 'na',
      mode: 'mock',
      status: 'CONNECTED',
      // In mock mode, we deliberately do NOT generate real tokens
      refreshToken: null,
      accessToken: null
    };
  }

  async createListing(connection, product) {
    const userId = connection.user_id;
    const simMode = this.getSimulationMode(userId);

    logger.info('Mock Amazon createListing called', {
      userId,
      sku: product.sku,
      simMode
    });

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (simMode === 'AMAZON_FAIL' || simMode === 'BOTH_FAIL') {
      logger.warn('Mock Amazon simulating listing failure', { userId, sku: product.sku });
      return {
        success: false,
        status: 'ERROR',
        error: 'Amazon SP-API Error [500]: Simulated internal Listings Items API failure'
      };
    }

    const listingId = `MOCK-LST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const asin = `B0MOCK${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    return {
      success: true,
      listingId,
      sku: product.sku,
      asin,
      status: 'LISTED',
      marketplace: 'Mock Marketplace (US)',
      syncedAt: new Date().toISOString()
    };
  }

  async updateListing(connection, listingId, updates) {
    const userId = connection.user_id;
    const simMode = this.getSimulationMode(userId);

    logger.info('Mock Amazon updateListing called', { userId, listingId, simMode });
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (simMode === 'AMAZON_FAIL' || simMode === 'BOTH_FAIL') {
      return {
        success: false,
        error: 'Amazon SP-API Error [500]: Simulated listing update failure'
      };
    }

    return {
      success: true,
      listingId,
      status: 'LISTED',
      updatedAt: new Date().toISOString()
    };
  }

  async deleteListing(connection, listingId) {
    const userId = connection.user_id;
    const simMode = this.getSimulationMode(userId);

    logger.info('Mock Amazon deleteListing called', { userId, listingId });
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (simMode === 'AMAZON_FAIL' || simMode === 'BOTH_FAIL') {
      return {
        success: false,
        error: 'Amazon SP-API Error [500]: Simulated listing deactivation failure'
      };
    }

    return {
      success: true,
      listingId,
      status: 'DELETED'
    };
  }

  async getListing(connection, listingId) {
    return {
      listingId,
      status: 'LISTED',
      marketplace: 'Mock Marketplace (US)',
      isMock: true
    };
  }
}

module.exports = new MockAmazonService();
