/**
 * Unit tests for the rate-limit middleware, backed by a fake in-memory Redis.
 *
 * The middleware only touches a small surface of the redis v6 client
 * (`isReady`, `incr`, `expire`), so we pass a controllable fake as the
 * injectable 4th argument instead of mocking the 'redis' module (module
 * mocking needs babel hoisting or top-level await, neither of which we have
 * in this ESM setup).
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { rateLimit } from '../../middlewares/rate-limit.ts';

// Fake redis client backed by an in-memory Map.
const store = new Map<string, number>();

const fakeClient: any = {
  isReady: true,
  incr: jest.fn(async (key: string) => {
    const next = (store.get(key) ?? 0) + 1;
    store.set(key, next);
    return next;
  }),
  expire: jest.fn(async () => true),
};

const MAX = 3;
const WINDOW_MS = 60_000;
const PREFIX = 'test_rl';

// Build a minimal express req/res/next triple for the middleware.
function mockReqRes() {
  const req = { ip: '127.0.0.1', path: '/api/thing' };
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
  const next = jest.fn();
  return { req, res, next };
}

const expectedKey = `${PREFIX}:127.0.0.1:/api/thing`;

function resetClient() {
  store.clear();
  jest.clearAllMocks();
  fakeClient.isReady = true;
  // Fresh default implementations with clean call counts.
  fakeClient.incr = jest.fn(async (key: string) => {
    const next = (store.get(key) ?? 0) + 1;
    store.set(key, next);
    return next;
  });
  fakeClient.expire = jest.fn(async () => true);
}

beforeEach(resetClient);

describe('rateLimit middleware', () => {
  it('allows the request and starts the window on the first hit', async () => {
    const { req, res, next } = mockReqRes();

    await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(store.get(expectedKey)).toBe(1);
    // First hit of the window sets the TTL exactly once.
    expect(fakeClient.expire).toHaveBeenCalledTimes(1);
    expect(fakeClient.expire).toHaveBeenCalledWith(
      expectedKey,
      Math.floor(WINDOW_MS / 1000)
    );
  });

  it('returns 429 once the limit is exceeded and does not call next()', async () => {
    // Drive the counter past the limit: requests 1..MAX are allowed, the
    // (MAX+1)th is rejected.
    for (let i = 0; i < MAX; i++) {
      const r = mockReqRes();
      await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(r.req as never, r.res as never, r.next as never);
      expect(r.next).toHaveBeenCalledTimes(1);
    }

    const over = mockReqRes();
    await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(over.req as never, over.res as never, over.next as never);

    expect(over.next).not.toHaveBeenCalled();
    expect(over.res.status).toHaveBeenCalledWith(429);
    expect(over.res.send).toHaveBeenCalledWith({
      error: 'Too many requests, please try again later.',
    });
    // Failed attempts count against the limit (the counter is MAX+1).
    expect(store.get(expectedKey)).toBe(MAX + 1);
  });

  it('sets the window TTL only once, not on every hit', async () => {
    const r1 = mockReqRes();
    await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(r1.req as never, r1.res as never, r1.next as never);
    const r2 = mockReqRes();
    await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(r2.req as never, r2.res as never, r2.next as never);

    // Fixed window: the TTL is set on hit 1 and not extended on hit 2.
    expect(fakeClient.expire).toHaveBeenCalledTimes(1);
  });

  it('tracks each route independently via the key prefix', async () => {
    // Fill up the "test_rl" bucket past its limit...
    for (let i = 0; i < MAX + 1; i++) {
      const r = mockReqRes();
      await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(r.req as never, r.res as never, r.next as never);
    }
    // ...that route is now blocked...
    const blocked = mockReqRes();
    await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(
      blocked.req as never,
      blocked.res as never,
      blocked.next as never
    );
    expect(blocked.res.status).toHaveBeenCalledWith(429);

    // ...but a different route (different prefix) is still allowed.
    const other = mockReqRes();
    await rateLimit(MAX, WINDOW_MS, 'signup_rate_limit', fakeClient)(
      other.req as never,
      other.res as never,
      other.next as never
    );
    expect(other.next).toHaveBeenCalledTimes(1);
    expect(other.res.status).not.toHaveBeenCalled();
  });

  it('skips rate limiting entirely when Redis is not ready', async () => {
    fakeClient.isReady = false;
    const { req, res, next } = mockReqRes();

    await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(fakeClient.incr).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it('fails open (calls next) if Redis throws', async () => {
    // The middleware logs the Redis error before failing open — keep output clean.
    const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fakeClient.incr = jest.fn(async () => {
      throw new Error('connection reset');
    });
    const { req, res, next } = mockReqRes();

    await rateLimit(MAX, WINDOW_MS, PREFIX, fakeClient)(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
