import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/user.ts';
// import DatabaseConnectionError from '../errors/database-connection-error';
// import RequestValidationError from '../errors/request-validation-error';
// import BadRequestError from '../errors/bad-request-error';
// import { validateRequest } from '../middlewares/validate-request';
import { validateRequest, BadRequestError } from '@armitickets/common';
import { rateLimit } from '../middlewares/rate-limit.ts';
import { signToken } from '@armitickets/common';

const router = express.Router();

router.post(
  '/api/users/signup',
  [
    body('email').isEmail().withMessage('Email must be valid'),
    body('password')
      .trim()
      .isLength({ min: 4, max: 20 })
      .withMessage('Password must be between 4 and 20 characters'),
  ],
  validateRequest,
  // Rate limit to 5 requests per 15 minutes for signup
  rateLimit(5, 15 * 60 * 1000, 'signup_rate_limit'),
  async (req: express.Request, res: express.Response) => {
    // Moved request validation into middleware
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   //return res.status(400).send(errors.array());

    //   //JavaScript land
    //   // const error = new Error("Invalid email or password");
    //   // error.reasons = errors.array();
    //   // throw error;

    //   //Base approach
    //   //throw new Error('Invalid email or password');

    //   //Big brain approach
    //   throw new RequestValidationError(errors.array());
    // }

    const { email, password } = req.body;

    //console.log('Creating a user!!');

    //throw new Error('Error connecting to database');
    //throw new DatabaseConnectionError();

    //express-validator does it better
    // if (!email || typeof email !== 'string') {
    //   res.sendStatus(400);
    // }

    //res.send({});

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new BadRequestError('Email already in use');
    }

    const user = User.build({ email, password });
    try {
      await user.save();
    } catch (error) {
      // Concurrent signup of the same email slips past the findOne check
      // above; the unique index turns it into a Mongo duplicate-key error
      // (code 11000). Only the EMAIL index maps to this message — any other
      // unique-index violation (e.g. a stale index on another field) must
      // surface as a real server error, not be misreported as a duplicate.
      const mongoError = error as {
        code?: number;
        keyPattern?: Record<string, unknown>;
      };
      if (mongoError?.code === 11000 && mongoError.keyPattern?.email) {
        throw new BadRequestError('Email already in use');
      }
      throw error;
    }

    // Sign with the RSA private key (RS256) — throws a helpful error
    // if the RSA keys (repo-root keys/) have not been generated yet - see common/README.md
    const userJWT = signToken({
      id: user.id,
      email: user.email,
    });

    // Store it in session object
    // Types issue
    //req.session.jwt = userJWT;
    req.session = {
      jwt: userJWT,
    };

    res.status(201).send(user); //password in a hashed format
  },
);

export { router as signupRouter };
