import { DatabaseProvider } from '../types/Providers';
import { logger } from './logger';

/**
 * Database Diagnostics Utility
 * 
 * Identifies and reports database permission and access issues that might
 * prevent full table discovery.
 */
export class DatabaseDiagnostics {
  
  /**
   * Run comprehensive database diagnostics
   */
  static async runDiagnostics(dbProvider: DatabaseProvider): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      connection: { status: 'unknown', issues: [] },
      permissions: { status: 'unknown', issues: [] },
      schemas: { status: 'unknown', issues: [] },
      tables: { status: 'unknown', issues: [] },
      recommendations: []
    };

    try {
      logger.info('Running database diagnostics...');
      
      // Test 1: Basic Connection
      await this.testConnection(dbProvider, report);
      
      // Test 2: Permission Analysis
      await this.analyzePermissions(dbProvider, report);
      
      // Test 3: Schema Access
      await this.analyzeSchemaAccess(dbProvider, report);
      
      // Test 4: Table Discovery
      await this.analyzeTableDiscovery(dbProvider, report);
      
      // Generate recommendations
      this.generateRecommendations(report);
      
      return report;
      
    } catch (error) {
      logger.error(`Diagnostics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      report.connection.status = 'failed';
      report.connection.issues.push('Diagnostics execution failed');
      return report;
    }
  }

  /**
   * Test basic database connection
   */
  private static async testConnection(dbProvider: DatabaseProvider, report: DiagnosticReport): Promise<void> {
    try {
      const isConnected = await dbProvider.testConnection();
      if (isConnected) {
        report.connection.status = 'success';
        logger.info('✅ Database connection successful');
      } else {
        report.connection.status = 'failed';
        report.connection.issues.push('Connection test failed');
        logger.error('❌ Database connection failed');
      }
    } catch (error) {
      report.connection.status = 'failed';
      report.connection.issues.push(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error(`❌ Connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze database permissions
   */
  private static async analyzePermissions(dbProvider: DatabaseProvider, report: DiagnosticReport): Promise<void> {
    try {
      logger.info('Analyzing database permissions...');
      
      // Test different permission levels
      const permissionTests = await this.runPermissionTests(dbProvider);
      
      if (permissionTests.allSchemasAccessible) {
        report.permissions.status = 'success';
        logger.info('✅ Full database access detected');
      } else if (permissionTests.someSchemasAccessible) {
        report.permissions.status = 'partial';
        logger.warn('⚠️ Partial database access detected');
        report.permissions.issues.push('Limited schema access - some schemas may be hidden');
      } else {
        report.permissions.status = 'failed';
        logger.error('❌ Very limited database access detected');
        report.permissions.issues.push('Severely restricted permissions - most schemas inaccessible');
      }
      
      // Add specific permission issues
      if (permissionTests.issues.length > 0) {
        report.permissions.issues.push(...permissionTests.issues);
      }
      
    } catch (error) {
      report.permissions.status = 'failed';
      report.permissions.issues.push(`Permission analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error(`❌ Permission analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze schema access
   */
  private static async analyzeSchemaAccess(dbProvider: DatabaseProvider, report: DiagnosticReport): Promise<void> {
    try {
      logger.info('Analyzing schema access...');
      
      const schemas = await this.discoverSchemas(dbProvider);
      
      if (schemas.length === 0) {
        report.schemas.status = 'failed';
        report.schemas.issues.push('No schemas accessible - possible permission issue');
        logger.error('❌ No schemas accessible');
      } else if (schemas.length < 3) {
        report.schemas.status = 'partial';
        report.schemas.issues.push(`Limited schema access - only ${schemas.length} schemas found`);
        logger.warn(`⚠️ Limited schema access: ${schemas.length} schemas found`);
      } else {
        report.schemas.status = 'success';
        logger.info(`✅ Schema access good: ${schemas.length} schemas found`);
      }
      
      // Log discovered schemas
      logger.info(`Discovered schemas: ${schemas.join(', ')}`);
      
    } catch (error) {
      report.schemas.status = 'failed';
      report.schemas.issues.push(`Schema analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error(`❌ Schema analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze table discovery
   */
  private static async analyzeTableDiscovery(dbProvider: DatabaseProvider, report: DiagnosticReport): Promise<void> {
    try {
      logger.info('Analyzing table discovery...');
      
      const tables = await this.discoverTables(dbProvider);
      
      if (tables.length === 0) {
        report.tables.status = 'failed';
        report.tables.issues.push('No tables discovered - possible permission or filtering issue');
        logger.error('❌ No tables discovered');
      } else if (tables.length < 10) {
        report.tables.status = 'partial';
        report.tables.issues.push(`Limited table discovery - only ${tables.length} tables found`);
        logger.warn(`⚠️ Limited table discovery: ${tables.length} tables found`);
      } else {
        report.tables.status = 'success';
        logger.info(`✅ Table discovery good: ${tables.length} tables found`);
      }
      
      // Analyze table distribution across schemas
      const schemaDistribution = this.analyzeTableDistribution(tables);
      if (schemaDistribution.issues.length > 0) {
        report.tables.issues.push(...schemaDistribution.issues);
      }
      
    } catch (error) {
      report.tables.status = 'failed';
      report.tables.issues.push(`Table analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error(`❌ Table analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run permission tests
   */
  private static async runPermissionTests(dbProvider: DatabaseProvider): Promise<PermissionTestResult> {
    const result: PermissionTestResult = {
      allSchemasAccessible: false,
      someSchemasAccessible: false,
      issues: []
    };

    try {
      // Test 1: Can we query information_schema?
      try {
        await dbProvider.executeQuery('SELECT COUNT(*) FROM information_schema.tables');
        logger.info('✅ information_schema access: OK');
      } catch (error) {
        result.issues.push('Cannot access information_schema');
        logger.warn('⚠️ information_schema access: DENIED');
      }

      // Test 2: Can we query system catalogs?
      try {
        if (dbProvider.name === 'PostgreSQL') {
          await dbProvider.executeQuery('SELECT COUNT(*) FROM pg_catalog.pg_tables');
          logger.info('✅ pg_catalog access: OK');
        } else if (dbProvider.name === 'MySQL') {
          await dbProvider.executeQuery('SELECT COUNT(*) FROM mysql.tables_priv');
          logger.info('✅ mysql system access: OK');
        }
      } catch (error) {
        result.issues.push('Cannot access system catalogs');
        logger.warn('⚠️ System catalog access: DENIED');
      }

      // Test 3: Can we list all schemas?
      try {
        const schemas = await this.discoverSchemas(dbProvider);
        if (schemas.length > 0) {
          result.someSchemasAccessible = true;
          if (schemas.length > 5) {
            result.allSchemasAccessible = true;
          }
        }
      } catch (error) {
        result.issues.push('Cannot list schemas');
      }

    } catch (error) {
      result.issues.push(`Permission test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Discover available schemas
   */
  private static async discoverSchemas(dbProvider: DatabaseProvider): Promise<string[]> {
    try {
      if (dbProvider.name === 'PostgreSQL') {
        const result = await dbProvider.executeQuery(`
          SELECT DISTINCT schema_name 
          FROM information_schema.schemata 
          ORDER BY schema_name
        `);
        return result.map((row: any) => row.schema_name);
      } else if (dbProvider.name === 'MySQL') {
        const result = await dbProvider.executeQuery(`
          SELECT DISTINCT SCHEMA_NAME 
          FROM information_schema.SCHEMATA 
          ORDER BY SCHEMA_NAME
        `);
        return result.map((row: any) => row.SCHEMA_NAME);
      } else if (dbProvider.name === 'SQLite') {
        // SQLite doesn't have multiple schemas
        return ['main'];
      }
      return [];
    } catch (error) {
      logger.warn(`Schema discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Discover available tables
   */
  private static async discoverTables(dbProvider: DatabaseProvider): Promise<Array<{schema: string, table: string}>> {
    try {
      if (dbProvider.name === 'PostgreSQL') {
        const result = await dbProvider.executeQuery(`
          SELECT table_schema, table_name 
          FROM information_schema.tables 
          WHERE table_type = 'BASE TABLE'
          ORDER BY table_schema, table_name
        `);
        return result.map((row: any) => ({ schema: row.table_schema, table: row.table_name }));
      } else if (dbProvider.name === 'MySQL') {
        const result = await dbProvider.executeQuery(`
          SELECT TABLE_SCHEMA, TABLE_NAME 
          FROM information_schema.TABLES 
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_SCHEMA, TABLE_NAME
        `);
        return result.map((row: any) => ({ schema: row.TABLE_SCHEMA, table: row.TABLE_NAME }));
      } else if (dbProvider.name === 'SQLite') {
        const result = await dbProvider.executeQuery(`
          SELECT name as table_name 
          FROM sqlite_master 
          WHERE type = 'table'
        `);
        return result.map((row: any) => ({ schema: 'main', table: row.table_name }));
      }
      return [];
    } catch (error) {
      logger.warn(`Table discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Analyze table distribution across schemas
   */
  private static analyzeTableDistribution(tables: Array<{schema: string, table: string}>): {issues: string[]} {
    const issues: string[] = [];
    const schemaCounts = new Map<string, number>();
    
    tables.forEach(table => {
      schemaCounts.set(table.schema, (schemaCounts.get(table.schema) || 0) + 1);
    });
    
    // Check for uneven distribution
    const schemas = Array.from(schemaCounts.keys());
    if (schemas.length > 1) {
      const counts = Array.from(schemaCounts.values());
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts);
      
      if (maxCount > minCount * 10) {
        issues.push('Uneven table distribution across schemas - some schemas may be filtered out');
      }
    }
    
    return { issues };
  }

  /**
   * Generate recommendations based on diagnostic results
   */
  private static generateRecommendations(report: DiagnosticReport): void {
    const recommendations: string[] = [];
    
    // Connection issues
    if (report.connection.status === 'failed') {
      recommendations.push('Check database connection credentials and network connectivity');
    }
    
    // Permission issues
    if (report.permissions.status === 'failed' || report.permissions.status === 'partial') {
      recommendations.push('Grant additional database permissions to the user');
      recommendations.push('Ensure user has SELECT privileges on information_schema');
      recommendations.push('Consider using a database user with broader access');
    }
    
    // Schema issues
    if (report.schemas.status === 'failed') {
      recommendations.push('Check if database has any user-created schemas');
      recommendations.push('Verify user has access to non-system schemas');
    }
    
    // Table issues
    if (report.tables.status === 'failed') {
      recommendations.push('Check if database contains any user tables');
      recommendations.push('Verify table discovery queries are not being filtered');
    }
    
    // General recommendations
    if (report.permissions.status !== 'success') {
      recommendations.push('Run SED with a database user that has full read access');
      recommendations.push('Check database user roles and privileges');
    }
    
    report.recommendations = recommendations;
  }

  /**
   * Print diagnostic report
   */
  static printReport(report: DiagnosticReport): void {
    logger.info('\n🔍 Database Diagnostic Report');
    logger.info('============================');
    
    // Connection Status
    logger.info(`\n📡 Connection: ${report.connection.status.toUpperCase()}`);
    if (report.connection.issues.length > 0) {
      report.connection.issues.forEach(issue => logger.error(`  ❌ ${issue}`));
    }
    
    // Permissions Status
    logger.info(`\n🔐 Permissions: ${report.permissions.status.toUpperCase()}`);
    if (report.permissions.issues.length > 0) {
      report.permissions.issues.forEach(issue => logger.warn(`  ⚠️ ${issue}`));
    }
    
    // Schema Status
    logger.info(`\n🗂️ Schema Access: ${report.schemas.status.toUpperCase()}`);
    if (report.schemas.issues.length > 0) {
      report.schemas.issues.forEach(issue => logger.warn(`  ⚠️ ${issue}`));
    }
    
    // Table Status
    logger.info(`\n📋 Table Discovery: ${report.tables.status.toUpperCase()}`);
    if (report.tables.issues.length > 0) {
      report.tables.issues.forEach(issue => logger.warn(`  ⚠️ ${issue}`));
    }
    
    // Recommendations
    if (report.recommendations.length > 0) {
      logger.info('\n💡 Recommendations:');
      report.recommendations.forEach(rec => logger.info(`  • ${rec}`));
    }
    
    logger.info('\n============================\n');
  }
}

interface DiagnosticReport {
  connection: { status: 'success' | 'failed' | 'partial' | 'unknown'; issues: string[] };
  permissions: { status: 'success' | 'failed' | 'partial' | 'unknown'; issues: string[] };
  schemas: { status: 'success' | 'failed' | 'partial' | 'unknown'; issues: string[] };
  tables: { status: 'success' | 'failed' | 'partial' | 'unknown'; issues: string[] };
  recommendations: string[];
}

interface PermissionTestResult {
  allSchemasAccessible: boolean;
  someSchemasAccessible: boolean;
  issues: string[];
} 