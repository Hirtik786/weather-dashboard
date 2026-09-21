const crypto = require('crypto');
const { queryOne, execute } = require('../config/database');

const productIntegrationModel = {
  findByProductId(productId, userId) {
    if (!productId || !userId) return null;
    return queryOne(
      `SELECT * FROM product_integrations
       WHERE product_id = ? AND user_id = ?`,
      [productId, userId]
    );
  },

  upsertIntegration({
    userId,
    productId,
    amazonListingId = null,
    amazonSku = null,
    amazonAsin = null,
    amazonStatus = 'NOT_LISTED',
    sendboxProductId = null,
    sendboxStatus = 'NOT_SYNCED',
    syncStatus = 'SYNCED',
    lastSyncedAt = null,
    lastSyncError = null
  }) {
    const existing = this.findByProductId(productId, userId);
    const now = new Date().toISOString();

    if (existing) {
      execute(
        `UPDATE product_integrations
         SET amazon_listing_id = COALESCE(?, amazon_listing_id),
             amazon_sku = COALESCE(?, amazon_sku),
             amazon_asin = COALESCE(?, amazon_asin),
             amazon_status = ?,
             sendbox_product_id = COALESCE(?, sendbox_product_id),
             sendbox_status = ?,
             sync_status = ?,
             last_synced_at = ?,
             last_sync_error = ?,
             updated_at = ?
         WHERE product_id = ? AND user_id = ?`,
        [
          amazonListingId,
          amazonSku,
          amazonAsin,
          amazonStatus,
          sendboxProductId,
          sendboxStatus,
          syncStatus,
          lastSyncedAt || now,
          lastSyncError,
          now,
          productId,
          userId
        ]
      );
    } else {
      const id = crypto.randomUUID();
      execute(
        `INSERT INTO product_integrations (
           id, user_id, product_id, amazon_listing_id, amazon_sku,
           amazon_asin, amazon_status, sendbox_product_id, sendbox_status,
           sync_status, last_synced_at, last_sync_error, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          productId,
          amazonListingId,
          amazonSku,
          amazonAsin,
          amazonStatus,
          sendboxProductId,
          sendboxStatus,
          syncStatus,
          lastSyncedAt || now,
          lastSyncError,
          now,
          now
        ]
      );
    }

    return this.findByProductId(productId, userId);
  },

  deleteByProductId(productId, userId) {
    if (!productId || !userId) return false;
    const res = execute(
      `DELETE FROM product_integrations WHERE product_id = ? AND user_id = ?`,
      [productId, userId]
    );
    return res.changes > 0;
  }
};

module.exports = productIntegrationModel;
