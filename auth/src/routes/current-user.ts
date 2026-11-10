import express from 'express';
// RS256 currentUser middleware from @armitickets/common (shared by all services)
import { currentUser } from '@armitickets/common';

const router = express.Router();

router.get(
  '/api/users/currentuser',
  currentUser,
  (req: express.Request, res: express.Response) => {
    res.send({ currentUser: req.currentUser || null });
  }
);

export { router as currentUserRouter };
