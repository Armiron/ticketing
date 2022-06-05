import * as express from 'express';
import { verify } from 'jsonwebtoken';
//Moved common code into a common package
//import { currentUser } from '../middlewares/current-user';
import { currentUser } from '@armitickets/common';

const router = express.Router();

router.get(
  '/api/users/currentuser',
  currentUser,
  (req: express.Request, res: express.Response) => {
    // Middle ware does it
    // if (!req.session.jwt) {
    //   return res.send({ currentUser: null });
    // }

    // try {
    //   const payload = verify(req.session.jwt, process.env.JWT_KEY);
    //   res.send({ currentUser: payload });
    // } catch (error) {
    //   res.send({ currentUser: null });
    // }
    res.send({ currentUser: req.currentUser || null });
  }
);

export { router as currentUserRouter };
