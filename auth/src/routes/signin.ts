import express from 'express';
import { body, validationResult } from 'express-validator';

import { BadRequestError } from '@armitickets/common';
import { validateRequest } from '@armitickets/common';

import User from '../models/user.ts';
import Password from '../services/password.ts';
import { rateLimit } from '../middlewares/rate-limit.ts';
import { signToken } from '../middlewares/jwt.ts';

const router = express.Router();

router.post(
  '/api/users/signin',
  [
    body('email').isEmail().withMessage('Email not valid'),
    body('password')
      .trim()
      .isLength({ min: 4, max: 20 })
      .withMessage('Password must be between 4 and 20 characters'),
  ],
  validateRequest,
  // Rate limit to 5 requests per 15 minutes for signin
  rateLimit(5, 15 * 60 * 1000),
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

    // Sign with the RSA private key (RS256) — throws a helpful error
    // if the keys in auth/keys/ haven't been generated yet
    const userJWT = signToken({
      id: existingUser.id,
      email: existingUser.email,
    });

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
