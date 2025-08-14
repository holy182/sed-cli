import { CacheConfig } from '../cache/CacheManager';

export interface DatabaseConfig {
  type: 'postgres' | 'mysql' | 'snowflake' | 'bigquery' | 'oracle' | 'mongodb' | 'sqlite';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  connectionString?: string;
  options?: Record<string, any>;
}

export interface AIConfig {
  provider: 'openai' | 'groq' | 'claude' | 'gemini' | 'anthropic' | 'custom';
  apiKey?: string;
  model?: string;
  endpoint?: string;
  options?: Record<string, any>;
}

// Internal discovery configuration - not exposed to users
export interface DiscoveryConfig {
  // Automatic filtering patterns
  excludeTablePatterns: string[];
  excludeSchemaPatterns: string[];
  includeSchemaPatterns: string[];
  
  // Smart detection settings
  minTableRows: number;
  maxTablesPerSchema: number;
  requireRelationships: boolean;
  
  // Priority scoring
  relationshipWeight: number;
  businessNameWeight: number;
  activityWeight: number;
}

export interface Config {
  database: DatabaseConfig;
  ai?: AIConfig; // Optional - SED handles AI internally for semantic layer creation
  cache?: CacheConfig;
  discovery?: DiscoveryConfig; // Internal - auto-configured
} 