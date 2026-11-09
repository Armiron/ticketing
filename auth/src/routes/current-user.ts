import express from 'express';
// Local RS256 middleware (was @armitickets/common's symmetric-key version)
import { currentUser } from '../middlewares/jwt.ts';

const router = express.Router();

router.get(
  '/api/users/currentuser',
  currentUser,
  (req: express.Request, res: express.Response) => {
    res.send({ currentUser: req.currentUser || null });
  }
);

export { router as currentUserRouter };
