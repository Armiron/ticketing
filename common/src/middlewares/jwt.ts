import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

// RSA key pair for RS256 JWTs (replaces the old shared-secret JWT_KEY).
// Signing uses the private key, verification the public key.
//
// Keys default to <repoRoot>/keys/{private,public}.pem (this file compiles
// to common/dist/middlewares/jwt.js, so the repo root is three levels up).
// Override with JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH.
//
// Generate the pair with keytool (see common/README.md):
//   keytool -genkeypair -v -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
//     -keystore keys/jwt.p12 -storetype PKCS12 -storepass changeit -keypass changeit \
//     -dname "CN=armirtickets, OU=dev, O=armirtickets, L=n/a, ST=n/a, C=n/a"
//   keytool -exportcert -alias upload -keystore keys/jwt.p12 -storepass changeit -rfc -file keys/public.pem
//   openssl pkcs12 -in keys/jwt.p12 -nocerts -nodes -passin pass:changeit -out keys/bag.pem
//   openssl pkcs8 -in keys/bag.pem -nocrypt -out keys/private.pem
//   rm keys/jwt.p12 keys/bag.pem
const KEY_HINT =
  'JWT keys not found — expected the RSA pair at <repoRoot>/keys/private.pem ' +
  'and keys/public.pem (or set JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH). ' +
  'Generate them with keytool — see common/README.md';

function privateKeyPath(): string {
  return (
    process.env.JWT_PRIVATE_KEY_PATH ||
    path.join(__dirname, '..', '..', '..', 'keys', 'private.pem')
  );
}

function publicKeyPath(): string {
  return (
    process.env.JWT_PUBLIC_KEY_PATH ||
    path.join(__dirname, '..', '..', '..', 'keys', 'public.pem')
  );
}

function loadPrivateKey(): string {
  const privateKeyPathValue = privateKeyPath();
  if (!fs.existsSync(privateKeyPathValue)) {
    throw new Error(KEY_HINT);
  }
  return fs.readFileSync(privateKeyPathValue, 'utf8');
}

function loadPublicKey(): string {
  const publicKeyPathValue = publicKeyPath();
  if (!fs.existsSync(publicKeyPathValue)) {
    throw new Error(KEY_HINT);
  }
  return fs.readFileSync(publicKeyPathValue, 'utf8');
}

// Fail fast with a helpful message if the keys were never generated.
export function ensureKeys(): void {
  loadPrivateKey();
  loadPublicKey();
}

// Sign a payload with the RSA private key (RS256).
// `expiresIn` gives the token a finite lifetime — without it a token is
// valid forever once issued.
export function signToken(payload: Record<string, unknown>): string {
  // @types/jsonwebtoken types `expiresIn` as ms.StringValue; plain string
  // env values don't satisfy that, but the runtime accepts any duration.
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, loadPrivateKey(), options);
}

// Verify a token with the RSA public key (RS256). Throws if invalid.
// Returns the claims; callers pick out the identity (id/email).
export function verifyToken(token: string): { id: string; email: string } {
  const payload = jwt.verify(token, loadPublicKey(), { algorithms: ['RS256'] });
  if (typeof payload === 'string') {
    throw new Error('Invalid JWT payload');
  }
  return payload as { id: string; email: string };
}
