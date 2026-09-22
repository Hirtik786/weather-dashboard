const mockSendboxService = require('./mockSendboxService');
const realSendboxService = require('./realSendboxService');
const logger = require('../../utils/logger');

/**
 * Sendbox Service Facade
 * Cleanly switches between Mock and Real implementations based on SENDBOX_MODE.
 * Retains SENDBOX_MODE=mock as fallback. Use SENDBOX_MODE=real for the live API.
 */
class SendboxService {
  /**
   * Returns current active mode ('real' or 'mock')
   */
  getMode() {
    return (process.env.SENDBOX_MODE || 'mock').toLowerCase();
  }

  /**
   * Returns active service instance based on mode
   */
  getService() {
    const mode = this.getMode();
    if (mode === 'real') {
      return realSendboxService;
    }
    return mockSendboxService;
  }

  /**
   * Gets Sendbox status
   */
  async getStatus(userId) {
    return this.getService().getStatus(userId);
  }

  /**
   * Synchronizes product fulfillment on Sendbox
   */
  async createProduct(userId, product) {
    return this.getService().createProduct(userId, product);
  }

  /**
   * Updates an existing product/shipment in Sendbox
   */
  async updateProduct(userId, sendboxIdentifier, updates) {
    return this.getService().updateProduct(userId, sendboxIdentifier, updates);
  }

  /**
   * Deactivates or cancels a shipment on Sendbox
   */
  async deleteProduct(userId, sendboxIdentifier) {
    return this.getService().deleteProduct(userId, sendboxIdentifier);
  }

  /**
   * Diagnostic verification for a resource / SKU / shipment on Sendbox
   */
  async verifyResource(identifier) {
    return this.getService().verifyResource(identifier);
  }
}

module.exports = new SendboxService();
