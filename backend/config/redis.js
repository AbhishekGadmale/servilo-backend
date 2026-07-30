const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis connected successfully'));

// Connect asynchronously but don't crash if it fails
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Initial Redis Connection Failed, operating without cache.', err);
  }
})();

module.exports = redisClient;
