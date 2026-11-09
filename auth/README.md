# Auth Service

Authentication microservice for the ticketing platform. Handles user signup, signin, signout, and current-user lookup for the rest of the system.

- **Passwords** are hashed with [Argon2](https://github.com/ranisalt/node-argon2) (never stored or returned in plaintext)
- **Sessions** are cookie-based: a signed `cookie-session` cookie carries an **RS256 JWT** (RSA key pair, not a shared secret)
- **Rate limiting** is per-IP via Redis fixed-window counters, and **fails open** if Redis is down
- **Persistence** via MongoDB (Mongoose); the `email` field has a unique index

API reference with full request/response examples: **[API.md](API.md)**.

## Requirements

|Dependency|Notes|
| --- | --- |
|Node.js **22.18+ / 23.6+**|The service runs TypeScript **directly** via Node's type stripping — no Babel/ts-node/ts-jest. `npm start` also uses `--env-file-if-exists`, which needs ≥ 22.9.|
|MongoDB|Local instance or Atlas; set `MONGO_URI`|
|Redis|Only needed for rate limiting. If unavailable the service still starts and rate limiting is skipped.|
|RSA key pair|`auth/keys/private.pem` + `public.pem` (gitignored) — see [Generating the JWT keys](#generating-the-jwt-keys)|

## Quick start

```bash
cd auth
npm install

# 1. Generate the RSA key pair (one-time; see below)
# 2. Create your env file
cp .env.example .env          # then set MONGO_URI (and COOKIE_SECRET in prod)
# 3. Make sure MongoDB (and optionally Redis) are running

npm start                     # starts on port 3000, watches files, loads .env
```

Smoke test:

```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/users/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"pass1234"}'

curl -s -b cookies.txt http://localhost:3000/api/users/currentuser
# → { "currentUser": { "id": "...", "email": "you@example.com" } }
```

## Generating the JWT keys

JWTs are signed with an RSA **private** key (RS256) and verified with the **public** key. The keys are expected at `auth/keys/` and are gitignored — every developer generates their own. The canonical commands live at the top of [src/middlewares/jwt.ts](src/middlewares/jwt.ts); in short (requires `keytool` from a JDK and `openssl`):

```bash
keytool -genkeypair -v -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
  -keystore auth/keys/jwt.p12 -storetype PKCS12 -storepass changeit -keypass changeit \
  -dname "CN=armirtickets, OU=dev, O=armirtickets, L=n/a, ST=n/a, C=n/a"

keytool -exportcert -alias upload -keystore auth/keys/jwt.p12 -storepass changeit -rfc -file auth/keys/public.pem

openssl pkcs12 -in auth/keys/jwt.p12 -nocerts -nodes -passin pass:changeit -out auth/keys/bag.pem
openssl pkcs8 -in auth/keys/bag.pem -nocrypt -out auth/keys/private.pem

rm auth/keys/jwt.p12 auth/keys/bag.pem
```

Without the keys the server exits immediately with a helpful error (it fails fast, on purpose). Other services in this repo can verify tokens using **only** `public.pem`.

## How it works

```
Client  ──▶  Express 5 app (port 3000)
                │  express.json() → cookie-session → routers → 404 fallback → errorHandler
                │
                ├─ /api/users/signup      validate → rate limit (5/15m) → check unique email → save (Argon2 hash) → set session JWT
                ├─ /api/users/signin      validate → rate limit (5/15m) → verify Argon2 hash → set session JWT
                ├─ /api/users/signout     clear the session cookie
                └─ /api/users/currentuser decode session JWT (RS256) → req.currentUser
```

Key design points:

- **Auth model** — signup/signin produce an RS256 JWT (default lifetime `1h`) that is stored in the `cookie-session` cookie. The client never handles the token directly — it just keeps sending the cookie. `GET /api/users/currentuser` resolves it back to `{ id, email }`; an invalid/expired token is treated as "no user" (returns `null`), not an error.
- **Validation** — `express-validator` rules in each route, converted to a standard error response by the shared `validateRequest` middleware from `@armitickets/common`.
- **Errors** — a shared error handler (`@armitickets/common`) turns thrown error classes into JSON responses (`{ "errors": [...] }`); see [API.md → Errors](API.md#errors).
- **Rate limiting** — [src/middlewares/rate-limit.ts](src/middlewares/rate-limit.ts) implements a fixed-window counter per `ip + path` in Redis. The TTL is set only on the first `INCR` of the window (a rolling `EXPIRE` would let a slow drip of requests evade the limit). If Redis is down or not connected, requests pass through (**fail open**).
- **Concurrency safety** — the "email already in use" check is closed against races by the unique index on `email`; a duplicate-key write (Mongo error 11000 on the `email` key) is translated to the same 400 the pre-check would have produced.
- **Proxy awareness** — `trust proxy` is **off** by default so clients can't forge `req.ip` via `X-Forwarded-For` to evade rate limiting. Set `TRUST_PROXY=1` when you sit behind one proxy hop.

## Environment variables

Copy from [.env.example](.env.example).

|Variable|Required|Default|Purpose|
| --- | --- | --- | --- |
|`MONGO_URI`|✅ (server startup)|—|MongoDB connection string|
|`REDIS_HOST` / `REDIS_PORT`|–|`localhost` / `6379`|Redis for rate limiting (optional — fails open if down)|
|`JWT_EXPIRES_IN`|–|`1h`|Lifetime of issued session JWTs (any `jsonwebtoken` duration string, e.g. `15m`, `7d`)|
|`COOKIE_SECRET`|⚠️ in production|–|Signs the session cookie. Unset locally = unsigned cookie (zero test setup); **set it in production**|
|`NODE_ENV`|–|–|When `production`, the session cookie is marked `Secure` (TLS-only)|
|`TRUST_PROXY`|–|off|Number of trusted reverse-proxy hops for `req.ip`; leave unset unless behind a proxy|

## Scripts

|Command|What it does|
| --- | --- |
|`npm start`|Run the server on :3000 with file watching, loading `.env` if present|
|`npm test`|Unit tests in **watch mode** (Jest)|
|`npm run test:ci`|Unit tests, single run (CI)|
|`npm run test:e2e`|End-to-end suite against a **live** server on :3000|
|`npm run typecheck`|`tsc --noEmit` — type-check without emitting|

## Testing

### Unit tests (`npm test` / `npm run test:ci`)

Jest 30 with **no transform** — Node runs the TypeScript natively (ESM, `--experimental-vm-modules`). Tests live in `src/**/__test__/` and cover the routes (signup, signin, signout, current-user), the JWT middleware, and rate limiting.

- **MongoDB**: [src/test/setup.ts](src/test/setup.ts) starts an in-memory MongoDB (`mongodb-memory-server`) per test run and wipes all collections between tests. No local Mongo needed.
- **Redis**: the rate-limit middleware takes an injectable client, so tests pass a fake — no local Redis needed.
- **JWT keys**: tests sign/verify real RS256 tokens, so the `auth/keys/` pair **must exist** (see [Generating the JWT keys](#generating-the-jwt-keys)).
- `npm test` runs in watch mode (`--watchAll`); use `npm run test:ci` for a one-shot run.

### End-to-end tests (`npm run test:e2e`)

[e2e/e2e.test.mjs](e2e/e2e.test.mjs) is a standalone script (not Jest) that plays a real browser: it keeps a cookie jar and walks the full journey — anonymous → signup (valid/invalid) → signed-in → signin (wrong password / unknown user / correct) → signout → anonymous again → 404 on an unknown route. It talks to a **live instance**, so:

```bash
# Terminal 1 — MongoDB and Redis running, then:
npm start

# Terminal 2 — in auth/:
npm run test:e2e                 # or: node e2e/e2e.test.mjs
node e2e/e2e.test.mjs --reset    # re-running within 15 min? Flushes Redis rate-limit counters first
```

Notes:

- Signup and signin are rate-limited to **5 requests / 15 min per IP** (see [API.md](API.md#rate-limits)). The suite is written to fit inside that budget — every request, including 400s, consumes budget. If you get 429s, re-run with `--reset` or wait out the window.
- Point it elsewhere with `E2E_BASE_URL` (default `http://localhost:3000`); `REDIS_HOST`/`REDIS_PORT` control the `--reset` flush.

## Project layout

```
auth/
├── e2e/e2e.test.mjs          # end-to-end suite (browser-like cookie jar)
├── keys/                     # RSA key pair — gitignored, generate per dev
├── src/
│   ├── index.ts              # entrypoint: connect Redis + Mongo, listen :3000
│   ├── app.ts                # Express app wiring (middleware, routers, 404, error handler)
│   ├── routes/               # signup, signin, signout, current-user (+ __test__/ unit tests)
│   ├── middlewares/          # jwt (RS256 sign/verify), rate-limit (Redis)
│   ├── models/user.ts        # Mongoose model: unique email, Argon2 hash on save, toJSON strips password
│   ├── services/password.ts  # Argon2 hash/verify
│   ├── test/setup.ts         # Jest global setup: in-memory MongoDB
│   └── types/                # ambient type declarations (e.g. argon2)
├── .env.example
├── Dockerfile
└── tsconfig.json
```

## Docker

[Dockerfile](Dockerfile) installs production deps and runs `npm start`. Remember to pass `MONGO_URI`, `COOKIE_SECRET`, `JWT_EXPIRES_IN`, and the `auth/keys/` pair (e.g. via a mounted volume or a build arg — **do not commit keys**). Note that `npm start` includes `--watch`, which is a development convenience; for a lean production entrypoint point the `CMD` at `node --env-file-if-exists=.env src/index.ts` instead.
