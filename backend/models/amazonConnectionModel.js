const crypto = require('crypto');
const { queryOne, execute } = require('../config/database');

const amazonConnectionModel = {
  findByUserId(userId) {
    if (!userId) return null;
    const row = queryOne(
      `SELECT id, user_id, seller_id, marketplace_id, region, status, mode,
              token_expires_at, created_at, updated_at
       FROM amazon_connections
       WHERE user_id = ?`,
      [userId]
    );
    return row;
  },

  /**
   * Internal lookup with encrypted tokens (for background sync, never exposed in API)
   */
  findInternalByUserId(userId) {
    if (!userId) return null;
    return queryOne(
      `SELECT * FROM amazon_connections WHERE user_id = ?`,
      [userId]
    );
  },

  upsertConnection({
    userId,
    sellerId,
    marketplaceId,
    region = 'na',
    status = 'CONNECTED',
    mode = 'mock',
    refreshTokenEncrypted = null,
    accessTokenEncrypted = null,
    tokenExpiresAt = null
  }) {
    const existing = queryOne(
      `SELECT id FROM amazon_connections WHERE user_id = ?`,
      [userId]
    );

    const now = new Date().toISOString();

    if (existing) {
      execute(
        `UPDATE amazon_connections
         SET seller_id = ?, marketplace_id = ?, region = ?, status = ?,
             mode = ?, refresh_token_encrypted = ?, access_token_encrypted = ?,
             token_expires_at = ?, updated_at = ?
         WHERE user_id = ?`,
        [
          sellerId,
          marketplaceId,
          region,
          status,
          mode,
          refreshTokenEncrypted,
          accessTokenEncrypted,
          tokenExpiresAt,
          now,
          userId
        ]
      );
      return this.findByUserId(userId);
    } else {
      const id = crypto.randomUUID();
      execute(
        `INSERT INTO amazon_connections (
           id, user_id, seller_id, marketplace_id, region, status, mode,
           refresh_token_encrypted, access_token_encrypted, token_expires_at,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          sellerId,
          marketplaceId,
          region,
          status,
          mode,
          refreshTokenEncrypted,
          accessTokenEncrypted,
          tokenExpiresAt,
          now,
          now
        ]
      );
      return this.findByUserId(userId);
    }
  },

  disconnect(userId) {
    if (!userId) return false;
    const now = new Date().toISOString();
    execute(
      `UPDATE amazon_connections
       SET status = 'DISCONNECTED', refresh_token_encrypted = NULL,
           access_token_encrypted = NULL, updated_at = ?
       WHERE user_id = ?`,
      [now, userId]
    );
    return true;
  }
};

module.exports = amazonConnectionModel;
