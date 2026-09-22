const crypto = require('crypto');
const SendboxServiceInterface = require('./sendboxInterface');
const mockAmazonService = require('../amazon/mockAmazonService');
const logger = require('../../utils/logger');

class MockSendboxService extends SendboxServiceInterface {
  constructor() {
    super();
    this.mockShipments = new Map();
  }

  async createProduct(userId, product) {
    const simMode = mockAmazonService.getSimulationMode(userId);
    logger.info('Mock Sendbox createProduct called', { userId, sku: product.sku, simMode });

    await new Promise((resolve) => setTimeout(resolve, 80));

    if (simMode === 'SENDBOX_FAIL' || simMode === 'BOTH_FAIL') {
      logger.warn('Mock Sendbox simulating creation failure', { userId, sku: product.sku });
      return {
        success: false,
        status: 'ERROR',
        error: 'Sendbox Mock API Error [502]: Simulated inventory registration failure'
      };
    }

    const sendboxShipmentId = `SND-SHP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const sendboxOrderId = `SND-ORD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    this.mockShipments.set(sendboxShipmentId, {
      code: sendboxShipmentId,
      orderId: sendboxOrderId,
      sku: product.sku,
      title: product.title,
      price: product.price,
      quantity: product.quantity,
      userId,
      status: 'drafted'
    });

    return {
      success: true,
      sendboxShipmentId,
      sendboxOrderId,
      sendboxProductId: null,
      status: 'SYNCED',
      syncedAt: new Date().toISOString()
    };
  }

  async updateProduct(userId, sendboxIdentifier, updates) {
    const simMode = mockAmazonService.getSimulationMode(userId);
    logger.info('Mock Sendbox updateProduct called', { userId, sendboxIdentifier, simMode });

    await new Promise((resolve) => setTimeout(resolve, 60));

    if (simMode === 'SENDBOX_FAIL' || simMode === 'BOTH_FAIL') {
      return {
        success: false,
        error: 'Sendbox Mock API Error [500]: Simulated update failure'
      };
    }

    return {
      success: true,
      sendboxShipmentId: sendboxIdentifier,
      sendboxProductId: null,
      status: 'SYNCED',
      updatedAt: new Date().toISOString()
    };
  }

  async deleteProduct(userId, sendboxIdentifier) {
    logger.info('Mock Sendbox deleteProduct called', { userId, sendboxIdentifier });
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (sendboxIdentifier) {
      this.mockShipments.delete(sendboxIdentifier);
    }

    return {
      success: true,
      sendboxShipmentId: sendboxIdentifier,
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

  async verifyResource(identifier) {
    const cleanId = String(identifier).trim();
    for (const [shipmentId, data] of this.mockShipments.entries()) {
      if (
        shipmentId === cleanId ||
        data.orderId === cleanId ||
        (data.sku && data.sku.toUpperCase() === cleanId.toUpperCase())
      ) {
        return {
          query: cleanId,
          found: true,
          resourceType: data.sku?.toUpperCase() === cleanId.toUpperCase() ? 'shipment_item' : 'shipment',
          details: {
            shipmentCode: shipmentId,
            orderReference: data.orderId,
            item: {
              sku: data.sku,
              name: data.title,
              price: data.price
            },
            status: data.status
          }
        };
      }
    }

    return {
      query: cleanId,
      found: false,
      resourceType: 'not_found',
      message: `Resource '${cleanId}' was not found in mock store.`
    };
  }
}

module.exports = new MockSendboxService();
