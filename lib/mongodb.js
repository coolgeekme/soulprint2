import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'soulprint';

if (!MONGO_URL) {
  console.warn('[MongoDB] MONGO_URL environment variable is not set');
}

// MongoDB connection options for better stability and high concurrency
const mongoOptions = {
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 60000,
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  retryWrites: true,
  retryReads: true,
};

let client;
let clientPromise;
let connectionAttempted = false;

function initConnection() {
  if (connectionAttempted) {
    return clientPromise;
  }
  
  connectionAttempted = true;
  
  if (!MONGO_URL) {
    throw new Error('MONGO_URL environment variable is not set');
  }

  if (process.env.NODE_ENV === 'development') {
    // In development, use a global variable to preserve connection across HMR
    if (!global._mongoClientPromise) {
      client = new MongoClient(MONGO_URL, mongoOptions);
      global._mongoClientPromise = client.connect().catch(err => {
        console.error('[MongoDB] Connection failed:', err.message);
        global._mongoClientPromise = null;
        connectionAttempted = false;
        throw err;
      });
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // In production, create new connection
    client = new MongoClient(MONGO_URL, mongoOptions);
    clientPromise = client.connect().catch(err => {
      console.error('[MongoDB] Production connection failed:', err.message);
      connectionAttempted = false;
      throw err;
    });
  }
  
  return clientPromise;
}

export async function getDb() {
  try {
    const promise = initConnection();
    const c = await promise;
    return c.db(DB_NAME);
  } catch (err) {
    console.error('[MongoDB] getDb failed:', err.message);
    // Reset connection flag to allow retry
    connectionAttempted = false;
    clientPromise = null;
    throw err;
  }
}

export default function getClientPromise() {
  return initConnection();
}
