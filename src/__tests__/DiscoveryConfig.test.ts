import { DiscoveryConfigManager } from '../utils/DiscoveryConfig';

describe('DiscoveryConfigManager', () => {
  describe('shouldIncludeTable', () => {
    const config = DiscoveryConfigManager.getDefaultConfig('postgresql');

    it('should exclude PostgreSQL system schemas', () => {
      const result = DiscoveryConfigManager.shouldIncludeTable(
        'users',
        'pg_catalog',
        100,
        false,
        config
      );
      
      expect(result.include).toBe(false);
      expect(result.reason).toContain('Database system schema: pg_catalog');
      expect(result.priority).toBe(0);
    });

    it('should exclude information_schema', () => {
      const result = DiscoveryConfigManager.shouldIncludeTable(
        'tables',
        'information_schema',
        100,
        false,
        config
      );
      
      expect(result.include).toBe(false);
      expect(result.reason).toContain('Database system schema: information_schema');
      expect(result.priority).toBe(0);
    });

    it('should exclude pg_toast schema', () => {
      const result = DiscoveryConfigManager.shouldIncludeTable(
        'pg_toast_123',
        'pg_toast',
        100,
        false,
        config
      );
      
      expect(result.include).toBe(false);
      expect(result.reason).toContain('Database system schema: pg_toast');
      expect(result.priority).toBe(0);
    });

    it('should include public schema tables', () => {
      const result = DiscoveryConfigManager.shouldIncludeTable(
        'users',
        'public',
        100,
        false,
        config
      );
      
      expect(result.include).toBe(true);
      expect(result.reason).toContain('Business table included');
      expect(result.priority).toBeGreaterThan(0);
    });

    it('should include custom business schemas', () => {
      const result = DiscoveryConfigManager.shouldIncludeTable(
        'customers',
        'business',
        100,
        false,
        config
      );
      
      expect(result.include).toBe(true);
      expect(result.reason).toContain('Business table included');
      expect(result.priority).toBeGreaterThan(0);
    });

    it('should give higher priority to tables with relationships', () => {
      const resultWithRelationships = DiscoveryConfigManager.shouldIncludeTable(
        'orders',
        'public',
        100,
        true,
        config
      );
      
      const resultWithoutRelationships = DiscoveryConfigManager.shouldIncludeTable(
        'orders',
        'public',
        100,
        false,
        config
      );
      
      expect(resultWithRelationships.priority).toBeGreaterThan(resultWithoutRelationships.priority);
      expect(resultWithRelationships.reason).toContain('Has relationships');
    });

    it('should give higher priority to tables with business-relevant names', () => {
      const resultBusinessName = DiscoveryConfigManager.shouldIncludeTable(
        'customers',
        'public',
        100,
        false,
        config
      );
      
      const resultGenericName = DiscoveryConfigManager.shouldIncludeTable(
        'temp_data',
        'public',
        100,
        false,
        config
      );
      
      expect(resultBusinessName.priority).toBeGreaterThanOrEqual(resultGenericName.priority);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return correct config for PostgreSQL', () => {
      const config = DiscoveryConfigManager.getDefaultConfig('postgresql');
      
      expect(config.excludeSchemaPatterns).toContain('pg_catalog');
      expect(config.excludeSchemaPatterns).toContain('information_schema');
      expect(config.excludeSchemaPatterns).toContain('pg_toast');
    });

    it('should return correct config for MySQL', () => {
      const config = DiscoveryConfigManager.getDefaultConfig('mysql');
      
      expect(config.excludeSchemaPatterns).toContain('mysql');
      expect(config.excludeSchemaPatterns).toContain('performance_schema');
      expect(config.excludeSchemaPatterns).toContain('information_schema');
    });

    it('should return correct config for SQLite', () => {
      const config = DiscoveryConfigManager.getDefaultConfig('sqlite');
      
      expect(config.excludeTablePatterns).toContain('sqlite_*');
      expect(config.excludeSchemaPatterns).toContain('sqlite_*');
    });
  });
});
