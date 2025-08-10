import { ConnectionManager } from '../../connectors/ConnectionManager';
import { DatabaseConfig } from '../../types/Providers';

// Mock database provider
const mockProvider = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  discoverSchema: jest.fn(),
  executeQuery: jest.fn(),
  name: 'MockProvider',
  version: '1.0.0'
};

// Mock DatabaseConnectorFactory
jest.mock('../../connectors/DatabaseConnectorFactory', () => ({
  DatabaseConnectorFactory: {
    create: jest.fn(() => mockProvider)
  }
}));

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let dbConfig: DatabaseConfig;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      maxConnections: 2,
      idleTimeoutMs: 1000,
      connectionTimeoutMs: 5000
    });

    dbConfig = {
      type: 'sqlite',
      database: './test.db'
    };

    // Reset mock calls
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await connectionManager.close();
  });

  describe('getConnection', () => {
    it('should create a new connection when none exists', async () => {
      const provider = await connectionManager.getConnection(dbConfig);

      expect(provider).toBe(mockProvider);
      expect(mockProvider.connect).toHaveBeenCalledWith(dbConfig);
      expect(connectionManager.getStats().totalConnections).toBe(1);
    });

    it('should reuse existing connection', async () => {
      const provider1 = await connectionManager.getConnection(dbConfig);
      const provider2 = await connectionManager.getConnection(dbConfig);

      expect(provider1).toBe(provider2);
      expect(mockProvider.connect).toHaveBeenCalledTimes(1);
      expect(connectionManager.getStats().totalConnections).toBe(1);
    });

    it('should enforce maximum connection limit', async () => {
      const dbConfig2 = { ...dbConfig, database: './test2.db' };
      const dbConfig3 = { ...dbConfig, database: './test3.db' };

      await connectionManager.getConnection(dbConfig);
      await connectionManager.getConnection(dbConfig2);

      // This should fail because we set maxConnections to 2
      await expect(connectionManager.getConnection(dbConfig3))
        .rejects.toThrow('Maximum connections (2) reached');
    });

    it('should handle connection failures with retries', async () => {
      mockProvider.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(undefined);

      const provider = await connectionManager.getConnection(dbConfig);

      expect(provider).toBe(mockProvider);
      expect(mockProvider.connect).toHaveBeenCalledTimes(3);
    });
  });

  describe('releaseConnection', () => {
    it('should mark connection as not in use', async () => {
      await connectionManager.getConnection(dbConfig);
      
      const statsBefore = connectionManager.getStats();
      expect(statsBefore.activeConnections).toBe(1);

      await connectionManager.releaseConnection(dbConfig);
      
      const statsAfter = connectionManager.getStats();
      expect(statsAfter.activeConnections).toBe(0);
      expect(statsAfter.idleConnections).toBe(1);
    });
  });

  describe('connection cleanup', () => {
    it('should clean up idle connections', async () => {
      await connectionManager.getConnection(dbConfig);
      await connectionManager.releaseConnection(dbConfig);

      // Manually set the connection as old enough to be cleaned up
      const connections = (connectionManager as any).connections;
      const connectionKey = 'sqlite:::./test.db:';
      const connection = connections.get(connectionKey);
      if (connection) {
        // Set lastUsed to 2 seconds ago (older than 1 second timeout)
        connection.lastUsed = new Date(Date.now() - 2000);
      }

      // Manually trigger cleanup
      await (connectionManager as any).cleanupIdleConnections();

      const stats = connectionManager.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(mockProvider.disconnect).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return accurate connection statistics', async () => {
      const dbConfig2 = { ...dbConfig, database: './test2.db' };

      await connectionManager.getConnection(dbConfig);
      await connectionManager.getConnection(dbConfig2);
      await connectionManager.releaseConnection(dbConfig);

      const stats = connectionManager.getStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.activeConnections).toBe(1);
      expect(stats.idleConnections).toBe(1);
    });
  });

  describe('close', () => {
    it('should close all connections and cleanup', async () => {
      await connectionManager.getConnection(dbConfig);
      
      await connectionManager.close();

      expect(mockProvider.disconnect).toHaveBeenCalled();
      expect(connectionManager.getStats().totalConnections).toBe(0);
    });
  });
});
