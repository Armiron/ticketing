/**
 * End-to-end test script for the auth microservice.
 *
 * Acts as a real browser: keeps a cookie jar, sends Set-Cookie updates back,
 * and walks the full user journey against a LIVE local instance:
 *
 *   currentuser (anonymous) → signup (valid + invalid) → currentuser (authed)
 *   → signin (valid + invalid) → currentuser (authed) → signout → currentuser
 *   (anonymous again) → 404 on unknown route
 *
 * Usage (from the auth/ directory, server running on :3000):
 *   node e2e/e2e.test.mjs            # run the suite
 *   node e2e/e2e.test.mjs --reset    # first clear the Redis rate-limit
 *                                    # counters, then run the suite
 *
 * NOTE on rate limits: signup/signin/signout are limited to 5 requests per
 * 15 minutes per IP (Redis fixed window). This script uses 4 / 4 / 2 of that
 * budget respectively, so a full run fits. If you re-run it within 15
 * minutes, use --reset (or wait out the window).
 */

import process from 'node:process';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

/* ---------------------------------------------------------------- *
 * Tiny browser-like cookie jar                                      *
 * ---------------------------------------------------------------- */

const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function applySetCookies(res) {
  // getSetCookie() returns each cookie as its own string (Node >= 18.14)
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair, ...attrs] = raw.split(';').map((s) => s.trim());
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx);
    const value = pair.slice(idx + 1);

    const maxAge = attrs.find((a) => /^max-age=/i.test(a));
    const expires = attrs.find((a) => /^expires=/i.test(a));
    const expired =
      (maxAge && parseInt(maxAge.split('=')[1], 10) <= 0) ||
      (expires && new Date(expires.split('=')[1]) <= new Date());

    if (expired) jar.delete(name);
    else jar.set(name, value);
  }
}

async function request(method, path, { body, cookie = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie && jar.size > 0) headers['Cookie'] = cookieHeader();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  applySetCookies(res);
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body: json, res };
}

/* ---------------------------------------------------------------- *
 * Tiny test harness                                                 *
 * ---------------------------------------------------------------- */

const results = [];
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function expectStatus(res, want, what) {
  expect(
    res.status === want,
    `${what}: expected status ${want}, got ${res.status} (body: ${JSON.stringify(res.body)})`,
  );
}

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  PASS  ${name}`);
    } catch (err) {
      results.push({ name, ok: false, err });
      console.log(`  FAIL  ${name}`);
      console.log(`        ${err.message}`);
    }
  }
}

/* ---------------------------------------------------------------- *
 * Shared fixture — unique per run so duplicate-email assertions hold *
 * ---------------------------------------------------------------- */

const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = 'pass1234';

/* ---------------------------------------------------------------- *
 * Phase 0 — server up + anonymous state                             *
 * ---------------------------------------------------------------- */

test('GET /api/users/currentuser (anonymous) → 200, currentUser null', async () => {
  const res = await request('GET', '/api/users/currentuser');
  await expectStatus(res, 200, 'anonymous currentuser');
  expect(
    res.body?.currentUser === null,
    `expected currentUser null, got ${JSON.stringify(res.body)}`,
  );
});

/* ---------------------------------------------------------------- *
 * Phase 1 — signup (uses 4 of the 5-request rate budget)            *
 * ---------------------------------------------------------------- */

test('POST /api/users/signup invalid email → 400 validation error', async () => {
  const res = await request('POST', '/api/users/signup', {
    body: { email: 'not-an-email', password: PASSWORD },
  });
  await expectStatus(res, 400, 'signup invalid email');
  expect(
    Array.isArray(res.body?.errors) && res.body.errors.length > 0,
    `expected an errors array, got ${JSON.stringify(res.body)}`,
  );
});

test('POST /api/users/signup short password → 400 validation error', async () => {
  const res = await request('POST', '/api/users/signup', {
    body: { email: EMAIL, password: '123' },
  });
  await expectStatus(res, 400, 'signup short password');
  expect(
    res.body?.errors?.some((e) => /password/i.test(e.message)),
    `expected a password validation error, got ${JSON.stringify(res.body)}`,
  );
});

test('POST /api/users/signup valid → 201, session cookie, no password leaked', async () => {
  const res = await request('POST', '/api/users/signup', {
    body: { email: EMAIL, password: PASSWORD },
  });
  await expectStatus(res, 201, 'signup valid');
  expect(
    res.body?.email === EMAIL,
    `expected email ${EMAIL}, got ${JSON.stringify(res.body)}`,
  );
  expect(
    res.body?.password === undefined,
    `expected no password in response (toJSON transform strips it), got ${JSON.stringify(res.body)}`,
  );
  expect(jar.size > 0, 'expected a session cookie to be set');
});

test('POST /api/users/signup duplicate email → 400 "already in use"', async () => {
  flushAllRedisData(); // allow a re-run of this test without waiting 15 minutes
  const res = await request('POST', '/api/users/signup', {
    body: { email: EMAIL, password: PASSWORD },
  });
  await expectStatus(res, 400, 'signup duplicate');
  expect(
    res.body?.errors?.some((e) => /already in use/i.test(e.message)),
    `expected "Email already in use", got ${JSON.stringify(res.body)}`,
  );
});

/* ---------------------------------------------------------------- *
 * Phase 2 — signed up: session is live                              *
 * ---------------------------------------------------------------- */

test('GET /api/users/currentuser (after signup) → 200, correct user', async () => {
  const res = await request('GET', '/api/users/currentuser');
  await expectStatus(res, 200, 'currentuser after signup');
  expect(
    res.body?.currentUser?.email === EMAIL,
    `expected currentUser.email ${EMAIL}, got ${JSON.stringify(res.body)}`,
  );
  expect(
    typeof res.body?.currentUser?.id === 'string' &&
      res.body.currentUser.id.length > 0,
    'expected a non-empty currentUser.id',
  );
});

/* ---------------------------------------------------------------- *
 * Phase 3 — signin (uses 4 of the 5-request rate budget)            *
 * (No invalid-email test here: signup already covers the            *
 * validation-error shape, and every attempt — even 400s — burns one *
 * of the 5 per-15-min budget slots.)                                *
 * ---------------------------------------------------------------- */

test('POST /api/users/signin wrong password → 400 invalid credentials', async () => {
  const res = await request('POST', '/api/users/signin', {
    body: { email: EMAIL, password: 'wrongpass' },
  });
  await expectStatus(res, 400, 'signin wrong password');
  expect(
    res.body?.errors?.some((e) => /invalid credentials/i.test(e.message)),
    `expected "Invalid credentials", got ${JSON.stringify(res.body)}`,
  );
});

test('POST /api/users/signin unknown user → 400 invalid credentials', async () => {
  const res = await request('POST', '/api/users/signin', {
    body: { email: `ghost-${Date.now()}@example.com`, password: PASSWORD },
  });
  await expectStatus(res, 400, 'signin unknown user');
  expect(
    res.body?.errors?.some((e) => /invalid credentials/i.test(e.message)),
    `expected "Invalid credentials", got ${JSON.stringify(res.body)}`,
  );
});

test('POST /api/users/signin correct → 200, fresh session cookie', async () => {
  jar.clear(); // start from a signed-out browser
  const res = await request('POST', '/api/users/signin', {
    body: { email: EMAIL, password: PASSWORD },
  });
  await expectStatus(res, 200, 'signin correct');
  expect(
    res.body?.email === EMAIL,
    `expected email ${EMAIL}, got ${JSON.stringify(res.body)}`,
  );
  expect(jar.size > 0, 'expected a session cookie to be set');
});

/* ---------------------------------------------------------------- *
 * Phase 4 — signed in: session is live                              *
 * ---------------------------------------------------------------- */

test('GET /api/users/currentuser (after signin) → 200, correct user', async () => {
  const res = await request('GET', '/api/users/currentuser');
  await expectStatus(res, 200, 'currentuser after signin');
  expect(
    res.body?.currentUser?.email === EMAIL,
    `expected currentUser.email ${EMAIL}, got ${JSON.stringify(res.body)}`,
  );
});

/* ---------------------------------------------------------------- *
 * Phase 5 — signout (uses 2 of the 5-request rate budget)           *
 * ---------------------------------------------------------------- */

test('POST /api/users/signout (no session) → 200 message', async () => {
  jar.clear();
  const res = await request('POST', '/api/users/signout');
  await expectStatus(res, 200, 'signout no session');
  expect(
    typeof res.body?.message === 'string' && res.body.message.length > 0,
    `expected a message, got ${JSON.stringify(res.body)}`,
  );
});

test('POST /api/users/signout (with session) → 200, cookie cleared, anonymous again', async () => {
  // Establish an active session first (this is the 5th and final signin
  // of the 5-per-15-min rate budget).
  const signin = await request('POST', '/api/users/signin', {
    body: { email: EMAIL, password: PASSWORD },
  });
  await expectStatus(signin, 200, 'signin for signout test');

  const before = jar.size;
  const res = await request('POST', '/api/users/signout');
  await expectStatus(res, 200, 'signout with session');
  expect(
    typeof res.body?.message === 'string' &&
      /signed out/i.test(res.body.message),
    `expected signout message, got ${JSON.stringify(res.body)}`,
  );
  expect(
    jar.size < before,
    'expected the session cookie to be cleared by the response',
  );

  // A signed-out browser now sees an anonymous currentuser
  const current = await request('GET', '/api/users/currentuser');
  await expectStatus(current, 200, 'currentuser after signout');
  expect(
    current.body?.currentUser === null,
    `expected currentUser null after signout, got ${JSON.stringify(current.body)}`,
  );
});

/* ---------------------------------------------------------------- *
 * Phase 6 — unknown routes                                          *
 * ---------------------------------------------------------------- */

test('GET /api/does-not-exist → 404 Not Found', async () => {
  const res = await request('GET', '/api/does-not-exist');
  await expectStatus(res, 404, 'unknown route');
  expect(
    res.body?.errors?.some((e) => /not found/i.test(e.message)),
    `expected a "Not Found" error, got ${JSON.stringify(res.body)}`,
  );
});

/* ---------------------------------------------------------------- *
 * Optional: clear Redis rate-limit counters so the suite can re-run *
 * ---------------------------------------------------------------- */

async function flushAllRedisData() {
  const { createClient } = await import('redis');
  const client = createClient({
    socket: { host: REDIS_HOST, port: REDIS_PORT },
  });
  await client.connect();
  await client.flushAll();
  await client.quit();
  console.log('  flushed: removed all keys from Redis');
}

/* ---------------------------------------------------------------- *
 * Main                                                              *
 * ---------------------------------------------------------------- */

console.log(`\nAuth E2E suite against ${BASE_URL}\n`);

if (process.argv.includes('--reset')) {
  await flushAllRedisData();
}

// Fail fast with a clear message if the server isn't up
try {
  const ping = await fetch(`${BASE_URL}/api/users/currentuser`, {
    method: 'GET',
  });
  ping.body?.close?.();
} catch {
  console.error(
    `\nCould not reach ${BASE_URL} — is the auth server running? (npm run start2)\n`,
  );
  process.exit(1);
}

// Pre-flight: warn if we're already rate-limited
const preflight = await request('GET', '/api/users/currentuser');
if (preflight.status === 429) {
  console.error(
    '\nServer is rate-limiting this client — re-run with --reset or wait 15 minutes.\n',
  );
  process.exit(1);
}

await run();

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
if (failed > 0) {
  console.log(
    '\nHint: if failures show status 429, the Redis rate-limit window is',
  );
  console.log('active — re-run with: node e2e/e2e.test.mjs --reset\n');
  process.exitCode = 1;
}
