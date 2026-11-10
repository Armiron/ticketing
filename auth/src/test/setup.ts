import { beforeAll, beforeEach, afterAll } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../app.ts';
import { ensureKeys } from '@armitickets/common';

let mongo: MongoMemoryServer;

// Allow extra time for starting/stopping the in-memory Mongo server
// (slow on CI/Windows, especially under load from argon2 hashing).
beforeAll(async () => {
  // RS256 needs the key pair in <repoRoot>/keys/ - fail fast if missing (see common/README.md)
  ensureKeys();
  mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();

  await mongoose.connect(mongoUri);
}, 15000);

beforeEach(async () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Not connected to MongoDB in test setup');
  }
  const collections = await db.collections();

  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.close();
  // Stopping the mongod child can be slow on Windows — allow extra time
  await mongo.stop();
}, 30000);
