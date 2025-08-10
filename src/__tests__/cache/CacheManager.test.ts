import { CacheManager, CacheConfig } from '../../cache/CacheManager';

// Mock the node-cache module
jest.mock('node-cache');

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockConfig: CacheConfig;
  let mockNodeCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = { type: 'memory', ttl: 3600 };
    
    // Get the mocked NodeCache constructor
    const NodeCache = require('node-cache');
    const mockConstructor = NodeCache as jest.MockedClass<typeof NodeCache>;
    
    // Create a mock instance with all required methods
    mockNodeCache = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn().mockReturnValue({ keys: 0, hits: 0, misses: 0 })
    };
    
    // Make the constructor return our mock instance
    mockConstructor.mockImplementation(() => mockNodeCache);
    
    cacheManager = new CacheManager(mockConfig);
  });

  describe('constructor', () => {
    it('should create CacheManager instance with config', () => {
      expect(cacheManager).toBeInstanceOf(CacheManager);
    });

    it('should initialize NodeCache with correct configuration', () => {
      const NodeCache = require('node-cache');
      expect(NodeCache).toHaveBeenCalledWith({
        stdTTL: 3600,
        checkperiod: 600
      });
    });

    it('should use default TTL when not provided', () => {
      const configWithoutTTL: CacheConfig = { type: 'memory' };
      new CacheManager(configWithoutTTL);
      
      const NodeCache = require('node-cache');
      expect(NodeCache).toHaveBeenCalledWith({
        stdTTL: 3600,
        checkperiod: 600
      });
    });

    it('should use custom TTL when provided', () => {
      const configWithCustomTTL: CacheConfig = { type: 'memory', ttl: 1800 };
      new CacheManager(configWithCustomTTL);
      
      const NodeCache = require('node-cache');
      expect(NodeCache).toHaveBeenCalledWith({
        stdTTL: 1800,
        checkperiod: 600
      });
    });
  });

  describe('set', () => {
    it('should set a value in cache with default TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      await cacheManager.set(key, value);

      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:test-key', value, 3600);
    });

    it('should set a value in cache with custom TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      const customTTL = 1800;

      await cacheManager.set(key, value, customTTL);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:test-key', value, customTTL);
    });

    it('should generate prefixed cache key', async () => {
      const key = 'user:123';
      const value = { name: 'John Doe' };

      await cacheManager.set(key, value);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:user:123', value, 3600);
    });

    it('should handle empty key', async () => {
      const key = '';
      const value = { data: 'test' };

      await cacheManager.set(key, value);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:', value, 3600);
    });

    it('should handle special characters in key', async () => {
      const key = 'user:profile:123:settings';
      const value = { theme: 'dark' };

      await cacheManager.set(key, value);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:user:profile:123:settings', value, 3600);
    });
  });

  describe('get', () => {
    it('should get a value from cache', async () => {
      const key = 'test-key';
      const expectedValue = { data: 'test-value' };
      
      mockNodeCache.get.mockReturnValue(expectedValue);

      const result = await cacheManager.get(key);
      
      expect(mockNodeCache.get).toHaveBeenCalledWith('sed:test-key');
      expect(result).toEqual(expectedValue);
    });

    it('should return null when key not found', async () => {
      const key = 'non-existent-key';
      
      mockNodeCache.get.mockReturnValue(undefined);

      const result = await cacheManager.get(key);
      
      expect(mockNodeCache.get).toHaveBeenCalledWith('sed:non-existent-key');
      expect(result).toBeNull();
    });

    it('should handle empty key', async () => {
      const key = '';
      
      mockNodeCache.get.mockReturnValue(undefined);

      const result = await cacheManager.get(key);
      
      expect(mockNodeCache.get).toHaveBeenCalledWith('sed:');
      expect(result).toBeNull();
    });

    it('should handle special characters in key', async () => {
      const key = 'user:profile:123:settings';
      const expectedValue = { theme: 'dark' };
      
      mockNodeCache.get.mockReturnValue(expectedValue);

      const result = await cacheManager.get(key);
      
      expect(mockNodeCache.get).toHaveBeenCalledWith('sed:user:profile:123:settings');
      expect(result).toEqual(expectedValue);
    });

    it('should return typed result', async () => {
      interface UserData {
        id: number;
        name: string;
      }
      
      const key = 'user:123';
      const expectedValue: UserData = { id: 123, name: 'John' };
      
      mockNodeCache.get.mockReturnValue(expectedValue);

      const result = await cacheManager.get<UserData>(key);
      
      expect(result).toEqual(expectedValue);
      expect(result?.id).toBe(123);
      expect(result?.name).toBe('John');
    });
  });

  describe('delete', () => {
    it('should delete a value from cache', async () => {
      const key = 'test-key';

      await cacheManager.delete(key);
      
      expect(mockNodeCache.del).toHaveBeenCalledWith('sed:test-key');
    });

    it('should handle empty key', async () => {
      const key = '';

      await cacheManager.delete(key);
      
      expect(mockNodeCache.del).toHaveBeenCalledWith('sed:');
    });

    it('should handle special characters in key', async () => {
      const key = 'user:profile:123:settings';

      await cacheManager.delete(key);
      
      expect(mockNodeCache.del).toHaveBeenCalledWith('sed:user:profile:123:settings');
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      await cacheManager.clear();
      
      expect(mockNodeCache.flushAll).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const mockStats = { keys: 5, hits: 10, misses: 2 };
      mockNodeCache.getStats.mockReturnValue(mockStats);

      const stats = await cacheManager.getStats();
      
      expect(mockNodeCache.getStats).toHaveBeenCalled();
      expect(stats).toEqual({
        type: 'memory',
        keys: 5,
        hits: 10,
        misses: 2,
        keyCount: 5
      });
    });

    it('should return zero stats when cache is empty', async () => {
      const stats = await cacheManager.getStats();
      
      expect(stats).toEqual({
        type: 'memory',
        keys: 0,
        hits: 0,
        misses: 0,
        keyCount: 0
      });
    });
  });

  describe('close', () => {
    it('should close cache connections', async () => {
      await expect(cacheManager.close()).resolves.not.toThrow();
    });
  });

  describe('key generation', () => {
    it('should generate consistent keys with sed: prefix', () => {
      const key = 'test-key';
      const value = { data: 'test' };

      cacheManager.set(key, value);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:test-key', value, 3600);
    });

    it('should handle various key formats', () => {
      const keys = ['simple', 'with:colons', 'with.dots', 'with-dashes', 'with_underscores'];
      
      keys.forEach(key => {
        cacheManager.set(key, 'value');
        expect(mockNodeCache.set).toHaveBeenCalledWith(`sed:${key}`, 'value', 3600);
      });
    });
  });

  describe('error handling', () => {
    it('should handle NodeCache errors gracefully', async () => {
      const key = 'test-key';
      
      // Mock NodeCache methods to throw errors
      mockNodeCache.set.mockImplementation(() => {
        throw new Error('Cache operation failed');
      });
      mockNodeCache.get.mockImplementation(() => {
        throw new Error('Cache operation failed');
      });
      mockNodeCache.del.mockImplementation(() => {
        throw new Error('Cache operation failed');
      });
      mockNodeCache.flushAll.mockImplementation(() => {
        throw new Error('Cache operation failed');
      });

      // These should not throw errors but should be handled gracefully
      await expect(cacheManager.set(key, 'value')).rejects.toThrow('Cache operation failed');
      await expect(cacheManager.get(key)).rejects.toThrow('Cache operation failed');
      await expect(cacheManager.delete(key)).rejects.toThrow('Cache operation failed');
      await expect(cacheManager.clear()).rejects.toThrow('Cache operation failed');
    });
  });

  describe('cache operations workflow', () => {
    it('should handle complete cache workflow', async () => {
      const key = 'workflow-test';
      const value = { data: 'test-data', step: 1 };

      // Set value
      await cacheManager.set(key, value);
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:workflow-test', value, 3600);
      
      // Get value
      mockNodeCache.get.mockReturnValue(value);
      const retrievedValue = await cacheManager.get(key);
      expect(retrievedValue).toEqual(value);
      
      // Update value
      const updatedValue = { data: 'test-data', step: 2 };
      await cacheManager.set(key, updatedValue);
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:workflow-test', updatedValue, 3600);
      
      // Delete value
      await cacheManager.delete(key);
      expect(mockNodeCache.del).toHaveBeenCalledWith('sed:workflow-test');
    });

    it('should handle multiple keys independently', async () => {
      const key1 = 'key1';
      const value1 = { data: 'value1' };
      const key2 = 'key2';
      const value2 = { data: 'value2' };

      // Set both values
      await cacheManager.set(key1, value1);
      await cacheManager.set(key2, value2);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:key1', value1, 3600);
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:key2', value2, 3600);
      
      // Get both values
      mockNodeCache.get.mockReturnValueOnce(value1).mockReturnValueOnce(value2);
      
      const result1 = await cacheManager.get(key1);
      const result2 = await cacheManager.get(key2);
      
      expect(result1).toEqual(value1);
      expect(result2).toEqual(value2);
    });
  });

  describe('TTL handling', () => {
    it('should use default TTL when not specified', async () => {
      const key = 'default-ttl-test';
      const value = { data: 'test' };

      await cacheManager.set(key, value);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:default-ttl-test', value, 3600);
    });

    it('should use custom TTL when specified', async () => {
      const key = 'custom-ttl-test';
      const value = { data: 'test' };
      const customTTL = 1800;

      await cacheManager.set(key, value, customTTL);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:custom-ttl-test', value, customTTL);
    });

    it('should handle zero TTL', async () => {
      const key = 'zero-ttl-test';
      const value = { data: 'test' };
      const zeroTTL = 0;

      await cacheManager.set(key, value, zeroTTL);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:zero-ttl-test', value, zeroTTL);
    });

    it('should handle very long TTL', async () => {
      const key = 'long-ttl-test';
      const value = { data: 'test' };
      const longTTL = 365 * 24 * 60 * 60; // 1 year

      await cacheManager.set(key, value, longTTL);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith('sed:long-ttl-test', value, longTTL);
    });
  });
});
