import { DatabaseProvider, DatabaseConfig, DatabaseSchema } from '../types/Providers';
import { PostgreSQLProvider } from './PostgreSQLProvider';
import { MySQLProvider } from './MySQLProvider';
import { SQLiteProvider } from './SQLiteProvider';

export class DatabaseConnectorFactory {
  private static connectors: Map<string, new (config: DatabaseConfig) => DatabaseProvider> = new Map();

  static {
    // Register built-in connectors
    DatabaseConnectorFactory.register('postgres', PostgreSQLProvider);
    DatabaseConnectorFactory.register('mysql', MySQLProvider);
    DatabaseConnectorFactory.register('sqlite', SQLiteProvider);
  }

  static register(type: string, connectorClass: new (config: DatabaseConfig) => DatabaseProvider): void {
    this.connectors.set(type.toLowerCase(), connectorClass);
  }

  static create(config: DatabaseConfig): DatabaseProvider {
    const type = config.type.toLowerCase();
    const ConnectorClass = this.connectors.get(type);

    if (!ConnectorClass) {
      throw new Error(`Unsupported database type: ${type}. Supported types: ${Array.from(this.connectors.keys()).join(', ')}`);
    }

    return new ConnectorClass(config);
  }

  static getSupportedTypes(): string[] {
    return Array.from(this.connectors.keys());
  }

  static isSupported(type: string): boolean {
    return this.connectors.has(type.toLowerCase());
  }
} 