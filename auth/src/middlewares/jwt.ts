import type { Request, Response, NextFunction } from 'express';
// Default import: jsonwebtoken is CJS and Node's export detection can't see
// its named exports — the default gives us the whole module object.
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// RSA key pair for RS256 JWTs (replaces the old shared-secret JWT_KEY from
// @armitickets/common). Signing happens with the private key, verification
// with the public key.
//
// Keys live in auth/keys/ and are gitignored. Generate them with keytool:
//   keytool -genkeypair -v -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
//     -keystore auth/keys/jwt.p12 -storetype PKCS12 -storepass changeit -keypass changeit \
//     -dname "CN=armirtickets, OU=dev, O=armirtickets, L=n/a, ST=n/a, C=n/a"
//   keytool -exportcert -alias upload -keystore auth/keys/jwt.p12 -storepass changeit -rfc -file auth/keys/public.pem
//   openssl pkcs12 -in auth/keys/jwt.p12 -nocerts -nodes -passin pass:changeit -out auth/keys/bag.pem
//   openssl pkcs8 -in auth/keys/bag.pem -nocrypt -out auth/keys/private.pem
//   rm auth/keys/jwt.p12 auth/keys/bag.pem
// ESM has no `__dirname` — derive it from import.meta.url
const KEYS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'keys'
);
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');
const KEY_HINT =
  'JWT keys not found in auth/keys/ — generate them with keytool ' +
  '(see the commands at the top of src/middlewares/jwt.ts)';

function loadPrivateKey(): string {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    throw new Error(KEY_HINT);
  }
  return fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
}

function loadPublicKey(): string {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) {
    throw new Error(KEY_HINT);
  }
  return fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
}

// Fail fast with a helpful message if the keys were never generated.
export function ensureKeys(): void {
  loadPrivateKey();
  loadPublicKey();
}

// Sign a payload with the RSA private key (RS256).
// `expiresIn` gives the token a finite lifetime — without it a token is
// valid forever once issued.
// `Record<string, unknown>` (not bare `object`) so jsonwebtoken's overload
// resolution picks the options-based `sign()` instead of the callback one.
export function signToken(payload: Record<string, unknown>): string {
  // @types/jsonwebtoken now types `expiresIn` as `ms.StringValue` (a
  // template-literal type), which plain `string` env values don't satisfy —
  // the runtime accepts any duration string, so we cast.
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, loadPrivateKey(), options);
}

// Verify a token with the RSA public key (RS256). Throws if invalid.
// Matches the UserPayload shape (@armitickets/common augments Express.Request
// with `currentUser?: { id: string; email: string }`).
export function verifyToken(token: string): { id: string; email: string } {
  const payload = jwt.verify(token, loadPublicKey(), { algorithms: ['RS256'] });
  if (typeof payload === 'string') {
    throw new Error('Invalid JWT payload');
  }
  return payload as { id: string; email: string };
}

// Auth middleware (local replacement for @armitickets/common's currentUser):
// if the session holds a token, resolve it into req.currentUser.
export function currentUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.session?.jwt) {
    return next();
  }

  try {
    const payload = verifyToken(req.session.jwt);
    // Expose only the user identity, not the full JWT claims (iat/exp/etc).
    req.currentUser = { id: payload.id, email: payload.email };
  } catch (error) {
    // Invalid, tampered or expired token — act as if no user is logged in
  }

  next();
}
