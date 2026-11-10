# @armitickets/common (v2)

Shared library for the ticketing microservices. Ships a **CommonJS** build
(`dist/`) so it works from both the ESM-native `auth` service (Node type
stripping) and the CJS services (`tickets`, `orders`, `payments`,
`expiration`, ts-node + jest).

## What it exports

- **Errors**: `CustomError` (abstract base), `BadRequestError`,
  `NotAuthorisedError`, `NotFoundError`, `DatabaseConnectionError`,
  `RequestValidationError`
- **Middlewares**: `currentUser` (resolves the session JWT into
  `req.currentUser`, RS256), `requireAuth` (401 if no user),
  `validateRequest` (express-validator → `RequestValidationError`),
  `errorHandler` (renders `CustomError`s)
- **JWT (RS256)**: `signToken(payload)` (RSA private key, `expiresIn`
  defaults to `1h`, override with `JWT_EXPIRES_IN`), `verifyToken(token)`
  (RSA public key, RS256 only), `ensureKeys()` (fail-fast check that both
  key files exist — call at startup)
- **Events (NATS)**: `Listener`, `Publisher`, `Subjects`, and the event
  interfaces `TicketCreatedEvent`, `TicketUpdatedEvent`,
  `OrderCreatedEvent`, `OrderCancelledEvent`, `ExpirationCompleteEvent`,
  `PaymentCreatedEvent`, plus the `OrderStatus` enum
- **Types**: `UserPayload`, and the global `Express.Request` augmentation
  adding `currentUser?: UserPayload`

## Build

```bash
cd common
npm install
npm run build   # tsc → dist/ (also runs automatically via "prepare" on install)
```

## Keys (RS256)

Tokens are signed with an RSA **private** key and verified with the RSA
**public** key (no more shared `JWT_KEY`). Keys are gitignored and live at
`<repoRoot>/keys/` by default. Override the locations with
`JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH`.

Generate the pair (needs keytool + openssl):

```bash
keytool -genkeypair -v -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
  -keystore keys/jwt.p12 -storetype PKCS12 -storepass changeit -keypass changeit \
  -dname "CN=armirtickets, OU=dev, O=armirtickets, L=n/a, ST=n/a, C=n/a"
keytool -exportcert -alias upload -keystore keys/jwt.p12 -storepass changeit -rfc -file keys/public.pem
openssl pkcs12 -in keys/jwt.p12 -nocerts -nodes -passin pass:changeit -out keys/bag.pem
openssl pkcs8 -in keys/bag.pem -nocrypt -out keys/private.pem
rm keys/jwt.p12 keys/bag.pem
```

## Adding an event

1. Add a subject to `Subjects` in `src/events/Subjects.ts`
   (e.g. `RefundIssued = 'refund:issued'`).
2. Create `src/events/RefundIssuedEvent.ts` with an interface:
   `subject: Subjects.RefundIssued` and a `data` shape.
3. Re-export it from `src/index.ts`.
4. Subclass `Publisher` (producer) and `Listener` (consumer) in the
   services, as the existing events do.
5. Rebuild: `npm run build` (or just `npm install` at the repo root — the
   `prepare` script rebuilds automatically).
