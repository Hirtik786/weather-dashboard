const crypto = require('crypto');
const { queryAll, queryOne, execute } = require('../config/database');

const productModel = {
  createProduct({ userId, sku, title, description = '', price, quantity = 0, imageUrl = null }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO products (
         id, user_id, sku, title, description, price, quantity, image_url,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        sku.trim().toUpperCase(),
        title.trim(),
        description || '',
        parseFloat(price) || 0.0,
        parseInt(quantity, 10) || 0,
        imageUrl || null,
        now,
        now
      ]
    );

    return this.findById(id, userId);
  },

  findById(id, userId) {
    if (!id || !userId) return null;
    return queryOne(
      `SELECT p.*,
              pi.amazon_listing_id, pi.amazon_sku, pi.amazon_asin, pi.amazon_status,
              pi.sendbox_product_id, pi.sendbox_status, pi.sync_status,
              pi.last_synced_at, pi.last_sync_error
       FROM products p
       LEFT JOIN product_integrations pi
         ON p.id = pi.product_id AND pi.user_id = p.user_id
       WHERE p.id = ? AND p.user_id = ?`,
      [id, userId]
    );
  },

  findBySku(sku, userId) {
    if (!sku || !userId) return null;
    return queryOne(
      `SELECT * FROM products WHERE sku = ? AND user_id = ?`,
      [sku.trim().toUpperCase(), userId]
    );
  },

  findAllByUser(userId, { search = '', status = 'All' } = {}) {
    if (!userId) return [];

    let sql = `
      SELECT p.*,
             pi.amazon_listing_id, pi.amazon_sku, pi.amazon_asin, pi.amazon_status,
             pi.sendbox_product_id, pi.sendbox_status, pi.sync_status,
             pi.last_synced_at, pi.last_sync_error
      FROM products p
      LEFT JOIN product_integrations pi
        ON p.id = pi.product_id AND pi.user_id = p.user_id
      WHERE p.user_id = ?
    `;
    const params = [userId];

    if (search && search.trim()) {
      sql += ` AND (p.title LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (status && status !== 'All') {
      sql += ` AND pi.sync_status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY p.created_at DESC`;

    return queryAll(sql, params);
  },

  updateProduct(id, userId, updates = {}) {
    if (!id || !userId) return null;

    const existing = queryOne(
      `SELECT id FROM products WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!existing) return null;

    const allowed = ['title', 'description', 'price', 'quantity', 'image_url'];
    const setClauses = [];
    const params = [];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        if (key === 'price') {
          params.push(parseFloat(updates[key]) || 0.0);
        } else if (key === 'quantity') {
          params.push(parseInt(updates[key], 10) || 0);
        } else {
          params.push(updates[key]);
        }
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id, userId);
    }

    const now = new Date().toISOString();
    setClauses.push('updated_at = ?');
    params.push(now);

    params.push(id, userId);

    execute(
      `UPDATE products SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    return this.findById(id, userId);
  },

  deleteProduct(id, userId) {
    if (!id || !userId) return false;
    const result = execute(
      `DELETE FROM products WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return result.changes > 0;
  }
};

module.exports = productModel;
