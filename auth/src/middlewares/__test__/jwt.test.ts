/**
 * Tests for the RS256 JWT helpers and the currentUser middleware.
 *
 * These exercise the sign/verify pair (private vs public key), the token
 * lifetime, rejection of tampered tokens, and the middleware that resolves
 * req.currentUser — using the real key pair in auth/keys/.
 */
import { describe, it, expect, jest } from '@jest/globals';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { signToken, verifyToken, currentUser } from '../jwt.ts';

const payload = { id: 'user-123', email: 'armir@test.com' };

function makeTamperedToken(token: string): string {
  // Flip one character of the signature segment — invalidates the RSA
  // signature deterministically without changing the payload.
  // Use the FIRST character: the last base64 char of a signature can carry
  // padding bits, so an A<->B flip there may encode the identical bytes
  // (i.e. no actual tampering) depending on the key size.
  const [header, body, signature] = token.split('.');
  const first = signature.charAt(0);
  const flipped = first === 'A' ? 'B' : 'A';
  return `${header}.${body}.${flipped}${signature.slice(1)}`;
}

describe('RS256 sign/verify', () => {
  it('round-trips a payload signed with the private key', () => {
    const token = signToken(payload);
    // `toMatchObject`: the token also carries iat/exp, which we ignore here.
    expect(verifyToken(token)).toMatchObject(payload);
  });

  it('uses the RS256 algorithm', () => {
    const token = signToken(payload);
    const decoded = jwt.decode(token, { complete: true }) as {
      header: { alg?: string };
    };
    expect(decoded.header.alg).toBe('RS256');
  });

  it('includes an expiry claim so tokens are not valid forever', () => {
    const token = signToken(payload);
    const decoded = jwt.decode(token) as JwtPayload;
    expect(decoded?.exp).toEqual(expect.any(Number));
    // Expiry is in the future.
    expect(decoded!.exp!).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects a tampered token', () => {
    const token = signToken(payload);
    expect(() => verifyToken(makeTamperedToken(token))).toThrow();
  });
});

describe('currentUser middleware', () => {
  it('populates req.currentUser for a valid token', () => {
    const token = signToken(payload);
    const req: any = { session: { jwt: token } };
    const next = jest.fn();

    currentUser(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.currentUser).toMatchObject(payload);
  });

  it('leaves req.currentUser unset for a tampered token', () => {
    const token = signToken(payload);
    const req: any = { session: { jwt: makeTamperedToken(token) } };
    const next = jest.fn();

    currentUser(req, {} as any, next);

    // Middleware still lets the request through, just without a user.
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.currentUser).toBeUndefined();
  });

  it('passes through untouched when there is no session token', () => {
    const req: any = { session: {} };
    const next = jest.fn();

    currentUser(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.currentUser).toBeUndefined();
  });
});
