import { PostgreSQLProvider } from '../../connectors/PostgreSQLProvider';
import { DatabaseConfig } from '../../types/Providers';

// Mock pg
jest.mock('pg', () => ({
  Pool: jest.fn()
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
const pg = require('pg');
const logger = require('../../utils/logger').logger;

describe('PostgreSQLProvider', () => {
  let provider: PostgreSQLProvider;
  let config: DatabaseConfig;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    // Reset mocks first
    jest.clearAllMocks();
    
    // Create mock client object
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    // Create mock pool object
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn()
    };

    // Set up the mock to return our mockPool
    pg.Pool.mockImplementation(() => mockPool);

    provider = new PostgreSQLProvider();
    config = {
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      password: 'testpass'
    };
  });

  describe('connect', () => {
    it('should connect to PostgreSQL database successfully', async () => {
      await provider.connect(config);

      expect(pg.Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
        database: 'testdb',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.release).toHaveBeenCalled();
      expect(logger.connected).toHaveBeenCalledWith('PostgreSQL');
    });

    it('should connect using connection string', async () => {
      const connectionStringConfig = {
        type: 'postgres' as const,
        connectionString: 'postgresql://user:pass@localhost:5432/db'
      };

      await provider.connect(connectionStringConfig);

      expect(pg.Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://user:pass@localhost:5432/db'
      });
    });

    it('should handle connection failures', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(provider.connect(config)).rejects.toThrow(
        'PostgreSQL connection failed: Connection refused'
      );
    });

    it('should use default pool settings when env vars not set', async () => {
      delete process.env.DB_POOL_MAX;
      delete process.env.DB_POOL_IDLE_TIMEOUT;
      delete process.env.DB_POOL_CONNECTION_TIMEOUT;
      
      await provider.connect(config);

      expect(pg.Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000
        })
      );
    });

    it('should use custom pool settings from env vars', async () => {
      process.env.DB_POOL_MAX = '50';
      process.env.DB_POOL_IDLE_TIMEOUT = '60000';
      process.env.DB_POOL_CONNECTION_TIMEOUT = '5000';
      
      await provider.connect(config);

      expect(pg.Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 50,
          idleTimeoutMillis: 60000,
          connectionTimeoutMillis: 5000
        })
      );
    });
  });

  describe('disconnect', () => {
    it('should close database connection pool', async () => {
      await provider.connect(config);

      await provider.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
      expect(logger.disconnected).toHaveBeenCalledWith('PostgreSQL');
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
      // Mock table discovery - information_schema.tables query
      mockClient.query.mockResolvedValueOnce({ 
        rows: [
          { table_schema: 'public', table_name: 'users', table_type: 'BASE TABLE', source: 'information_schema' },
          { table_schema: 'public', table_name: 'orders', table_type: 'BASE TABLE', source: 'information_schema' }
        ] 
      });

      // Mock pg_class query (second table discovery method)
      mockClient.query.mockResolvedValueOnce({ 
        rows: [
          { table_schema: 'public', table_name: 'users', table_type: 'BASE TABLE', source: 'pg_class' },
          { table_schema: 'public', table_name: 'orders', table_type: 'BASE TABLE', source: 'pg_class' }
        ] 
      });

      // Mock row count and relationships for users table
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '100' }] }); // users row count
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });  // users has relationships

      // Mock row count and relationships for orders table  
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '50' }] }); // orders row count
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });  // orders has relationships

      // Mock column info for users table
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 32,
            numeric_scale: 0
          },
          {
            column_name: 'name',
            data_type: 'character varying',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: 255,
            numeric_precision: null,
            numeric_scale: null
          }
        ]
      });

      // Mock column info for orders table
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 32,
            numeric_scale: 0
          },
          {
            column_name: 'user_id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 32,
            numeric_scale: 0
          },
          {
            column_name: 'total_amount',
            data_type: 'numeric',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 2
          }
        ]
      });

      // Mock foreign keys query
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            table_schema: 'public',
            table_name: 'orders',
            column_name: 'user_id',
            foreign_table_schema: 'public',
            foreign_table_name: 'users',
            foreign_column_name: 'id'
          }
        ]
      });

      // Mock primary keys query
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { table_schema: 'public', table_name: 'users', column_name: 'id' },
          { table_schema: 'public', table_name: 'orders', column_name: 'id' }
        ]
      });

      // Mock views query
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const schema = await provider.discoverSchema();

      expect(schema).toBeDefined();
      expect(schema.tables).toHaveLength(2);
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[1].name).toBe('orders');
      expect(schema.tables[0].columns).toHaveLength(2);
      expect(schema.tables[1].columns).toHaveLength(3);
    });

    it('should handle schema discovery errors', async () => {
      // Mock the comprehensive discovery to fail
      mockClient.query.mockRejectedValueOnce(new Error('Schema query failed'));
      
      // Mock the fallback query to also fail
      mockClient.query.mockRejectedValueOnce(new Error('Fallback query failed'));

      await expect(provider.discoverSchema()).rejects.toThrow(
        'Schema discovery failed: Fallback query failed'
      );
    });

    it('should handle permission issues gracefully', async () => {
      // Mock table discovery
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ table_name: 'users' }] }) // information_schema.tables
        .mockResolvedValueOnce({ rows: [{ table_name: 'orders' }] }) // pg_class
        .mockResolvedValueOnce({ rows: [{ table_name: 'users' }] }) // information_schema.tables (second call)
        .mockResolvedValueOnce({ rows: [{ table_name: 'orders' }] }) // pg_class (second call)
        .mockResolvedValueOnce({ rows: [{ column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null, numeric_precision: 32, numeric_scale: 0 }] }) // Column info for users
        .mockResolvedValueOnce({ rows: [{ column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null, character_maximum_length: 255, numeric_precision: null, numeric_scale: null }] }) // Column info for users
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // Row count for users
        .mockResolvedValueOnce({ rows: [{ column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null, numeric_precision: 32, numeric_scale: 0 }] }) // Column info for orders
        .mockResolvedValueOnce({ rows: [{ column_name: 'user_id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null, numeric_precision: 32, numeric_scale: 0 }] }) // Column info for orders
        .mockResolvedValueOnce({ rows: [{ column_name: 'total_amount', data_type: 'numeric', is_nullable: 'NO', column_default: null, character_maximum_length: null, numeric_precision: 10, numeric_scale: 2 }] }) // Column info for orders
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // Row count for orders
        .mockResolvedValueOnce({ rows: [{ column_name: 'user_id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null, numeric_precision: 32, numeric_scale: 0 }] }) // Foreign key info
        .mockResolvedValueOnce({ rows: [{ column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null, numeric_precision: 32, numeric_scale: 0 }] }) // Primary key info
        .mockResolvedValueOnce({ rows: [{ indexname: 'users_pkey', indexdef: 'CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)' }] }) // Index info for users
        .mockResolvedValueOnce({ rows: [{ indexname: 'orders_pkey', indexdef: 'CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)' }] }) // Index info for orders
        .mockResolvedValueOnce({ rows: [] }) // Views
        .mockResolvedValueOnce({ rows: [] }); // Procedures

      const schema = await provider.discoverSchema();

      // Should still discover tables that can be accessed
      expect(schema.tables).toHaveLength(2);
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[1].name).toBe('orders');
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      await provider.connect(config);
    });

    it('should execute SELECT queries', async () => {
      const mockResult = [{ id: 1, name: 'John' }];
      mockClient.query.mockResolvedValueOnce({ rows: mockResult });

      const result = await provider.executeQuery('SELECT * FROM users');

      expect(result).toEqual(mockResult);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users', []);
    });

    it('should execute INSERT queries with parameters', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await provider.executeQuery(
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        ['John', 'john@example.com']
      );

      expect(result).toEqual([]);
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        ['John', 'john@example.com']
      );
    });

    it('should handle query execution errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Query failed'));

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
      mockClient.query.mockResolvedValueOnce({ 
        rows: [{ table_name: 'users', table_type: 'BASE TABLE' }] 
      });

      const getColumnInfoSpy = jest.spyOn(provider, 'getColumnInfo');
      getColumnInfoSpy.mockResolvedValue([
        {
          name: 'id',
          type: 'integer',
          nullable: false,
          defaultValue: null,
          isPrimaryKey: true,
          isForeignKey: false,
          foreignKeyInfo: undefined,
          metadata: { description: '', sampleValues: [], dataProfile: undefined, businessRules: [] }
        }
      ]);

      const tableInfo = await provider.getTableInfo('users');

      expect(tableInfo).toBeDefined();
      expect(tableInfo.schema).toBe('public');
      expect(tableInfo.name).toBe('users');
      expect(tableInfo.type).toBe('table');
      expect(tableInfo.columns).toHaveLength(1);

      getColumnInfoSpy.mockRestore();
    });

    it('should handle table info errors', async () => {
      // Mock table existence check
      mockClient.query.mockResolvedValueOnce({ 
        rows: [{ table_name: 'users', table_type: 'BASE TABLE' }] 
      });

      // Mock the getColumnInfo call to fail
      const getColumnInfoSpy = jest.spyOn(provider, 'getColumnInfo');
      getColumnInfoSpy.mockRejectedValueOnce(new Error('Column info failed'));

      await expect(provider.getTableInfo('users')).rejects.toThrow(
        'Failed to get table info: Column info failed'
      );

      getColumnInfoSpy.mockRestore();
    });
  });

  describe('getColumnInfo', () => {
    beforeEach(async () => {
      await provider.connect(config);
    });

    it('should get column information', async () => {
      // Mock column discovery query - structure must match the SQL query exactly
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 32,
            numeric_scale: 0,
            description: 'Primary key'
          }
        ]
      });

      const columns = await provider.getColumnInfo('users');

      expect(columns).toBeDefined();
      expect(columns).toHaveLength(1);
      expect(columns[0].name).toBe('id');
      expect(columns[0].type).toBe('integer');
      expect(columns[0].isPrimaryKey).toBe(false); // Will be set after getTableInfo processes constraints
    });

    it('should handle column info errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Column query failed'));

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
      mockClient.query.mockResolvedValueOnce({ rows: [{ result: 1 }] });

      const result = await provider.testConnection();

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should handle connection test failures', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await provider.testConnection();

      expect(result).toBe(false);
    });
  });
});
