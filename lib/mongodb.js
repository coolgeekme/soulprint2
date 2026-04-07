import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL;
const LOCAL_MONGO_URL = 'mongodb://localhost:27017/soulprint';
const DB_NAME = process.env.DB_NAME || 'soulprint';

// MongoDB connection options for high concurrency
const mongoOptions = {
  maxPoolSize: 1000,
  minPoolSize: 10,
  maxIdleTimeMS: 60000,
  connectTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 60000,
  retryWrites: true,
  retryReads: true,
};

// Use global to persist connection across Next.js hot reloads
const globalMongo = global._mongoConnection || (global._mongoConnection = {
  client: null,
  db: null,
  connectionPromise: null,
  usingFallback: false,
});

async function initConnection() {
  if (globalMongo.db) return globalMongo.db;
  if (globalMongo.connectionPromise) return globalMongo.connectionPromise;

  globalMongo.connectionPromise = (async () => {
    // Try primary connection (Atlas or configured URL)
    try {
      console.log(`[MongoDB] Connecting to primary: ${MONGO_URL?.substring(0, 40)}...`);
      globalMongo.client = new MongoClient(MONGO_URL, mongoOptions);
      await globalMongo.client.connect();
      globalMongo.db = globalMongo.client.db(DB_NAME);
      // Verify connection with a ping
      await globalMongo.db.command({ ping: 1 });
      console.log(`[MongoDB] Connected to primary database: ${DB_NAME}`);
      globalMongo.usingFallback = false;
      return globalMongo.db;
    } catch (primaryErr) {
      console.error(`[MongoDB] Primary connection failed: ${primaryErr.message}`);
      try { await globalMongo.client?.close(); } catch {}
      globalMongo.client = null;
      globalMongo.db = null;
    }

    // Fallback to local MongoDB if primary fails
    if (MONGO_URL !== LOCAL_MONGO_URL) {
      try {
        console.log(`[MongoDB] Attempting fallback to local MongoDB...`);
        globalMongo.client = new MongoClient(LOCAL_MONGO_URL, {
          ...mongoOptions,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        await globalMongo.client.connect();
        globalMongo.db = globalMongo.client.db(DB_NAME);
        await globalMongo.db.command({ ping: 1 });
        console.log(`[MongoDB] Connected to LOCAL fallback database: ${DB_NAME}`);
        globalMongo.usingFallback = true;
        return globalMongo.db;
      } catch (fallbackErr) {
        console.error(`[MongoDB] Fallback connection also failed: ${fallbackErr.message}`);
        try { await globalMongo.client?.close(); } catch {}
        globalMongo.client = null;
        globalMongo.db = null;
      }
    }

    globalMongo.connectionPromise = null;
    throw new Error('All MongoDB connections failed');
  })();

  try {
    return await globalMongo.connectionPromise;
  } catch (err) {
    globalMongo.connectionPromise = null;
    throw err;
  }
}

export async function getDb() {
  try {
    return await initConnection();
  } catch (err) {
    console.error(`[MongoDB] getDb failed: ${err.message}`);
    // Reset state so next call tries fresh
    globalMongo.db = null;
    globalMongo.client = null;
    globalMongo.connectionPromise = null;
    throw err;
  }
}

export function isUsingFallback() {
  return globalMongo.usingFallback;
}

export async function getClientPromise() {
  return initConnection();
}
