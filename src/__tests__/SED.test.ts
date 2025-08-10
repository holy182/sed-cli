import { SED } from '../index';
import { Config } from '../types/Config';

// Mock the database connector
jest.mock('../connectors/SQLiteProvider', () => ({
  SQLiteProvider: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue({ status: 'connected' }),
    discoverSchema: jest.fn().mockResolvedValue({ tables: [] }),
    executeQuery: jest.fn().mockResolvedValue([])
  }))
}));

describe('SED', () => {
  let sed: SED;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      database: {
        type: 'sqlite',
        options: {
          filename: ':memory:'
        }
      },
      ai: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4'
      }
    };

    sed = new SED(mockConfig);
  });

  describe('constructor', () => {
    it('should create SED instance with config', () => {
      expect(sed).toBeInstanceOf(SED);
      expect(sed).toBeDefined();
    });
  });

  describe('testConnection', () => {
    it('should test database connection', async () => {
      // testConnection doesn't return anything, it just logs success
      await expect(sed.testConnection()).resolves.toBeUndefined();
    });
  });

  describe('getSemanticMapping', () => {
    it('should return semantic mapping', () => {
      const mapping = sed.getSemanticMapping();
      expect(mapping).toBeDefined();
    });
  });

  describe('getSemanticContext', () => {
    it('should return semantic context', () => {
      const context = sed.getSemanticContext();
      expect(context).toBeDefined();
    });
  });
});
