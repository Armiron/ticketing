import express from 'express';
import 'express-async-errors';
import { json } from 'body-parser';
//Still a mystery
import cookieSession = require('cookie-session');

// import { errorHandler } from './middlewares/error-handler';
// import NotFoundError from './errors/not-found-error';
import { currentUser, errorHandler, NotFoundError } from '@armitickets/common';
import { createTicketRouter } from './routes/new';
import { showTicketRouter } from './routes/show';
import { indexTicketRouter } from './routes';
import { updateTicketRouter } from './routes/update';

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
app.use(createTicketRouter);
app.use(showTicketRouter);
app.use(indexTicketRouter);
app.use(updateTicketRouter);

app.all('*', async (req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
