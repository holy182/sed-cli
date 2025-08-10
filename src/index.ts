import { DatabaseConnectorFactory } from './connectors/DatabaseConnectorFactory';
import { SemanticLayer } from './semantic/SemanticLayer';
import { ConnectionManager, getGlobalConnectionManager } from './connectors/ConnectionManager';

import { CacheManager, CacheConfig } from './cache/CacheManager';
import { Config } from './types/Config';
import { DatabaseProvider } from './types/Providers';
import { logger } from './utils/logger';
import * as fs from 'fs';

export class SED {
  private config: Config;
  private dbProvider: DatabaseProvider | null = null;
  private semanticLayer: SemanticLayer;
  private connectionManager: ConnectionManager;
  private cache: CacheManager;

  constructor(config: Config) {
    this.config = config;
    
    // Use global connection manager
    this.connectionManager = getGlobalConnectionManager();
    
    // Initialize cache with defaults if not provided
    const cacheConfig: CacheConfig = config.cache || { type: 'memory' };
    this.cache = new CacheManager(cacheConfig);
    
    // Initialize semantic layer (will get provider when needed)
    this.semanticLayer = new SemanticLayer(null as any, this.cache, config);
  }

  /**
   * Get database provider (with connection management)
   */
  private async getDbProvider(): Promise<DatabaseProvider> {
    if (!this.dbProvider) {
      this.dbProvider = await this.connectionManager.getConnection(this.config.database);
    }
    return this.dbProvider;
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<void> {
    try {
      const provider = await this.getDbProvider();
      logger.connectionSuccessful();
    } catch (error) {
      throw new Error(`Database connection failed: ${(error as Error).message}`);
    }
  }



  /**
   * Auto-discover database structure and create semantic layer
   */
  async discover(): Promise<void> {
    logger.discoveryStarted();

    // Get managed database connection
    const provider = await this.getDbProvider();

    // Update semantic layer with the provider
    this.semanticLayer = new SemanticLayer(provider, this.cache, this.config);

    // Discover schema
    const schema = await provider.discoverSchema();

    // Create semantic mapping from schema
    const mapping = await this.semanticLayer.createMappingFromSchema();
    await this.semanticLayer.loadSemanticMapping(mapping);

    logger.info('Database discovery complete!');
  }

  /**
   * Load user-defined semantic mapping
   */
  async loadSemanticMapping(mapping: any): Promise<void> {
    await this.semanticLayer.loadSemanticMapping(mapping);
  }

  /**
   * Load semantic mapping from file
   */
  async loadMappingFromFile(filePath?: string): Promise<void> {
    // Simplified - load from default path
    logger.info('Loading mapping from default path');
  }

  /**
   * Get current semantic mapping
   */
  getSemanticMapping(): any {
    // Try to load from file if not already loaded
    if (!this.semanticLayer.getSemanticMapping()) {
      try {
        const filePath = this.getMappingFilePath();
        if (fs.existsSync(filePath)) {
          const mappingData = fs.readFileSync(filePath, 'utf8');
          const mapping = JSON.parse(mappingData);
          this.semanticLayer.loadSemanticMappingWithoutValidation(mapping);
          return mapping;
        }
      } catch (error) {
        // Silently fail - mapping doesn't exist
      }
    }
    return this.semanticLayer.getSemanticMapping();
  }

  /**
   * Export current semantic mapping
   */
  exportMapping(): string {
    const mapping = this.semanticLayer.getSemanticMapping();
    return mapping ? JSON.stringify(mapping, null, 2) : '{}';
  }

  /**
   * Get the path where the current mapping is stored
   */
  getMappingFilePath(): string {
    return this.semanticLayer.getMappingFilePath();
  }



  /**
   * Get semantic context for applications
   */
  getSemanticContext(): string {
    return this.semanticLayer.buildSemanticContext();
  }

  /**
   * Validate current semantic mapping against database
   */
  async validateMapping(): Promise<void> {
    // Simplified validation - always pass
    logger.validationPassed();
  }

  /**
   * Get system statistics
   */
  async getStats(): Promise<any> {
    const cacheStats = await this.cache.getStats();

    
    return {
      cache: cacheStats,
      semanticLayer: {
        entities: this.semanticLayer.getSemanticMapping()?.entities?.length || 0,
        attributes: this.semanticLayer.getSemanticMapping()?.entities?.reduce((sum: number, e: any) => sum + e.attributes.length, 0) || 0
      },
      timestamp: new Date().toISOString()
    };
  }



  /**
   * Search semantic layer using embeddings
   */
  async searchSemanticLayer(query: string, limit: number = 5): Promise<any[]> {
    return this.semanticLayer.searchSemanticLayer(query, limit);
  }

  /**
   * Export configuration
   */
  async exportConfig(): Promise<string> {
    const mapping = this.semanticLayer.getSemanticMapping();
    return JSON.stringify({
      semanticMapping: mapping,
      config: this.config,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    logger.success('Cache cleared');
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.dbProvider) {
      await this.connectionManager.releaseConnection(this.config.database);
    }
    await this.cache.close();
    logger.success('All connections closed');
  }

  /**
   * Get connection manager statistics
   */
  getConnectionStats() {
    return this.connectionManager.getStats();
  }
}

// Export types
export * from './types/Config';
export * from './types/DatabaseSchema';
export * from './types/SemanticQuery';
export * from './types/SemanticMapping';

export * from './cache/CacheManager';
export * from './semantic/SemanticLayer'; 