import { DiscoveryConfig } from '../types/Config';

/**
 * Automatic Discovery Configuration
 * 
 * Provides smart defaults for automatic table discovery without user configuration.
 * Uses intelligent patterns to identify and prioritize business-relevant tables.
 */
export class DiscoveryConfigManager {
  
  /**
   * Get automatic discovery configuration for a database type
   */
  static getDefaultConfig(dbType: string): DiscoveryConfig {
    const baseConfig: DiscoveryConfig = {
      // Minimal filtering: Only exclude obvious database system tables
      excludeTablePatterns: [
        // Database system tables only (very specific)
        '^pg_',           // PostgreSQL system tables
        '^sqlite_',       // SQLite system tables  
        '^mysql\\.',       // MySQL system tables
      ],
      
      excludeSchemaPatterns: [
        // Only obvious database system schemas
        'information_schema', 'pg_catalog', 'pg_toast', 'pg_temp*',
        'mysql', 'performance_schema', 'sys'
      ],
      
      includeSchemaPatterns: [
        // Business schemas (included by default)
        'public', 'main', 'dbo',
        // Common business schema patterns
        'app_*', 'business_*', 'core_*', 'data_*',
        'analytics', 'reporting', 'sales', 'marketing',
        'hr', 'finance', 'inventory', 'orders', 'fleet', 'payroll', 'accounting'
      ],
      
      // Intelligent detection settings
      minTableRows: 0, // Include all tables, even empty ones
      maxTablesPerSchema: 1000, // Higher limit for comprehensive discovery
      requireRelationships: false, // Don't require relationships initially
      
      // Priority scoring weights
      relationshipWeight: 0.4, // Tables with foreign keys get higher priority
      businessNameWeight: 0.3, // Tables with business-relevant names
      activityWeight: 0.3 // Tables with recent activity
    };

    // Database-specific adjustments
    switch (dbType.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return {
          ...baseConfig,
          excludeSchemaPatterns: [
            ...baseConfig.excludeSchemaPatterns,
            'pg_temp_*', 'pg_toast_temp_*'
          ]
        };
        
      case 'mysql':
        return {
          ...baseConfig,
          excludeSchemaPatterns: [
            ...baseConfig.excludeSchemaPatterns,
            'mysql_innodb_cluster_metadata'
          ]
        };
        
      case 'sqlite':
        return {
          ...baseConfig,
          excludeTablePatterns: [
            ...baseConfig.excludeTablePatterns,
            'sqlite_*'
          ],
          excludeSchemaPatterns: ['sqlite_*']
        };
        
      default:
        return baseConfig;
    }
  }

  /**
   * Check if a table should be included based on automatic rules
   * 
   * Intelligent filtering: Include business tables, exclude only obvious system tables
   */
  static shouldIncludeTable(
    tableName: string, 
    schemaName: string, 
    rowCount: number,
    hasRelationships: boolean,
    config: DiscoveryConfig
  ): { include: boolean; reason: string; priority: number } {
    
    // Only exclude obvious database system schemas
    const systemSchemas = ['information_schema', 'pg_catalog', 'pg_toast', 'mysql', 'performance_schema', 'sys'];
    if (systemSchemas.includes(schemaName.toLowerCase())) {
      return { include: false, reason: `Database system schema: ${schemaName}`, priority: 0 };
    }
    
    // Check table name patterns (only exclude obvious system/temp tables)
    for (const pattern of config.excludeTablePatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(tableName)) {
        return { include: false, reason: `System table pattern: ${pattern}`, priority: 0 };
      }
    }
    
    // Include all other tables with intelligent prioritization
    let priority = 0.5; // Base priority for all tables
    let reasons: string[] = ['Business table included'];
    
    // Bonus for relationships
    if (hasRelationships) {
      priority += 0.2;
      reasons.push('Has relationships');
    }
    
    // Bonus for business-relevant names
    if (this.hasBusinessName(tableName)) {
      priority += 0.2;
      reasons.push('Business-relevant name');
    }
    
    // Bonus for high activity
    if (rowCount > 100) {
      priority += 0.1;
      reasons.push('High activity');
    }
    
    return {
      include: true,
      reason: reasons.join(', '),
      priority: Math.min(priority, 1.0)
    };
  }

  /**
   * Check if a string matches a pattern (supports wildcards)
   */
  private static matchesPattern(value: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(value);
  }

  /**
   * Check if table name suggests business relevance
   */
  private static hasBusinessName(tableName: string): boolean {
    const businessKeywords = [
      'user', 'customer', 'order', 'product', 'sale', 'invoice',
      'employee', 'account', 'transaction', 'payment', 'item',
      'category', 'department', 'company', 'organization',
      'report', 'analytics', 'summary', 'dashboard'
    ];
    
    const lowerName = tableName.toLowerCase();
    return businessKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if schema is business-relevant
   */
  private static isBusinessSchema(schemaName: string, config: DiscoveryConfig): boolean {
    return config.includeSchemaPatterns.some(pattern => 
      this.matchesPattern(schemaName, pattern)
    );
  }

  /**
   * Sort tables by priority for discovery
   */
  static sortTablesByPriority(tables: Array<{
    name: string;
    schema: string;
    rowCount: number;
    hasRelationships: boolean;
  }>, config: DiscoveryConfig): Array<{
    name: string;
    schema: string;
    rowCount: number;
    hasRelationships: boolean;
    priority: number;
    reason: string;
  }> {
    return tables
      .map(table => {
        const result = this.shouldIncludeTable(
          table.name,
          table.schema,
          table.rowCount,
          table.hasRelationships,
          config
        );
        
        return {
          ...table,
          priority: result.priority,
          reason: result.reason
        };
      })
            .filter(table => table.priority > 0)
      .sort((a, b) => b.priority - a.priority);
   }
} 