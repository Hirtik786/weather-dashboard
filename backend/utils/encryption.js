const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from environment variables.
 */
function getKey() {
  const envKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'weather-dashboard-default-dev-key';
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Format: iv:authTag:encryptedData (hex encoded)
 */
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a cipher string in iv:authTag:encryptedData format.
 */
function decrypt(cipherText) {
  if (!cipherText) return null;
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Encryption] Decryption failed:', err.message);
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
