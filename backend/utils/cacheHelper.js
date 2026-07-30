const redisClient = require('../config/redis');

/**
 * Attempts to get data from Redis.
 * If Redis is unavailable or the key doesn't exist, it resolves to null.
 */
const getCache = async (key) => {
  try {
    if (!redisClient.isReady) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn(`Redis GET Error for key ${key}:`, error.message);
    return null;
  }
};

/**
 * Attempts to set data in Redis with an optional TTL (time to live) in seconds.
 */
const setCache = async (key, value, ttlSeconds = 3600) => {
  try {
    if (!redisClient.isReady) return;
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.warn(`Redis SET Error for key ${key}:`, error.message);
  }
};

/**
 * Clears keys matching a pattern. Useful for invalidation.
 */
const clearCache = async (pattern) => {
  try {
    if (!redisClient.isReady) return;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.warn(`Redis CLEAR Error for pattern ${pattern}:`, error.message);
  }
};

module.exports = {
  getCache,
  setCache,
  clearCache
};
