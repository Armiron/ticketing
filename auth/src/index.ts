import mongoose from 'mongoose';
import { app } from './app.ts';
import { redisClient } from './middlewares/rate-limit.ts';
import { ensureKeys } from './middlewares/jwt.ts';

const start = async () => {
  console.log('Starting up...');

  // Fail fast with a helpful message if the RSA keys are missing
  ensureKeys();
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI not specified');
  }

  try {
    // Connect to Redis (v4 clients must be connected explicitly).
    // If it's unavailable, keep going — rate limiting degrades gracefully.
    try {
      await redisClient.connect();
      console.log('Connected to Redis');
    } catch (err) {
      console.warn(
        'Redis unavailable, rate limiting disabled:',
        (err as Error).message
      );
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to mongoDB');
  } catch (err) {
    console.error('Failed to connect to services:', err);
    process.exit(1);
  }

  app.listen(3000, () => {
    console.log('Listening on port 3000!!!!');
  });
};

start();
