const { createClient } = require('redis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const client = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('[Redis] Max reconnection attempts reached. Continuing to attempt every 5000ms.');
        return 5000;
      }
      return Math.min(retries * 500, 3000);
    },
    connectTimeout: 10000,
  },
});

let isConnected = false;

client.on('connect', () => {
  console.log('[Redis] Connecting to Redis server...');
});

client.on('ready', () => {
  isConnected = true;
  console.log('[Redis] Connected and ready at ' + redisUrl);
});

client.on('reconnecting', () => {
  isConnected = false;
  console.warn('[Redis] Reconnecting to Redis server...');
});

client.on('end', () => {
  isConnected = false;
  console.warn('[Redis] Disconnected from Redis server.');
});

client.on('error', (err) => {
  isConnected = false;
  console.error('[Redis] Client Error:', err.message);
});

async function connectRedis() {
  if (!client.isOpen) {
    try {
      await client.connect();
    } catch (err) {
      console.error('[Redis] Initial connection error:', err.message);
      // We don't exit immediately so the health endpoint can report Redis offline
    }
  }
  return client;
}

function getRedisClient() {
  return client;
}

function isRedisConnected() {
  return isConnected && client.isOpen;
}

module.exports = {
  client,
  connectRedis,
  getRedisClient,
  isRedisConnected,
};
