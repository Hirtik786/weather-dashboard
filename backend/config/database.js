const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const logger = require('../utils/logger');

let db = null;

function initDatabase(dbPath = null) {
  if (db) return db;

  const targetPath =
    dbPath ||
    process.env.DATABASE_PATH ||
    path.join(__dirname, '../data/dashboard.db');

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  db = new DatabaseSync(targetPath);

  // Enable foreign keys and WAL mode for reliability and concurrency
  db.exec('PRAGMA foreign_keys = ON;');
  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      amazon_user_id TEXT UNIQUE,
      password_hash TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS amazon_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL,
      marketplace_id TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT 'na',
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      refresh_token_encrypted TEXT,
      access_token_encrypted TEXT,
      token_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sendbox_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, sku)
    );

    CREATE TABLE IF NOT EXISTS product_integrations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
      amazon_listing_id TEXT,
      amazon_sku TEXT,
      amazon_asin TEXT,
      amazon_status TEXT NOT NULL DEFAULT 'NOT_LISTED',
      sendbox_product_id TEXT,
      sendbox_shipment_id TEXT,
      sendbox_order_id TEXT,
      sendbox_status TEXT NOT NULL DEFAULT 'NOT_SYNCED',
      sync_status TEXT NOT NULL DEFAULT 'SYNCED',
      last_synced_at TEXT,
      last_sync_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migrations for existing database instances (must run before index creation)
  try { db.exec('ALTER TABLE users ADD COLUMN name TEXT;'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN amazon_user_id TEXT;'); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local';"); } catch {}
  try { db.exec('ALTER TABLE product_integrations ADD COLUMN sendbox_shipment_id TEXT;'); } catch {}
  try { db.exec('ALTER TABLE product_integrations ADD COLUMN sendbox_order_id TEXT;'); } catch {}

  // Create indices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
    CREATE INDEX IF NOT EXISTS idx_integrations_user_prod ON product_integrations(user_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_amazon_conn_user ON amazon_connections(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_amazon_id ON users(amazon_user_id);
  `);

  logger.info(`Relational database initialized successfully at: ${targetPath}`);
  return db;
}

function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

function queryAll(sql, params = []) {
  const statement = getDatabase().prepare(sql);
  return statement.all(...params);
}

function queryOne(sql, params = []) {
  const statement = getDatabase().prepare(sql);
  const row = statement.get(...params);
  return row || null;
}

function execute(sql, params = []) {
  const statement = getDatabase().prepare(sql);
  return statement.run(...params);
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  queryAll,
  queryOne,
  execute,
  closeDatabase
};
