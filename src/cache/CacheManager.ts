import NodeCache from 'node-cache';

export interface CacheConfig {
  type: 'memory'; // Only memory cache for local-first approach
  ttl?: number; // Time to live in seconds
}

export class CacheManager {
  private memoryCache: NodeCache;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.memoryCache = new NodeCache({ 
      stdTTL: config.ttl || 3600, // 1 hour default
      checkperiod: 600 // Check for expired keys every 10 minutes
    });
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const cacheKey = this.generateKey(key);
    const finalTTL = ttl !== undefined ? ttl : (this.config.ttl || 3600);
    this.memoryCache.set(cacheKey, value, finalTTL);
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.generateKey(key);
    return this.memoryCache.get(cacheKey) || null;
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const cacheKey = this.generateKey(key);
    this.memoryCache.del(cacheKey);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.flushAll();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    const stats = this.memoryCache.getStats();
    return { 
      type: 'memory', 
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      keyCount: stats.keys
    };
  }

  /**
   * Generate a cache key
   */
  private generateKey(key: string): string {
    return `sed:${key}`;
  }

  /**
   * Close cache connections
   */
  async close(): Promise<void> {
    // Memory cache doesn't need explicit cleanup
  }
} 