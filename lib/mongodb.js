import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL;
const LOCAL_MONGO_URL = 'mongodb://localhost:27017/soulprint';
const DB_NAME = process.env.DB_NAME || 'soulprint';

// MongoDB connection options for high concurrency
const mongoOptions = {
  maxPoolSize: 200,
  minPoolSize: 10,
  maxIdleTimeMS: 60000,
  connectTimeoutMS: 15000,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 60000,
  retryWrites: true,
  retryReads: true,
};

let client = null;
let db = null;
let connectionPromise = null;
let usingFallback = false;

async function initConnection() {
  if (db) return db;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    // Try primary connection (Atlas or configured URL)
    try {
      console.log(`[MongoDB] Connecting to primary: ${MONGO_URL?.substring(0, 40)}...`);
      client = new MongoClient(MONGO_URL, mongoOptions);
      await client.connect();
      db = client.db(DB_NAME);
      // Verify connection with a ping
      await db.command({ ping: 1 });
      console.log(`[MongoDB] Connected to primary database: ${DB_NAME}`);
      usingFallback = false;
      return db;
    } catch (primaryErr) {
      console.error(`[MongoDB] Primary connection failed: ${primaryErr.message}`);
      // Clean up failed primary client
      try { await client?.close(); } catch {}
      client = null;
      db = null;
    }

    // Fallback to local MongoDB if primary fails
    if (MONGO_URL !== LOCAL_MONGO_URL) {
      try {
        console.log(`[MongoDB] Attempting fallback to local MongoDB...`);
        client = new MongoClient(LOCAL_MONGO_URL, {
          ...mongoOptions,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        await client.connect();
        db = client.db(DB_NAME);
        await db.command({ ping: 1 });
        console.log(`[MongoDB] Connected to LOCAL fallback database: ${DB_NAME}`);
        usingFallback = true;
        return db;
      } catch (fallbackErr) {
        console.error(`[MongoDB] Fallback connection also failed: ${fallbackErr.message}`);
        try { await client?.close(); } catch {}
        client = null;
        db = null;
      }
    }

    connectionPromise = null;
    throw new Error('All MongoDB connections failed');
  })();

  try {
    return await connectionPromise;
  } catch (err) {
    connectionPromise = null;
    throw err;
  }
}

export async function getDb() {
  try {
    return await initConnection();
  } catch (err) {
    console.error(`[MongoDB] getDb failed: ${err.message}`);
    // Reset state so next call tries fresh
    db = null;
    client = null;
    connectionPromise = null;
    throw err;
  }
}

export function isUsingFallback() {
  return usingFallback;
}

export async function getClientPromise() {
  return initConnection();
}
