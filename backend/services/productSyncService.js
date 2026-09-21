const productModel = require('../models/productModel');
const productIntegrationModel = require('../models/productIntegrationModel');
const amazonConnectionModel = require('../models/amazonConnectionModel');
const amazonService = require('./amazon/amazonService');
const sendboxService = require('./sendbox/sendboxService');
const logger = require('../utils/logger');

const productSyncService = {
  /**
   * Synchronizes a newly created or existing product to both Amazon and Sendbox.
   */
  async syncProduct(userId, product, existingIntegration = null) {
    const amazonConn = amazonConnectionModel.findByUserId(userId);
    const hasAmazonConn = amazonConn && amazonConn.status === 'CONNECTED';

    let amazonResult = { success: false, status: 'NOT_LISTED', error: null };
    let sendboxResult = { success: false, status: 'NOT_SYNCED', error: null };

    // 1. Sync to Sendbox
    try {
      if (existingIntegration?.sendbox_product_id) {
        sendboxResult = await sendboxService.updateProduct(
          userId,
          existingIntegration.sendbox_product_id,
          product
        );
      } else {
        sendboxResult = await sendboxService.createProduct(userId, product);
      }
    } catch (err) {
      logger.error('Sendbox sync error', err);
      sendboxResult = { success: false, status: 'ERROR', error: err.message };
    }

    // 2. Sync to Amazon (if user has connected Amazon)
    if (hasAmazonConn) {
      try {
        if (existingIntegration?.amazon_listing_id) {
          amazonResult = await amazonService.updateListing(
            amazonConn,
            existingIntegration.amazon_listing_id,
            product
          );
        } else {
          amazonResult = await amazonService.createListing(amazonConn, product);
        }
      } catch (err) {
        logger.error('Amazon sync error', err);
        amazonResult = { success: false, status: 'ERROR', error: err.message };
      }
    } else {
      amazonResult = {
        success: true, // Not failed, just not connected
        status: 'NOT_LISTED',
        error: null
      };
    }

    // 3. Compute overall sync status
    // Possible states: SYNCED | PARTIAL | FAILED | SYNCING
    let overallSyncStatus = 'SYNCED';
    const errors = [];

    const sendboxOk = sendboxResult.success;
    const amazonOk = !hasAmazonConn || amazonResult.success;

    if (sendboxOk && amazonOk) {
      overallSyncStatus = 'SYNCED';
    } else if (!sendboxOk && !amazonOk) {
      overallSyncStatus = 'FAILED';
      if (sendboxResult.error) errors.push(`Sendbox: ${sendboxResult.error}`);
      if (amazonResult.error) errors.push(`Amazon: ${amazonResult.error}`);
    } else {
      overallSyncStatus = 'PARTIAL';
      if (!sendboxOk && sendboxResult.error) {
        errors.push(`Sendbox: ${sendboxResult.error}`);
      }
      if (!amazonOk && amazonResult.error) {
        errors.push(`Amazon: ${amazonResult.error}`);
      }
    }

    const lastSyncError = errors.length > 0 ? errors.join(' | ') : null;

    // 4. Save to product_integrations
    const integration = productIntegrationModel.upsertIntegration({
      userId,
      productId: product.id,
      amazonListingId: amazonResult.listingId || existingIntegration?.amazon_listing_id || null,
      amazonSku: amazonResult.sku || product.sku,
      amazonAsin: amazonResult.asin || existingIntegration?.amazon_asin || null,
      amazonStatus: amazonResult.status || (hasAmazonConn ? (amazonResult.success ? 'LISTED' : 'ERROR') : 'NOT_LISTED'),
      sendboxProductId: sendboxResult.sendboxProductId || existingIntegration?.sendbox_product_id || null,
      sendboxStatus: sendboxResult.status || (sendboxResult.success ? 'SYNCED' : 'ERROR'),
      syncStatus: overallSyncStatus,
      lastSyncedAt: new Date().toISOString(),
      lastSyncError
    });

    return {
      product: productModel.findById(product.id, userId),
      integration,
      syncStatus: overallSyncStatus,
      amazonResult,
      sendboxResult
    };
  },

  /**
   * Deactivates/deletes a product across external channels before local deletion.
   */
  async deactivateChannels(userId, product) {
    const amazonConn = amazonConnectionModel.findByUserId(userId);
    const integration = productIntegrationModel.findByProductId(product.id, userId);

    if (integration) {
      if (integration.amazon_listing_id && amazonConn && amazonConn.status === 'CONNECTED') {
        try {
          await amazonService.deleteListing(amazonConn, integration.amazon_listing_id);
        } catch (err) {
          logger.warn('Failed to delete Amazon listing during cleanup', { error: err.message });
        }
      }

      if (integration.sendbox_product_id) {
        try {
          await sendboxService.deleteProduct(userId, integration.sendbox_product_id);
        } catch (err) {
          logger.warn('Failed to delete Sendbox product during cleanup', { error: err.message });
        }
      }
    }
  }
};

module.exports = productSyncService;
