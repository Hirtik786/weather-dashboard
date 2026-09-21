const mockSendboxService = require('./mockSendboxService');
const logger = require('../../utils/logger');

const SENDBOX_BOUNDARY_MESSAGE = `Sendbox integration is currently running in MOCK mode.

To enable the real integration, I need:
- Official Sendbox API documentation
- Authentication method
- Base API URL
- Product endpoints
- Product request schemas
- Product response schemas
- Update/delete behavior
- Required credentials/environment variables
- Webhook documentation if synchronization uses webhooks`;

class SendboxService {
  getMode() {
    return (process.env.SENDBOX_MODE || 'mock').toLowerCase();
  }

  getBoundaryDocumentationNotice() {
    return SENDBOX_BOUNDARY_MESSAGE;
  }

  async getStatus(userId) {
    const mode = this.getMode();
    if (mode === 'real') {
      return {
        connected: false,
        status: 'Awaiting Documentation',
        mode: 'real',
        notice: SENDBOX_BOUNDARY_MESSAGE
      };
    }
    const status = await mockSendboxService.getStatus(userId);
    return {
      ...status,
      notice: SENDBOX_BOUNDARY_MESSAGE
    };
  }

  async createProduct(userId, product) {
    const mode = this.getMode();
    if (mode === 'real') {
      logger.warn('Sendbox real mode called without official documentation');
      return {
        success: false,
        error: 'Sendbox real mode cannot be executed without official API documentation and endpoints.'
      };
    }
    return mockSendboxService.createProduct(userId, product);
  }

  async updateProduct(userId, sendboxProductId, updates) {
    const mode = this.getMode();
    if (mode === 'real') {
      return {
        success: false,
        error: 'Sendbox real mode cannot be executed without official API documentation.'
      };
    }
    return mockSendboxService.updateProduct(userId, sendboxProductId, updates);
  }

  async deleteProduct(userId, sendboxProductId) {
    const mode = this.getMode();
    if (mode === 'real') {
      return {
        success: false,
        error: 'Sendbox real mode cannot be executed without official API documentation.'
      };
    }
    return mockSendboxService.deleteProduct(userId, sendboxProductId);
  }
}

module.exports = new SendboxService();
