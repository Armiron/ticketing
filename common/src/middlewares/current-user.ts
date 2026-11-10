import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';

export interface UserPayload {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: UserPayload;
    }
  }
}

// Resolve a signed-in user from the session token (RS256) into
// `req.currentUser`. Invalid, tampered or expired tokens act as if no
// user is logged in.
export const currentUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session?.jwt) {
    return next();
  }

  try {
    const payload = verifyToken(req.session.jwt);
    // Expose only the user identity, not the full JWT claims (iat/exp/etc).
    req.currentUser = { id: payload.id, email: payload.email };
  } catch (error) {
    console.log('user is using an invalid JWT');
  }

  next();
};
