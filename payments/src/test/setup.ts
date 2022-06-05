import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../app';

declare global {
  function signin(id?: string): object;
}

jest.mock('../nats-wrapper');

process.env.STRIPE_KEY =
  'sk_test_51L4o3DIE6nQ8t94Ydgro23SeenKWJOCMISy9o2JcJntAJ0XwAfMAu9doFBTrOdl0AgHrQFmBu3fBCOqV0eN3gC4c00rwXYMVkg';

let mongo: any;

beforeAll(async () => {
  process.env.JWT_KEY = 'qwer';
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
  const token = jwt.sign(payload, process.env.JWT_KEY!);
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
