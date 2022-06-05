import express from 'express';
import 'express-async-errors';
import { json } from 'body-parser';
//Still a mystery
import cookieSession = require('cookie-session');

// import { errorHandler } from './middlewares/error-handler';
// import NotFoundError from './errors/not-found-error';
import { currentUser, errorHandler, NotFoundError } from '@armitickets/common';
import { indexOrderRouter } from './routes';
import { newOrderRouter } from './routes/new';
import { showOrderRouter } from './routes/show';
import { deleteOrderRouter } from './routes/delete';

const app = express();
app.set('trust proxy', true);

app.use(json());
//we dont need encryption
app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV !== 'test',
  })
);

// After session we have currentUser as a global
app.use(currentUser);
app.use(deleteOrderRouter);
app.use(showOrderRouter);
app.use(indexOrderRouter);
app.use(newOrderRouter);

app.all('*', async (req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
