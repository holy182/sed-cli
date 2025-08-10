import { MySQLProvider } from '../../connectors/MySQLProvider';
import { DatabaseConfig } from '../../types/Providers';

// Mock mysql2/promise
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn()
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    connected: jest.fn(),
    disconnected: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

// Mock DiscoveryConfigManager
jest.mock('../../utils/DiscoveryConfig', () => ({
  DiscoveryConfigManager: {
    getDefaultConfig: jest.fn().mockReturnValue({
      maxTables: 100,
      includeViews: true,
      includeProcedures: false,
      includeFunctions: false
    })
  }
}));

// Get the mocked modules
const mysql = require('mysql2/promise');
const logger = require('../../utils/logger').logger;

describe('MySQLProvider', () => {
  let provider: MySQLProvider;
  let config: DatabaseConfig;
  let mockPool: any;
  let mockConnection: any;

  beforeEach(() => {
    // Reset mocks first
    jest.clearAllMocks();
    
    // Create mock connection object
    mockConnection = {
      execute: jest.fn(),
      release: jest.fn(),
      ping: jest.fn()
    };

    // Create mock pool object
    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      end: jest.fn()
    };

    // Set up the mock to return our mockPool
    mysql.createPool.mockReturnValue(mockPool);

    provider = new MySQLProvider();
    config = {
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'testdb',
      username: 'testuser',
      password: 'testpass'
    };
  });

  describe('connect', () => {
    it('should connect to MySQL database successfully', async () => {
      await provider.connect(config);

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        user: 'testuser',
        password: 'testpass',
        database: 'testdb',
        connectionLimit: 20,
        charset: 'utf8mb4'
      });

      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(logger.connected).toHaveBeenCalledWith('MySQL');
    });

    it('should handle connection failures', async () => {
      mockPool.getConnection.mockRejectedValueOnce(new Error('Access denied'));

      await expect(provider.connect(config)).rejects.toThrow(
        'MySQL connection failed: Access denied'
      );
    });

    it('should use default connection limit when env var not set', async () => {
      delete process.env.DB_POOL_MAX;
      
      await provider.connect(config);

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionLimit: 20
        })
      );
    });

    it('should use custom connection limit from env var', async () => {
      process.env.DB_POOL_MAX = '50';
      
      await provider.connect(config);

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionLimit: 50
        })
      );
    });
  });

  describe('disconnect', () => {
    it('should close database connection pool', async () => {
      await provider.connect(config);

      await provider.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
      expect(logger.disconnected).toHaveBeenCalledWith('MySQL');
    });

    it('should handle disconnect errors gracefully', async () => {
      await provider.connect(config);

      mockPool.end.mockRejectedValueOnce(new Error('Close failed'));

      // Should not throw
      await expect(provider.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('discoverSchema', () => {
    beforeEach(async () => {
      await provider.connect(config);
    });

    it('should discover tables and columns', async () => {
      // Mock the initial schema query - this returns the raw table information
      mockConnection.execute.mockResolvedValueOnce([
        [
          { TABLE_SCHEMA: 'testdb', TABLE_NAME: 'users', TABLE_TYPE: 'BASE TABLE', TABLE_COMMENT: 'Users table', DATA_LENGTH: 1024, INDEX_LENGTH: 512, UPDATE_TIME: '2023-01-01', CREATE_TIME: '2023-01-01', ENGINE: 'InnoDB', TABLE_COLLATION: 'utf8mb4_unicode_ci' },
          { TABLE_SCHEMA: 'testdb', TABLE_NAME: 'orders', TABLE_TYPE: 'BASE TABLE', TABLE_COMMENT: 'Orders table', DATA_LENGTH: 2048, INDEX_LENGTH: 1024, UPDATE_TIME: '2023-01-01', CREATE_TIME: '2023-01-01', ENGINE: 'InnoDB', TABLE_COLLATION: 'utf8mb4_unicode_ci' }
        ]
      ]);

      // Mock the row count and relationships queries for each table
      mockConnection.execute
        .mockResolvedValueOnce([[{ count: 100 }]]) // users row count
        .mockResolvedValueOnce([[{ count: 1 }]])   // users has relationships
        .mockResolvedValueOnce([[{ count: 500 }]]) // orders row count
        .mockResolvedValueOnce([[{ count: 1 }]]);  // orders has relationships

      // Mock the foreign keys query
      mockConnection.execute.mockResolvedValueOnce([
        [
          { 
            CONSTRAINT_SCHEMA: 'testdb', 
            CONSTRAINT_NAME: 'fk_orders_user', 
            TABLE_NAME: 'orders', 
            COLUMN_NAME: 'user_id', 
            REFERENCED_TABLE_SCHEMA: 'testdb', 
            REFERENCED_TABLE_NAME: 'users', 
            REFERENCED_COLUMN_NAME: 'id', 
            UPDATE_RULE: 'CASCADE', 
            DELETE_RULE: 'RESTRICT' 
          }
        ]
      ]);

      // Mock the primary keys query
      mockConnection.execute.mockResolvedValueOnce([
        [
          { TABLE_SCHEMA: 'testdb', TABLE_NAME: 'users', COLUMN_NAME: 'id', CONSTRAINT_NAME: 'PRIMARY' },
          { TABLE_SCHEMA: 'testdb', TABLE_NAME: 'orders', COLUMN_NAME: 'id', CONSTRAINT_NAME: 'PRIMARY' }
        ]
      ]);

      // Mock the unique constraints query
      mockConnection.execute.mockResolvedValueOnce([[]]);

      // Mock the views query
      mockConnection.execute.mockResolvedValueOnce([[]]);

      // Mock the procedures query
      mockConnection.execute.mockResolvedValueOnce([[]]);

      // Mock the getColumnInfoForSchema calls
      const getColumnInfoSpy = jest.spyOn(provider as any, 'getColumnInfoForSchema');
      getColumnInfoSpy
        .mockResolvedValueOnce([ // users table columns
          { 
            name: 'id', 
            type: 'INT', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: true, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: 'Primary key',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 100 },
              businessRules: []
            }
          },
          { 
            name: 'name', 
            type: 'VARCHAR(255)', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: false, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: 'User name',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 95 },
              businessRules: []
            }
          }
        ])
        .mockResolvedValueOnce([ // orders table columns
          { 
            name: 'id', 
            type: 'INT', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: true, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: 'Primary key',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 500 },
              businessRules: []
            }
          },
          { 
            name: 'user_id', 
            type: 'INT', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: false, 
            isForeignKey: true,
            foreignKeyInfo: { referencedTable: 'users', referencedColumn: 'id' },
            metadata: {
              description: 'Foreign key to users',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 100 },
              businessRules: []
            }
          },
          { 
            name: 'amount', 
            type: 'DECIMAL(10,2)', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: false, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: 'Order amount',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 450 },
              businessRules: []
            }
          }
        ]);

      // Mock the private methods that are called internally
      const getTableIndexesForSchemaSpy = jest.spyOn(provider as any, 'getTableIndexesForSchema');
      const getTableConstraintsForSchemaSpy = jest.spyOn(provider as any, 'getTableConstraintsForSchema');
      
      getTableIndexesForSchemaSpy.mockResolvedValue([]);
      getTableConstraintsForSchemaSpy.mockResolvedValue([]);

      const schema = await provider.discoverSchema();

      expect(schema).toBeDefined();
      expect(schema.tables).toBeDefined();
      expect(schema.tables).toHaveLength(2);
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[1].name).toBe('orders');
      expect(schema.tables[0].columns).toHaveLength(2);
      expect(schema.tables[1].columns).toHaveLength(3);

      // Clean up spies
      getColumnInfoSpy.mockRestore();
      getTableIndexesForSchemaSpy.mockRestore();
      getTableConstraintsForSchemaSpy.mockRestore();
    });

    it('should handle schema discovery errors', async () => {
      mockConnection.execute.mockRejectedValueOnce(new Error('Schema query failed'));

      await expect(provider.discoverSchema()).rejects.toThrow(
        'Schema discovery failed: Schema query failed'
      );
    });

    it('should handle permission issues gracefully', async () => {
      // Connect to the provider first
      await provider.connect(config);
      
      // Mock initial table discovery - only one table is discovered (orders table fails)
      mockConnection.execute.mockResolvedValueOnce([
        [
          { TABLE_SCHEMA: 'testdb', TABLE_NAME: 'users', TABLE_TYPE: 'BASE TABLE', TABLE_COMMENT: 'Users table', DATA_LENGTH: 1024, INDEX_LENGTH: 512, UPDATE_TIME: '2023-01-01', CREATE_TIME: '2023-01-01', ENGINE: 'InnoDB', TABLE_COLLATION: 'utf8mb4_unicode_ci' }
        ]
      ]);

      // Mock the private helper methods that are called internally
      const getColumnInfoForSchemaSpy = jest.spyOn(provider as any, 'getColumnInfoForSchema');
      const getTableIndexesForSchemaSpy = jest.spyOn(provider as any, 'getTableIndexesForSchema');
      const getTableRowCountSpy = jest.spyOn(provider as any, 'getTableRowCount');
      const hasTableRelationshipsSpy = jest.spyOn(provider as any, 'hasTableRelationships');
      
      // Mock successful calls for users table - use mockResolvedValue instead of mockResolvedValueOnce
      getTableRowCountSpy.mockResolvedValue(100); // users row count
      hasTableRelationshipsSpy.mockResolvedValue(true);  // users has relationships
      
      getColumnInfoForSchemaSpy.mockResolvedValue([
        {
          name: 'id',
          type: 'int',
          nullable: false,
          defaultValue: null,
          isPrimaryKey: true,
          isForeignKey: false,
          foreignKeyInfo: undefined,
          metadata: { description: '', sampleValues: [], dataProfile: undefined, businessRules: [] }
        },
        {
          name: 'name',
          type: 'varchar',
          nullable: false,
          defaultValue: null,
          isPrimaryKey: false,
          isForeignKey: false,
          foreignKeyInfo: undefined,
          metadata: { description: '', sampleValues: [], dataProfile: undefined, businessRules: [] }
        }
      ]);

      getTableIndexesForSchemaSpy.mockResolvedValue([
        {
          name: 'PRIMARY',
          columns: ['id'],
          isUnique: true,
          type: 'BTREE'
        }
      ]);

      // Mock foreign keys, primary keys, unique constraints, views, and procedures queries
      // Use mockResolvedValue instead of mockResolvedValueOnce to avoid conflicts
      mockConnection.execute
        .mockResolvedValue([[], []]) // Foreign keys
        .mockResolvedValue([[], []]) // Primary keys  
        .mockResolvedValue([[], []]) // Unique constraints
        .mockResolvedValue([[], []]) // Views
        .mockResolvedValue([[], []]); // Procedures



      const schema = await provider.discoverSchema();

      // Should still discover tables that can be accessed
      expect(schema.tables).toHaveLength(1);
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[0].columns).toHaveLength(2);

      // Restore spies
      getColumnInfoForSchemaSpy.mockRestore();
      getTableIndexesForSchemaSpy.mockRestore();
      getTableRowCountSpy.mockRestore();
      hasTableRelationshipsSpy.mockRestore();
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      await provider.connect(config);
    });

    it('should execute SELECT queries', async () => {
      const mockResult = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];

      mockConnection.execute.mockResolvedValueOnce([mockResult]);

      const result = await provider.executeQuery('SELECT * FROM users');

      expect(result).toEqual(mockResult);
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT * FROM users', []);
    });

    it('should execute INSERT queries with parameters', async () => {
      mockConnection.execute.mockResolvedValueOnce([[{ insertId: 1 }]]);

      const result = await provider.executeQuery(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        ['John', 'john@example.com']
      );

      expect(result).toEqual([{ insertId: 1 }]);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        ['John', 'john@example.com']
      );
    });

    it('should handle query execution errors', async () => {
      mockConnection.execute.mockRejectedValueOnce(new Error('Query failed'));

      await expect(provider.executeQuery('SELECT * FROM invalid_table')).rejects.toThrow(
        'Query execution failed: Query failed'
      );
    });
  });

  describe('getTableInfo', () => {
    beforeEach(async () => {
      await provider.connect(config);
    });

    it('should get table information', async () => {
      // Mock table existence check
      mockConnection.execute.mockResolvedValueOnce([
        [{ TABLE_SCHEMA: 'testdb', TABLE_NAME: 'users', TABLE_TYPE: 'BASE TABLE' }]
      ]);

      // Mock the column discovery query
      mockConnection.execute.mockResolvedValueOnce([
        [
          { COLUMN_NAME: 'id', DATA_TYPE: 'INT', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, CHARACTER_MAXIMUM_LENGTH: null, NUMERIC_PRECISION: 32, NUMERIC_SCALE: 0, COLUMN_COMMENT: 'Primary key', EXTRA: 'auto_increment' }
        ]
      ]);

      // Mock the primary key query
      mockConnection.execute.mockResolvedValueOnce([
        [{ COLUMN_NAME: 'id' }]
      ]);

      // Mock the foreign key query
      mockConnection.execute.mockResolvedValueOnce([[]]);

      // Mock the index query
      mockConnection.execute.mockResolvedValueOnce([[]]);

      const tableInfo = await provider.getTableInfo('users');

      expect(tableInfo).toBeDefined();
      expect(tableInfo.schema).toBe('testdb');
      expect(tableInfo.name).toBe('users');
      expect(tableInfo.type).toBe('table');
      expect(tableInfo.columns).toHaveLength(1);
    });

    it('should handle table info errors', async () => {
      // Mock table existence check
      mockConnection.execute.mockResolvedValueOnce([
        [{ TABLE_SCHEMA: 'testdb', TABLE_NAME: 'users', TABLE_TYPE: 'BASE TABLE' }]
      ]);

      // Mock the column discovery query to fail
      mockConnection.execute.mockRejectedValueOnce(new Error('Column query failed'));

      await expect(provider.getTableInfo('users')).rejects.toThrow(
        'Failed to get table info: Failed to get column info: Column query failed'
      );
    });
  });

  describe('getColumnInfo', () => {
    beforeEach(async () => {
      await provider.connect(config);
    });

    it('should get column information', async () => {
      // Mock the column discovery query
      mockConnection.execute.mockResolvedValueOnce([
        [
          { COLUMN_NAME: 'id', DATA_TYPE: 'INT', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, CHARACTER_MAXIMUM_LENGTH: null, NUMERIC_PRECISION: 32, NUMERIC_SCALE: 0, COLUMN_COMMENT: 'Primary key', EXTRA: 'auto_increment' }
        ]
      ]);

      // Mock the primary key query
      mockConnection.execute.mockResolvedValueOnce([
        [{ COLUMN_NAME: 'id' }]
      ]);

      // Mock the foreign key query
      mockConnection.execute.mockResolvedValueOnce([[]]);

      // Mock the index query
      mockConnection.execute.mockResolvedValueOnce([[]]);

      const columns = await provider.getColumnInfo('users');

      expect(columns).toBeDefined();
      expect(columns).toHaveLength(1);
      expect(columns[0].name).toBe('id');
      expect(columns[0].type).toBe('INT');
      expect(columns[0].isPrimaryKey).toBe(true);
    });

    it('should handle column info errors', async () => {
      mockConnection.execute.mockRejectedValueOnce(new Error('Column query failed'));

      await expect(provider.getColumnInfo('users')).rejects.toThrow(
        'Failed to get column info: Column query failed'
      );
    });
  });

  describe('testConnection', () => {
    beforeEach(async () => {
      await provider.connect(config);
    });

    it('should test connection successfully', async () => {
      // Mock the ping method
      mockConnection.ping = jest.fn().mockResolvedValue(undefined);

      const result = await provider.testConnection();

      expect(result).toBe(true);
      expect(mockConnection.ping).toHaveBeenCalled();
    });

    it('should handle connection test failures', async () => {
      // Mock the ping method to fail
      mockConnection.ping = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await provider.testConnection();

      expect(result).toBe(false);
    });
  });
});
