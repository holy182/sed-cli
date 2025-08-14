import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

export interface CacheConfig {
  type: 'memory' | 'redis' | 'file';
  ttl?: number;
  maxKeys?: number;
  checkPeriod?: number;
  useClones?: boolean;
  deleteOnExpire?: boolean;
}

export interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  timestamp: Date;
}

export class CacheManager {
  private cache: NodeCache;
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    total: number;
  };

  constructor(config: CacheConfig) {
    this.config = config;
    this.stats = { hits: 0, misses: 0, total: 0 };
    
    // Initialize cache based on type
    if (config.type === 'memory') {
      this.cache = new NodeCache({
        stdTTL: config.ttl || 300,
        maxKeys: config.maxKeys || 1000,
        checkperiod: config.checkPeriod || 60,
        useClones: config.useClones || false,
        deleteOnExpire: config.deleteOnExpire || true
      });
    } else {
      // Fallback to memory cache for unsupported types
      logger.warn(`Cache type '${config.type}' not supported, falling back to memory cache`);
      this.cache = new NodeCache({
        stdTTL: config.ttl || 300,
        maxKeys: config.maxKeys || 1000
      });
    }

    // Set up event listeners
    this.cache.on('hit', () => this.stats.hits++);
    this.cache.on('miss', () => this.stats.misses++);
    this.cache.on('expired', (key: string) => {
      logger.debug(`Cache key expired: ${key}`);
    });
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      // Use provided TTL or fall back to default from config
      const actualTtl = ttl ?? this.config.ttl ?? 300;
      this.cache.set(key, value, actualTtl);
      this.stats.total++;
      logger.debug(`Cache set: ${key}`);
    } catch (error) {
      logger.error(`Failed to set cache key ${key}: ${error}`);
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = this.cache.get<T>(key);
      if (value !== undefined) {
        logger.debug(`Cache hit: ${key}`);
        return value;
      } else {
        logger.debug(`Cache miss: ${key}`);
        return undefined;
      }
    } catch (error) {
      logger.error(`Failed to get cache key ${key}: ${error}`);
      return undefined;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      this.cache.del(key);
      logger.debug(`Cache delete: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete cache key ${key}: ${error}`);
      throw error;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const keys = this.cache.keys().length;
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      keys,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: this.cache.getStats().vsize || 0,
      timestamp: new Date()
    };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.cache.flushAll();
      this.stats = { hits: 0, misses: 0, total: 0 };
      logger.info('Cache cleared');
    } catch (error) {
      logger.error(`Failed to clear cache: ${error}`);
      throw error;
    }
  }

  /**
   * Close cache connections
   */
  async close(): Promise<void> {
    try {
      this.cache.close();
      logger.info('Cache closed');
    } catch (error) {
      logger.error(`Failed to close cache: ${error}`);
    }
  }
} 