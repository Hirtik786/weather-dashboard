/**
 * Safe Structured Server-Side Logger
 * Automatically redacts sensitive fields like passwords, refresh tokens, and secrets.
 */

const REDACTED_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'access_token',
  'client_secret',
  'clientsecret',
  'secret',
  'jwt_secret',
  'authorization',
  'cookie'
]);

function sanitize(data) {
  if (!data) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }

  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitize(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

const logger = {
  info(message, meta = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${message}`, Object.keys(meta).length ? JSON.stringify(sanitize(meta)) : '');
  },

  warn(message, meta = {}) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`, Object.keys(meta).length ? JSON.stringify(sanitize(meta)) : '');
  },

  error(message, errorOrMeta = {}) {
    const timestamp = new Date().toISOString();
    let meta = errorOrMeta;
    if (errorOrMeta instanceof Error) {
      meta = { error: errorOrMeta.message, code: errorOrMeta.code };
    }
    console.error(`[${timestamp}] [ERROR] ${message}`, Object.keys(meta).length ? JSON.stringify(sanitize(meta)) : '');
  },

  sanitize
};

module.exports = logger;
