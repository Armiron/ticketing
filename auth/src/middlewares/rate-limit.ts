import type { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

// Create Redis client (v4 API: host/port live under `socket`)
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

// The client is injectable (defaults to the app-wide one) so tests can pass
// a fake instead of mocking the 'redis' module.
export const rateLimit = (
  maxRequests: number,
  windowMs: number,
  keyPrefix: string = 'rate_limit',
  client: {
    isReady: boolean;
    incr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<unknown>;
  } = redisClient,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If Redis is not connected, skip rate limiting
      // (redis v4 uses `isReady`; `status` is a v3 API)
      if (!client.isReady) {
        return next();
      }

      const clientAddress = (req.ip ?? 'unknown')
        .replace(/^::ffff:/, '')
        .replace(/:/g, '.');

      const key = `${keyPrefix}:${clientAddress}:${req.path}`;

      // Fixed-window counter: INCR creates the key at 1 on the first hit of
      // the window; we set the TTL only in that case so the window length is
      // fixed from the first request (resetting EXPIRE on every hit would let
      // a slow, steady drip stay under the cap indefinitely).
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, Math.floor(windowMs / 1000));
      }

      if (count > maxRequests) {
        return res.status(429).send({
          error: 'Too many requests, please try again later.',
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If Redis is down, allow the request through
      next();
    }
  };
};

// Export client for use in other modules if needed
export { redisClient };
