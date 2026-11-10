import type { Request, Response, NextFunction } from 'express';
import { NotAuthorisedError } from '../errors/NotAuthorisedError';

// Require a resolved user (set by the `currentUser` middleware),
// otherwise reject with 401.
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.currentUser) {
    throw new NotAuthorisedError();
  }
  next();
};
