const crypto = require('crypto');
const { queryOne, execute } = require('../config/database');

const userModel = {
  createUser({ email, passwordHash, name = null }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalizedEmail = email.toLowerCase().trim();

    execute(
      `INSERT INTO users (id, email, name, password_hash, auth_provider, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'local', ?, ?)`,
      [id, normalizedEmail, name, passwordHash, now, now]
    );

    return {
      id,
      email: normalizedEmail,
      name,
      auth_provider: 'local',
      created_at: now,
      updated_at: now
    };
  },

  findByEmail(email) {
    if (!email) return null;
    return queryOne(
      `SELECT id, email, name, amazon_user_id, password_hash, auth_provider, created_at, updated_at
       FROM users
       WHERE email = ?`,
      [email.toLowerCase().trim()]
    );
  },

  findById(id) {
    if (!id) return null;
    return queryOne(
      `SELECT id, email, name, amazon_user_id, auth_provider, created_at, updated_at
       FROM users
       WHERE id = ?`,
      [id]
    );
  },

  findByAmazonUserId(amazonUserId) {
    if (!amazonUserId) return null;
    return queryOne(
      `SELECT id, email, name, amazon_user_id, auth_provider, created_at, updated_at
       FROM users
       WHERE amazon_user_id = ?`,
      [amazonUserId]
    );
  },

  /**
   * Upserts a user authenticated via Login with Amazon (LWA).
   * Maps amazon_user_id (amzn1.account.xxx) to internal user id.
   */
  upsertAmazonUser({ amazonUserId, name, email }) {
    const now = new Date().toISOString();
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // 1. Check if user already exists by amazon_user_id
    let existing = this.findByAmazonUserId(amazonUserId);
    if (existing) {
      execute(
        `UPDATE users
         SET name = COALESCE(?, name),
             email = COALESCE(?, email),
             updated_at = ?
         WHERE id = ?`,
        [name, normalizedEmail, now, existing.id]
      );
      return this.findById(existing.id);
    }

    // 2. Check if user exists with the same email
    if (normalizedEmail) {
      const emailUser = this.findByEmail(normalizedEmail);
      if (emailUser) {
        execute(
          `UPDATE users
           SET amazon_user_id = ?,
               name = COALESCE(?, name),
               auth_provider = 'amazon',
               updated_at = ?
           WHERE id = ?`,
          [amazonUserId, name, now, emailUser.id]
        );
        return this.findById(emailUser.id);
      }
    }

    // 3. Create a brand new user (set unusable secure hash for OAuth users)
    const id = crypto.randomUUID();
    const oauthPlaceholderHash = `OAUTH_LWA_${crypto.randomBytes(32).toString('hex')}`;
    execute(
      `INSERT INTO users (id, email, name, amazon_user_id, password_hash, auth_provider, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'amazon', ?, ?)`,
      [id, normalizedEmail || `${amazonUserId.slice(-8)}@amazon.user`, name, amazonUserId, oauthPlaceholderHash, now, now]
    );

    // 4. Seed unique application product dataset for this new Amazon user
    this.seedDefaultProducts(id, name || amazonUserId);

    return this.findById(id);
  },

  /**
   * Seeds an initial isolated product dataset for a newly registered Amazon user.
   * Products reside strictly in the local application database.
   */
  seedDefaultProducts(userId, displayName) {
    const seedItems = [
      {
        sku: `AMZ-${userId.slice(0, 4).toUpperCase()}-101`,
        title: 'Precision Micro-Climate Barometric Sensor',
        price: 39.99,
        quantity: 45,
        description: 'Atmospheric pressure & temperature logger for precision weather monitoring.'
      },
      {
        sku: `AMZ-${userId.slice(0, 4).toUpperCase()}-102`,
        title: 'Solar-Powered Ultrasonic Wind Anemometer',
        price: 79.50,
        quantity: 20,
        description: 'Rugged ultrasonic wind speed and direction telemetry station.'
      },
      {
        sku: `AMZ-${userId.slice(0, 4).toUpperCase()}-103`,
        title: 'Digital Soil Moisture & Hydration Probe',
        price: 24.95,
        quantity: 80,
        description: 'Multi-depth soil moisture sensor with real-time telemetry broadcast.'
      }
    ];

    const now = new Date().toISOString();

    for (const item of seedItems) {
      const prodId = crypto.randomUUID();
      execute(
        `INSERT INTO products (id, user_id, sku, title, description, price, quantity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [prodId, userId, item.sku, item.title, item.description, item.price, item.quantity, now, now]
      );

      const integId = crypto.randomUUID();
      execute(
        `INSERT INTO product_integrations (
           id, user_id, product_id, amazon_status, sendbox_status, sync_status,
           last_synced_at, created_at, updated_at
         ) VALUES (?, ?, ?, 'NOT_LISTED', 'NOT_SYNCED', 'SYNCED', ?, ?, ?)`,
        [integId, userId, prodId, now, now, now]
      );
    }
  }
};

module.exports = userModel;
