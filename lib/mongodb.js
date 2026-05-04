import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL;
const LOCAL_MONGO_URL = 'mongodb://localhost:27017/soulprint';
const DB_NAME = process.env.DB_NAME || 'soulprint';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// MongoDB connection options — maxPoolSize intentionally omitted here 
// to inherit from the connection string (currently 200 in .env).
// Only set options that ADD to what's in the connection string.
const mongoOptions = {
  // Pool size: Let connection string `maxPoolSize=200` take effect.
  // Only set min to keep warm connections ready:
  minPoolSize: 5,
  maxIdleTimeMS: 120000,          // Close idle connections after 2 min
  connectTimeoutMS: 15000,        // 15s to establish connection (Atlas can be slow)
  serverSelectionTimeoutMS: 15000,// 15s to find a server in the replica set
  socketTimeoutMS: 90000,         // 90s for long operations
  retryWrites: true,
  retryReads: true,
  heartbeatFrequencyMS: 10000,    // Check server health every 10s
};

// Use global to persist connection across Next.js hot reloads
const globalMongo = global._mongoConnection || (global._mongoConnection = {
  client: null,
  db: null,
  connectionPromise: null,
  usingFallback: false,
  lastHealthCheck: 0,
  consecutiveFailures: 0,
});

/**
 * Verify the connection is alive with a ping.
 * Returns true if healthy, false otherwise.
 */
async function isConnectionHealthy() {
  if (!globalMongo.db) return false;
  try {
    await globalMongo.db.command({ ping: 1 });
    return true;
  } catch (e) {
    console.error(`[MongoDB] Health check failed: ${e.message}`);
    return false;
  }
}

/**
 * Reset the connection state so the next call starts fresh.
 */
function resetConnection() {
  try { globalMongo.client?.close(); } catch {}
  globalMongo.client = null;
  globalMongo.db = null;
  globalMongo.connectionPromise = null;
  globalMongo.usingFallback = false;
}

async function initConnection() {
  // If we already have a DB, check health periodically (every 30s)
  if (globalMongo.db) {
    const now = Date.now();
    const timeSinceLastCheck = now - globalMongo.lastHealthCheck;
    
    // Quick return if recently checked (within 30s)
    if (timeSinceLastCheck < 30000) {
      return globalMongo.db;
    }
    
    // Periodic health check
    globalMongo.lastHealthCheck = now;
    const healthy = await isConnectionHealthy();
    if (healthy) {
      globalMongo.consecutiveFailures = 0;
      return globalMongo.db;
    }
    
    // Connection is dead — reset and reconnect
    console.warn('[MongoDB] Connection lost. Attempting to reconnect...');
    globalMongo.consecutiveFailures++;
    resetConnection();
  }

  if (globalMongo.connectionPromise) return globalMongo.connectionPromise;

  globalMongo.connectionPromise = (async () => {
    // ─── Try primary connection (Atlas) ─────────────────────────────────
    try {
      console.log(`[MongoDB] Connecting to primary: ${MONGO_URL?.substring(0, 40)}...`);
      globalMongo.client = new MongoClient(MONGO_URL, mongoOptions);
      await globalMongo.client.connect();
      globalMongo.db = globalMongo.client.db(DB_NAME);
      // Verify connection with a ping
      await globalMongo.db.command({ ping: 1 });
      console.log(`[MongoDB] Connected to primary database: ${DB_NAME} (pool inherited from connection string)`);
      globalMongo.usingFallback = false;
      globalMongo.lastHealthCheck = Date.now();
      globalMongo.consecutiveFailures = 0;
      return globalMongo.db;
    } catch (primaryErr) {
      console.error(`[MongoDB] Primary connection failed: ${primaryErr.message}`);
      try { await globalMongo.client?.close(); } catch {}
      globalMongo.client = null;
      globalMongo.db = null;
    }

    // ─── Fallback to local MongoDB — ONLY in development ────────────────
    // CRITICAL: In production, we NEVER fall back to local MongoDB.
    // Connecting to an empty local DB would make users think their data is gone.
    if (!IS_PRODUCTION && MONGO_URL !== LOCAL_MONGO_URL) {
      try {
        console.log(`[MongoDB] [DEV ONLY] Attempting fallback to local MongoDB...`);
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
        globalMongo.lastHealthCheck = Date.now();
        return globalMongo.db;
      } catch (fallbackErr) {
        console.error(`[MongoDB] Fallback connection also failed: ${fallbackErr.message}`);
        try { await globalMongo.client?.close(); } catch {}
        globalMongo.client = null;
        globalMongo.db = null;
      }
    } else if (IS_PRODUCTION) {
      console.error('[MongoDB] PRODUCTION: No fallback. Primary connection must succeed.');
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

/**
 * Get the database instance with automatic reconnection.
 * Includes one retry on failure for transient issues.
 */
export async function getDb() {
  try {
    return await initConnection();
  } catch (err) {
    console.error(`[MongoDB] getDb first attempt failed: ${err.message}`);
    // Reset state
    resetConnection();
    
    // One automatic retry for transient failures
    try {
      console.log(`[MongoDB] Retrying connection...`);
      return await initConnection();
    } catch (retryErr) {
      console.error(`[MongoDB] getDb retry also failed: ${retryErr.message}`);
      resetConnection();
      throw retryErr;
    }
  }
}

export function isUsingFallback() {
  return globalMongo.usingFallback;
}

/**
 * Ensure critical database indexes exist.
 * Called once on first connection. Safe to call multiple times.
 */
export async function ensureCriticalIndexes() {
  try {
    const db = await getDb();
    // Unique email index prevents duplicate user creation during connection hiccups
    await db.collection('users').createIndex(
      { email: 1 }, 
      { unique: true, sparse: true, background: true }
    );
    // Performance indexes for common queries
    await db.collection('conversations').createIndex(
      { user_id: 1, updated_at: -1 },
      { background: true }
    );
    await db.collection('messages').createIndex(
      { user_id: 1, created_at: -1 },
      { background: true }
    );
    await db.collection('messages').createIndex(
      { conversation_id: 1, created_at: 1 },
      { background: true }
    );
    console.log('[MongoDB] Critical indexes ensured.');
  } catch (err) {
    // Non-fatal — indexes may already exist or DB might not be ready
    if (err.code !== 85 && err.code !== 86) { // 85=IndexOptionsConflict, 86=IndexKeySpecsConflict
      console.warn('[MongoDB] Index creation warning:', err.message);
    }
  }
}

export async function getClientPromise() {
  return initConnection();
}
