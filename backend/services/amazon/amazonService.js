const mockAmazonService = require('./mockAmazonService');
const realAmazonService = require('./realAmazonService');
const logger = require('../../utils/logger');

/**
 * Amazon Service Facade
 * Cleanly switches between Mock and Real implementations based on AMAZON_MODE.
 */
class AmazonService {
  getMode() {
    return (process.env.AMAZON_MODE || 'mock').toLowerCase();
  }

  getService() {
    const mode = this.getMode();
    if (mode === 'real') {
      return realAmazonService;
    }
    return mockAmazonService;
  }

  async getAuthUrl(state, options = {}) {
    return this.getService().getAuthUrl(state, options);
  }

  async exchangeAuthCode(code, options = {}) {
    return this.getService().exchangeAuthCode(code, options);
  }

  async createListing(connection, product) {
    return this.getService().createListing(connection, product);
  }

  async updateListing(connection, listingId, updates) {
    return this.getService().updateListing(connection, listingId, updates);
  }

  async deleteListing(connection, listingId) {
    return this.getService().deleteListing(connection, listingId);
  }

  async getListing(connection, listingId) {
    return this.getService().getListing(connection, listingId);
  }

  setSimulationMode(userId, mode) {
    return mockAmazonService.setSimulationMode(userId, mode);
  }

  getSimulationMode(userId) {
    return mockAmazonService.getSimulationMode(userId);
  }
}

module.exports = new AmazonService();
