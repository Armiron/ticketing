import * as express from 'express';
import { body, validationResult } from 'express-validator';
import { sign } from 'jsonwebtoken';
import User from '../models/user';
// import DatabaseConnectionError from '../errors/database-connection-error';
// import RequestValidationError from '../errors/request-validation-error';
// import BadRequestError from '../errors/bad-request-error';
// import { validateRequest } from '../middlewares/validate-request';
import { validateRequest, BadRequestError } from '@armitickets/common';

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
      //console.log('Email in use');
      //return res.send({});
      throw new BadRequestError('Email already in use');
    }

    const user = User.build({ email, password });
    await user.save();

    // Generate JWT
    // Should know immediatly not later on
    // if (!process.env.JWT_KEY) {
    //   throw new Error('JWT_KEY not specified');
    // }

    const userJWT = sign(
      {
        id: user.id,
        email: user.email,
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

    res.status(201).send(user); //password in a hashed format
  }
);

export { router as signupRouter };
