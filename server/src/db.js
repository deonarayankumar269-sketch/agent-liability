import mongoose from 'mongoose';
import { config } from './config.js';

let memServer = null;

export async function connectDb() {
  let uri = config.mongoUri;
  if (!uri) {
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memServer = await MongoMemoryServer.create();
      uri = memServer.getUri('agentliability');
      console.log('[db] no MONGODB_URI set, using in-memory mongo (resets on restart)');
    } catch (err) {
      console.error('[db] could not start in-memory mongo:', err.message);
      console.error('[db] set MONGODB_URI in .env (Atlas free cluster or local mongod) and restart');
      throw err;
    }
  }
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri);
  console.log('[db] connected');
}

export async function closeDb() {
  await mongoose.disconnect();
  if (memServer) await memServer.stop();
}
