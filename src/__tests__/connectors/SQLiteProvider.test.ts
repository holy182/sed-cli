import { SQLiteProvider } from '../../connectors/SQLiteProvider';
import { DatabaseConfig } from '../../types/Providers';

// Mock sqlite3 and sqlite
jest.mock('sqlite', () => ({
  open: jest.fn()
}));

jest.mock('sqlite3', () => ({
  Database: jest.fn()
}));

// Get the mocked modules
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

describe('SQLiteProvider', () => {
  let provider: SQLiteProvider;
  let config: DatabaseConfig;
  let mockDb: any;

  beforeEach(() => {
    // Reset mocks first
    jest.clearAllMocks();
    
    // Create mock database object
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn(),
      close: jest.fn()
    };

    // Set up the mock to return our mockDb
    sqlite.open.mockResolvedValue(mockDb);

    provider = new SQLiteProvider();
    config = {
      type: 'sqlite',
      database: './test.db'
    };

    // Set default mock values
    mockDb.get.mockResolvedValue({});
  });

  describe('connect', () => {
    it('should connect to SQLite database successfully', async () => {
      mockDb.get.mockResolvedValue({ result: 1 });

      await provider.connect(config);

      const sqlite = require('sqlite');
      expect(sqlite.open).toHaveBeenCalledWith({
        filename: './test.db',
        driver: expect.any(Function)
      });

      expect(mockDb.get).toHaveBeenCalledWith('SELECT 1');
    });

    it('should handle connection failures', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Database file not found'));

      await expect(provider.connect(config)).rejects.toThrow(
        'SQLite connection failed: Database file not found'
      );
    });

    it('should use memory database when no path specified', async () => {
      const memoryConfig = { ...config, database: undefined };
      mockDb.get.mockResolvedValue({ result: 1 });

      await provider.connect(memoryConfig);

      const sqlite = require('sqlite');
      expect(sqlite.open).toHaveBeenCalledWith({
        filename: ':memory:',
        driver: expect.any(Function)
      });
    });
  });

  describe('disconnect', () => {
    it('should close database connection', async () => {
      mockDb.get.mockResolvedValue({ result: 1 });
      await provider.connect(config);

      await provider.disconnect();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockDb.get.mockResolvedValue({ result: 1 });
      await provider.connect(config);

      mockDb.close.mockRejectedValueOnce(new Error('Close failed'));

      // Should not throw
      await expect(provider.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('discoverSchema', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({ result: 1 });
      await provider.connect(config);
    });

    it('should verify mocks are working', async () => {
      // Test that our mock is working
      mockDb.all.mockResolvedValueOnce([{ test: 'data' }]);
      const result = await mockDb.all('SELECT 1');
      expect(result).toEqual([{ test: 'data' }]);
      expect(mockDb.all).toHaveBeenCalledWith('SELECT 1');
    });

    it('should discover tables and columns', async () => {
      // Mock the main table discovery query (SELECT from sqlite_master)
      mockDb.all
        .mockResolvedValueOnce([
          { name: 'users', type: 'table', rootpage: 2 },
          { name: 'orders', type: 'table', rootpage: 3 }
        ])
        // hasTableRelationships calls for each table
        .mockResolvedValueOnce([]) // users - no relationships
        .mockResolvedValueOnce([]); // orders - no relationships

      // Mock row count queries (getTableRowCount calls)
      mockDb.get
        .mockResolvedValueOnce({ count: 0 }) // users row count
        .mockResolvedValueOnce({ count: 0 }) // orders row count
        .mockResolvedValueOnce({ count: 0 }) // users row count (second call)
        .mockResolvedValueOnce({ count: 0 }) // orders row count (second call)
        // getDatabaseInfo calls
        .mockResolvedValueOnce({ user_version: 1 }) // PRAGMA user_version
        .mockResolvedValueOnce({ page_size: 4096 }) // PRAGMA page_size
        .mockResolvedValueOnce({ page_count: 1 }) // PRAGMA page_count
        .mockResolvedValueOnce({ schema_version: 1 }) // PRAGMA schema_version
        .mockResolvedValueOnce([]); // PRAGMA schema_list

      // Mock getColumnInfo calls by spying on the method and returning mock data
      const getColumnInfoSpy = jest.spyOn(provider, 'getColumnInfo');
      getColumnInfoSpy
        .mockResolvedValueOnce([ // users table columns
          { 
            name: 'id', 
            type: 'INTEGER', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: true, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: '',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 0 },
              businessRules: []
            }
          },
          { 
            name: 'name', 
            type: 'TEXT', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: false, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: '',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 0 },
              businessRules: []
            }
          }
        ])
        .mockResolvedValueOnce([ // orders table columns
          { 
            name: 'id', 
            type: 'INTEGER', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: true, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: '',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 0 },
              businessRules: []
            }
          },
          { 
            name: 'user_id', 
            type: 'INTEGER', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: false, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: '',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 0 },
              businessRules: []
            }
          },
          { 
            name: 'amount', 
            type: 'REAL', 
            nullable: false, 
            defaultValue: undefined, 
            isPrimaryKey: false, 
            isForeignKey: false,
            foreignKeyInfo: undefined,
            metadata: {
              description: '',
              sampleValues: [],
              dataProfile: { nullCount: 0, uniqueCount: 0 },
              businessRules: []
            }
          }
        ]);

      // Mock getTableIndexes calls
      const getTableIndexesSpy = jest.spyOn(provider as any, 'getTableIndexes');
      getTableIndexesSpy
        .mockResolvedValueOnce([]) // users indexes
        .mockResolvedValueOnce([]); // orders indexes

      // Mock getTableConstraints calls
      const getTableConstraintsSpy = jest.spyOn(provider as any, 'getTableConstraints');
      getTableConstraintsSpy
        .mockResolvedValueOnce([]) // users constraints
        .mockResolvedValueOnce([]); // orders constraints

      // Mock enrichForeignKeys
      const enrichForeignKeysSpy = jest.spyOn(provider as any, 'enrichForeignKeys');
      enrichForeignKeysSpy.mockResolvedValue(undefined);

      let schema;
      try {
        schema = await provider.discoverSchema();
        process.stdout.write('discoverSchema completed successfully\n');
        process.stdout.write('Schema returned: ' + JSON.stringify(schema, null, 2) + '\n');
      } catch (error) {
        process.stdout.write('Error in discoverSchema: ' + error + '\n');
        if (error instanceof Error) {
          process.stdout.write('Error stack: ' + error.stack + '\n');
        }
        throw error;
      }

      // Debug assertions to see what we actually got
      expect(schema).toBeDefined();
      expect(schema?.tables).toBeDefined();
      
      // Log the actual schema structure for debugging
      if (schema && schema.tables) {
        process.stdout.write('Tables found: ' + schema.tables.length + '\n');
        process.stdout.write('First table: ' + JSON.stringify(schema.tables[0]) + '\n');
        process.stdout.write('Second table: ' + JSON.stringify(schema.tables[1]) + '\n');
        expect(schema.tables.length).toBeGreaterThan(0);
        expect(schema.tables[0]).toBeDefined();
        expect(schema.tables[0].columns).toBeDefined();
      } else {
        process.stdout.write('No tables found in schema\n');
        process.stdout.write('Schema structure: ' + Object.keys(schema || {}) + '\n');
      }

      expect(schema?.tables).toHaveLength(2);
      expect(schema?.tables?.[0]?.name).toBe('users');
      expect(schema?.tables?.[1]?.name).toBe('orders');
      expect(schema?.tables?.[0]?.columns).toHaveLength(2);
      expect(schema?.tables?.[1]?.columns).toHaveLength(3);

      // Clean up spies
      getColumnInfoSpy.mockRestore();
      getTableIndexesSpy.mockRestore();
      getTableConstraintsSpy.mockRestore();
      enrichForeignKeysSpy.mockRestore();
    });

    it('should handle schema discovery errors', async () => {
      mockDb.all.mockRejectedValueOnce(new Error('Schema query failed'));

      await expect(provider.discoverSchema()).rejects.toThrow(
        'Schema discovery failed: Schema query failed'
      );
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({ result: 1 });
      await provider.connect(config);
    });

    it('should execute SELECT queries', async () => {
      const mockResults = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      mockDb.all.mockResolvedValue(mockResults);

      const result = await provider.executeQuery('SELECT * FROM users');

      expect(result).toEqual(mockResults);
      expect(mockDb.all).toHaveBeenCalledWith('SELECT * FROM users', []);
    });

    it('should execute INSERT queries', async () => {
      // SQLiteProvider always uses db.all(), so INSERT returns empty array
      mockDb.all.mockResolvedValue([]);

      const result = await provider.executeQuery(
        'INSERT INTO users (name) VALUES (?)',
        ['John']
      );

      expect(result).toEqual([]);
      expect(mockDb.all).toHaveBeenCalledWith('INSERT INTO users (name) VALUES (?)', ['John']);
    });

    it('should handle query execution errors', async () => {
      mockDb.all.mockRejectedValueOnce(new Error('Query failed'));

      await expect(
        provider.executeQuery('SELECT * FROM nonexistent')
      ).rejects.toThrow('Query execution failed: Query failed');
    });
  });

  describe('getTableInfo', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({ result: 1 });
      await provider.connect(config);
    });

    it('should get table information', async () => {
      // Mock the table lookup
      mockDb.get.mockResolvedValueOnce({ name: 'users', type: 'table', sql: 'CREATE TABLE users...' });
      
      // Mock column info
      mockDb.all.mockResolvedValueOnce([
        { name: 'id', type: 'INTEGER', notnull: 1, pk: 1 },
        { name: 'name', type: 'TEXT', notnull: 1, pk: 0 }
      ])
      .mockResolvedValueOnce([]) // foreign keys
      .mockResolvedValueOnce([]) // indexes
      .mockResolvedValueOnce([]); // constraints

      // Mock row count
      mockDb.get.mockResolvedValueOnce({ count: 0 });

      const tableInfo = await provider.getTableInfo('users');

      expect(tableInfo.name).toBe('users');
      expect(tableInfo.type).toBe('table');
      expect(tableInfo.columns).toHaveLength(2);
      expect(tableInfo.columns[0].name).toBe('id');
      expect(tableInfo.columns[1].name).toBe('name');
    });

    it('should handle table info errors', async () => {
      mockDb.all.mockRejectedValueOnce(new Error('Table info failed'));

      await expect(provider.getTableInfo('users')).rejects.toThrow(
        'Failed to get table info: Failed to get column info: Table info failed'
      );
    });
  });
});
