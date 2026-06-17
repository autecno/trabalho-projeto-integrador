import { Redis } from 'ioredis';

export function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    maxRetriesPerRequest: null,
  });
}
