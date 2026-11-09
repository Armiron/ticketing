# Auth API Reference

Base URL: `http://localhost:3000` (the server always listens on port 3000).

All request and response bodies are JSON (`Content-Type: application/json`).

## Authentication model

This API is **session-cookie based** — there are no `Authorization: Bearer` headers.

1. `POST /api/users/signup` or `POST /api/users/signin` returns a `Set-Cookie` header containing a signed `cookie-session` cookie. Inside that session lives an **RS256 JWT** (signed with the service's RSA private key, default lifetime `1h`, configurable via `JWT_EXPIRES_IN`).
2. The client sends the cookie back automatically (browsers do this; in scripts use a cookie jar, e.g. `curl -c/-b`).
3. `GET /api/users/currentuser` reads the token from the session and returns the decoded identity. An invalid, tampered, or expired token is treated as "not signed in" (`currentUser: null`) — **not** as an HTTP error.
4. `POST /api/users/signout` clears the session (the response sends the cookie with an expired `Max-Age`).

The JWT payload contains only `{ id, email, iat, exp }` — never the password.

## Endpoints

|Endpoint|Method|Auth|Rate limit|
| --- | --- | --- | --- |
|`/api/users/signup`|POST|no|5 / 15 min|
|`/api/users/signin`|POST|no|5 / 15 min|
|`/api/users/signout`|POST|no|—|
|`/api/users/currentuser`|GET|session cookie (optional)|—|

### `POST /api/users/signup`

Create a new account and start a session.

**Body**

|Field|Type|Constraints|
| --- | --- | --- |
|`email`|string|valid email|
|`password`|string|4–20 characters (trimmed)|

**Example**

```bash
curl -i -X POST http://localhost:3000/api/users/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"pass1234"}'
```

**201 Created** — `Set-Cookie` with the session, body is the new user (password never included):

```json
{ "id": "665f2a…", "email": "jane@example.com" }
```

**Errors**

|Status|Body|When|
| --- | --- | --- |
|400|`{ "errors": [{ "message": "Email must be valid", "field": "email" }] }`|validation failed (invalid email, password length)|
|400|`{ "errors": [{ "message": "Email already in use" }] }`|an account with that email exists|
|429|`{ "error": "Too many requests, please try again later." }`|rate limit exceeded (see below)|

### `POST /api/users/signin`

Validate credentials and start a fresh session.

**Body** — same as signup: `email` (valid email) + `password` (4–20 chars).

**Example**

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/api/users/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"pass1234"}'
```

**200 OK** — `Set-Cookie` with the session:

```json
{ "id": "665f2a…", "email": "jane@example.com" }
```

**Errors**

|Status|Body|When|
| --- | --- | --- |
|400|`{ "errors": [{ "message": "Email not valid", "field": "email" }] }`|invalid email format|
|400|`{ "errors": [{ "message": "Invalid credentials" }] }`|unknown email **or** wrong password (both cases use the same message — no user enumeration)|
|429|`{ "error": "Too many requests, please try again later." }`|rate limit exceeded|

### `POST /api/users/signout`

Clear the session. No body required. Safe to call with no active session.

```bash
curl -i -b cookies.txt -X POST http://localhost:3000/api/users/signout
```

**200 OK**

```json
{ "message": "Successfully signed out" }
```

The response also sends the session cookie expired, so a browser's jar drops it.

### `GET /api/users/currentuser`

Return the identity stored in the session, or `null` when anonymous.

```bash
curl -i -b cookies.txt http://localhost:3000/api/users/currentuser
```

**200 OK — signed in**

```json
{ "currentUser": { "id": "665f2a…", "email": "jane@example.com" } }
```

**200 OK — anonymous** (no session, or invalid/expired token)

```json
{ "currentUser": null }
```

## Errors

Application errors are thrown as typed errors and serialized by the shared error handler into a consistent shape:

```json
{ "errors": [ { "message": "…", "field": "…(optional, validation only)" } ] }
```

|Status|Meaning|
| --- | --- |
|400|Bad request: validation failure, invalid credentials, email already in use. Also used by the fallback handler for unexpected/unrecognized errors (`{ "errors": [{ "message": "Something went wrong" }] }`) — details are logged server-side instead of leaked|
|404|Unknown route: `{ "errors": [{ "message": "Not Found" }] }`|
|429|Rate limit exceeded: `{ "error": "Too many requests, please try again later." }` (note: a single `error` string, not the `errors` array)|
|500|Server-internal signout failure (only path that returns one)|

## Rate limits

|Endpoint|Limit|Window|Redis key prefix|
| --- | --- | --- | --- |
|`POST /api/users/signup`|5 requests|15 minutes, fixed, per client IP|`signup_rate_limit`|
|`POST /api/users/signin`|5 requests|15 minutes, fixed, per client IP|`rate_limit`|

- The window is **fixed** per IP + endpoint (set only on the first hit), so slow, steady requests can't reset it.
- If Redis is unavailable or not connected, rate limiting is **skipped** (fail open) — the service still serves requests.
- 429 responses use a different body shape than other errors: `{ "error": "…" }`.
- Testing tip: to reset counters locally, flush Redis (`redis-cli FLUSHALL`) — or run `node e2e/e2e.test.mjs --reset`, which does this for you.

## Security notes

- Passwords are stored as Argon2 hashes (memory 64 MB, 3 iterations) and are never returned in any response — the Mongoose `toJSON` transform strips them.
- The session cookie is signed only when `COOKIE_SECRET` is set (unset in dev/tests); it is marked `Secure` when `NODE_ENV=production`.
- `trust proxy` is off unless `TRUST_PROXY` is set, so clients cannot spoof `X-Forwarded-For` to bypass per-IP rate limiting.
- Signin returns the same "Invalid credentials" error for unknown email and wrong password to avoid user enumeration.
