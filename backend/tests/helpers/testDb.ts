import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

// Connects tests to MongoDB.
// - Default: an in-memory MongoDB (binary auto-downloaded on first run).
// - MONGO_TEST_URI set: connect there instead (e.g. the docker-compose mongo:
//   MONGO_TEST_URI=mongodb://localhost:27017 npm test). Useful when the
//   binary download is blocked/corrupted by AV or a proxy.
let mongod: MongoMemoryServer | null = null;

export async function connectTestDb(dbName: string): Promise<void> {
  const external = process.env.MONGO_TEST_URI;
  if (external) {
    const base = external.replace(/\/+$/, '');
    await mongoose.connect(`${base}/${dbName}`);
    await mongoose.connection.dropDatabase(); // isolated, repeatable runs
    return;
  }
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(dbName));
}

export async function disconnectTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    if (process.env.MONGO_TEST_URI) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}
