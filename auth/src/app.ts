import express from 'express';
import cookieSession from 'cookie-session';

import { currentUserRouter } from './routes/current-user.ts';
import { signinRouter } from './routes/signin.ts';
import { signoutRouter } from './routes/signout.ts';
import { signupRouter } from './routes/signup.ts';
import { errorHandler, NotFoundError } from '@armitickets/common';

const app = express();
// Only trust the leftmost X-Forwarded-For hop when running behind a reverse
// proxy. `trust proxy: true` (trust every hop) lets a client forge req.ip via
// X-Forwarded-For and evade IP-based rate limiting, so it's off by default.
// Set TRUST_PROXY to the number of proxy hops in production (e.g. 1).
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set('trust proxy', Number(trustProxy) || 1);
}

app.use(express.json());
// Sign the session cookie when a secret is configured (set COOKIE_SECRET in
// production). Unsigned by default here so tests need no extra setup.
app.use(
  cookieSession({
    secret: process.env.COOKIE_SECRET,
    signed: !!process.env.COOKIE_SECRET,
    // `secure: true` makes cookie-session DROP the Set-Cookie header on any
    // non-HTTPS request — so with NODE_ENV=development the session cookie
    // was silently never sent on http://localhost. Only mark Secure where
    // the app actually runs behind TLS (production).
    secure: process.env.NODE_ENV === 'production',
  })
);

app.use(currentUserRouter);
app.use(signinRouter);
app.use(signoutRouter);
app.use(signupRouter);

// Fallback 404 for anything the routers above didn't handle.
// (Express 5's path patterns no longer accept a bare '*', so this is a plain
// middleware placed last instead of `app.all('*')`. Express 5 also forwards
// rejected promises from async handlers to the error handler natively, so
// the old express-async-errors monkey-patch is no longer needed.)
app.use(async (req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
