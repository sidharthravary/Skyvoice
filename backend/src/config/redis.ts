import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: Redis | null = null;
let isRedisConnected = false;

// Custom Mock Cache fallback class
class MockRedisCache {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    this.store.set(key, value);
    if (mode === 'EX' && duration) {
      setTimeout(() => this.store.delete(key), duration * 1000);
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const results: string[] = [];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.store.keys()) {
      if (regex.test(key)) results.push(key);
    }
    return results;
  }
}

const mockCache = new MockRedisCache();

export function getRedisClient(): Redis | MockRedisCache {
  if (isRedisConnected && redisClient) {
    return redisClient;
  }
  return mockCache;
}

export async function connectRedis(): Promise<void> {
  if (!process.env.REDIS_URL) {
    console.log('⚠️ REDIS_URL not configured. Using local in-memory mock cache.');
    return;
  }

  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        // Only try connecting once, then fail so we don't block server start
        if (times > 1) return null; 
        return 1000;
      },
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      console.warn('⚠️ Redis connection error. Falling back to local in-memory cache.');
      isRedisConnected = false;
    });
  } catch (error) {
    console.warn('⚠️ Redis setup failed. Using local in-memory cache.');
  }
}
