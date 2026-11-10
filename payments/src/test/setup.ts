import request from 'supertest';
import type { IncomingHttpHeaders } from 'http';
import { signToken } from '@armitickets/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../app';

declare global {
  function signin(id?: string): IncomingHttpHeaders;
}

jest.mock('../nats-wrapper');

// STRIPE_KEY is loaded from payments/.env by src/test/load-env.ts (jest
// "setupFiles") — keep the real key out of source code and git history.
if (!process.env.STRIPE_KEY) {
  throw new Error(
    'STRIPE_KEY is not set — copy payments/.env.example to payments/.env and add your Stripe test key'
  );
}

let mongo: any;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const mongoUri = await mongo.getUri();

  await mongoose.connect(mongoUri);
});

beforeEach(async () => {
  jest.clearAllMocks();
  const collections = await mongoose.connection.db.collections();

  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongo.stop();
  await mongoose.connection.close();
});

global.signin = (id?: string) => {
  // Build a JWT payload. {id, email}
  const payload = {
    id: id || new mongoose.Types.ObjectId().toHexString(),
    email: 'test@test.com',
  };
  // Create the JWT!
  const token = signToken(payload);
  // Build session object {jwt: MY_JWT}
  const session = { jwt: token };
  // Turn session into JSON
  const sessionJSON = JSON.stringify(session);
  // Take JSON and encode it as base64
  const base64 = Buffer.from(sessionJSON).toString('base64');
  // return a string thats the cookie with the encoded data
  const cookie = {
    Cookie: ['session=' + base64],
  };
  return cookie;
};
