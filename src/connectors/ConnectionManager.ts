import { DatabaseProvider, DatabaseConfig } from '../types/Providers';
import { DatabaseConnectorFactory } from './DatabaseConnectorFactory';
import { logger } from '../utils/logger';

export interface ConnectionManagerConfig {
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

interface ManagedConnection {
  provider: DatabaseProvider;
  config: DatabaseConfig;
  connected: boolean;
  lastUsed: Date;
  inUse: boolean;
  connectionId: string;
}

export class ConnectionManager {
  private connections = new Map<string, ManagedConnection>();
  private config: ConnectionManagerConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: ConnectionManagerConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      idleTimeoutMs: config.idleTimeoutMs || 30000, // 30 seconds
      connectionTimeoutMs: config.connectionTimeoutMs || 5000,
      retryAttempts: config.retryAttempts || 3,
      retryDelayMs: config.retryDelayMs || 1000,
      ...config
    };

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Get or create a database connection
   */
  async getConnection(dbConfig: DatabaseConfig): Promise<DatabaseProvider> {
    const connectionKey = this.getConnectionKey(dbConfig);
    let managedConn = this.connections.get(connectionKey);

    if (!managedConn) {
      // Check connection limit
      if (this.connections.size >= this.config.maxConnections!) {
        await this.cleanupIdleConnections();
        if (this.connections.size >= this.config.maxConnections!) {
          throw new Error(`Maximum connections (${this.config.maxConnections}) reached`);
        }
      }

      // Create new connection
      managedConn = await this.createConnection(dbConfig, connectionKey);
      this.connections.set(connectionKey, managedConn);
    }

    // Ensure connection is active
    if (!managedConn.connected) {
      await this.reconnect(managedConn);
    }

    // Mark as in use
    managedConn.inUse = true;
    managedConn.lastUsed = new Date();

    return managedConn.provider;
  }

  /**
   * Release a connection back to the pool
   */
  async releaseConnection(dbConfig: DatabaseConfig): Promise<void> {
    const connectionKey = this.getConnectionKey(dbConfig);
    const managedConn = this.connections.get(connectionKey);

    if (managedConn) {
      managedConn.inUse = false;
      managedConn.lastUsed = new Date();
    }
  }

  /**
   * Create a new managed connection
   */
  private async createConnection(dbConfig: DatabaseConfig, connectionId: string): Promise<ManagedConnection> {
    const provider = DatabaseConnectorFactory.create(dbConfig);
    
    let attempts = 0;
    while (attempts < this.config.retryAttempts!) {
      try {
        await provider.connect(dbConfig);
        logger.info(`Database connection established: ${connectionId}`);
        
        return {
          provider,
          config: dbConfig,
          connected: true,
          lastUsed: new Date(),
          inUse: false,
          connectionId
        };
      } catch (error) {
        attempts++;
        if (attempts >= this.config.retryAttempts!) {
          logger.error(`Failed to create connection after ${attempts} attempts: ${error}`);
          throw error;
        }
        
        logger.warn(`Connection attempt ${attempts} failed, retrying in ${this.config.retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
      }
    }

    throw new Error('Failed to create connection');
  }

  /**
   * Reconnect a managed connection
   */
  private async reconnect(managedConn: ManagedConnection): Promise<void> {
    try {
      await managedConn.provider.disconnect();
    } catch (error) {
      // Ignore disconnect errors
    }

    await managedConn.provider.connect(managedConn.config);
    managedConn.connected = true;
    logger.info(`Database connection reconnected: ${managedConn.connectionId}`);
  }

  /**
   * Generate a unique connection key
   */
  private getConnectionKey(dbConfig: DatabaseConfig): string {
    const parts = [
      dbConfig.type,
      dbConfig.host || '',
      dbConfig.port || '',
      dbConfig.database || '',
      dbConfig.username || ''
    ];
    return parts.join(':');
  }

  /**
   * Start the cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections().catch(error => {
        logger.error(`Connection cleanup failed: ${error}`);
      });
    }, 10000); // Check every 10 seconds
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = new Date();
    const connectionsToClose: string[] = [];

    for (const [key, conn] of this.connections) {
      if (!conn.inUse && 
          (now.getTime() - conn.lastUsed.getTime()) > this.config.idleTimeoutMs!) {
        connectionsToClose.push(key);
      }
    }

    for (const key of connectionsToClose) {
      const conn = this.connections.get(key);
      if (conn) {
        try {
          await conn.provider.disconnect();
          logger.info(`Closed idle connection: ${conn.connectionId}`);
        } catch (error) {
          logger.error(`Error closing connection ${conn.connectionId}: ${error}`);
        }
        this.connections.delete(key);
      }
    }
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const closePromises = Array.from(this.connections.values()).map(async (conn) => {
      try {
        await conn.provider.disconnect();
        logger.info(`Closed connection: ${conn.connectionId}`);
      } catch (error) {
        logger.error(`Error closing connection ${conn.connectionId}: ${error}`);
      }
    });

    await Promise.all(closePromises);
    this.connections.clear();
    logger.info('All database connections closed');
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  } {
    const total = this.connections.size;
    const active = Array.from(this.connections.values()).filter(conn => conn.inUse).length;
    const idle = total - active;

    return {
      totalConnections: total,
      activeConnections: active,
      idleConnections: idle
    };
  }
}

// Global connection manager instance
let globalConnectionManager: ConnectionManager | null = null;

export function getGlobalConnectionManager(): ConnectionManager {
  if (!globalConnectionManager) {
    globalConnectionManager = new ConnectionManager();
  }
  return globalConnectionManager;
}

export function setGlobalConnectionManager(manager: ConnectionManager): void {
  globalConnectionManager = manager;
}
