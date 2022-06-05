import * as express from 'express';
import { body, validationResult } from 'express-validator';
import { sign } from 'jsonwebtoken';
// import BadRequestError from '../errors/bad-request-error';
// import RequestValidationError from '../errors/request-validation-error';
// import { validateRequest } from '../middlewares/validate-request';

import { BadRequestError } from '@armitickets/common';
//import RequestValidationError from '../errors/request-validation-error';
import { validateRequest } from '@armitickets/common';

import User from '../models/user';
import Password from '../services/password';

const router = express.Router();

router.post(
  '/api/users/signin',
  [
    body('email').isEmail().withMessage('Email not valid'),
    body('password')
      .trim()
      .notEmpty()
      .withMessage('You must enter your password'),
  ],
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    // Moved Validation into middleware
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   throw new RequestValidationError(errors.array());
    // }
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      throw new BadRequestError('Invalid credentials');
    }

    const passwordsMatch = await Password.compare(
      existingUser.password,
      password
    );
    if (!passwordsMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    const userJWT = sign(
      {
        id: existingUser.id,
        email: existingUser.email,
      },
      process.env
        .JWT_KEY! /*Secret Key !exclamation after and we teel it we checked*/
    );

    // Store it in session object
    // Types issue
    //req.session.jwt = userJWT;
    req.session = {
      jwt: userJWT,
    };

    res.status(200).send(existingUser); //password in a hashed format
  }
);

export { router as signinRouter };
