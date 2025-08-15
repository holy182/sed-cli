import { DatabaseProvider, DatabaseConfig, DatabaseSchema, TableInfo, ColumnInfo, ForeignKeyInfo, ViewInfo, IndexInfo, ConstraintInfo, TableMetadata } from '../types/Providers';
import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';
import { DiscoveryConfigManager } from '../utils/DiscoveryConfig';

export class MySQLProvider implements DatabaseProvider {
  name = 'MySQL';
  version = '1.0.0';
  private pool: mysql.Pool | null = null;
  private databaseName: string = '';

  async connect(config: DatabaseConfig): Promise<void> {
    try {
      this.databaseName = config.database || '';
      this.pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        connectionLimit: parseInt(process.env.DB_POOL_MAX || '20'),
        charset: 'utf8mb4'
      });

      // Test connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      logger.connected('MySQL');
    } catch (error) {
      throw new Error(`MySQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      logger.disconnected('MySQL');
    } catch (error) {
      console.error('Error disconnecting from MySQL:', error);
    }
  }

  async discoverSchema(): Promise<DatabaseSchema> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const connection = await this.pool.getConnection();
      
      // Get automatic discovery configuration
      const discoveryConfig = DiscoveryConfigManager.getDefaultConfig('mysql');
      

      
      // Comprehensive table discovery using information_schema.tables
      const [tablesResult] = await connection.execute(`
        SELECT 
          TABLE_SCHEMA,
          TABLE_NAME,
          TABLE_TYPE,
          TABLE_COMMENT,
          TABLE_ROWS,
          DATA_LENGTH,
          INDEX_LENGTH,
          CREATE_TIME,
          UPDATE_TIME,
          ENGINE,
          TABLE_COLLATION
        FROM information_schema.TABLES 
        WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `);
      

      
      // Apply intelligent filtering using DiscoveryConfig
      let allTables = [];
      const permissionWarnings = new Set<string>();
      const filteredTables = [];
      
      // Initialize variables for views, procedures, and functions
      let views: any[] = [];
      let procedures: any[] = [];
      let functions: any[] = [];
      
      for (const row of tablesResult as any[]) {
        try {
          // Get table row count and relationship info
          const rowCount = await this.getTableRowCount(connection, row.TABLE_SCHEMA, row.TABLE_NAME);
          const hasRelationships = await this.hasTableRelationships(connection, row.TABLE_SCHEMA, row.TABLE_NAME);
          
          // Apply intelligent filtering
          const filterResult = DiscoveryConfigManager.shouldIncludeTable(
            row.TABLE_NAME,
            row.TABLE_SCHEMA,
            rowCount,
            hasRelationships,
            discoveryConfig
          );
          
          if (filterResult.include) {
            allTables.push({ 
              ...row, 
              rowCount, 
              hasRelationships, 
              priority: filterResult.priority, 
              reason: filterResult.reason 
            });
            filteredTables.push(row);
          } else {
            logger.debug(`Filtered out table ${row.TABLE_SCHEMA}.${row.TABLE_NAME}: ${filterResult.reason}`);
          }
        } catch (error) {
          // Permission issue - can't access this table
          permissionWarnings.add(row.TABLE_SCHEMA);
          logger.warn(`Cannot access table ${row.TABLE_SCHEMA}.${row.TABLE_NAME} — insufficient permissions`);
        }
      }
      
      // Show permission warnings
      permissionWarnings.forEach(schema => {
        logger.warn(`Skipping schema '${schema}' — insufficient permissions`);
      });
      
      // Get unique schemas from filtered tables
      const schemas = [...new Set(filteredTables
        .filter(row => row && row.TABLE_SCHEMA) // Filter out any undefined/null entries
        .map(row => row.TABLE_SCHEMA)
      )];
      logger.info(`Discovered ${allTables.length} tables across ${schemas.length} schemas (after filtering)`);

      // If no tables were discovered due to permission issues, return empty schema
      if (schemas.length === 0) {
        connection.release();
        return {
          tables: [],
          views: [],
          procedures: [],
          functions: [],
          metadata: {
            databaseName: this.databaseName,
            schemaVersion: '1.0',
            lastUpdated: new Date(),
            totalTables: 0,
            totalColumns: 0,
            schemas: []
          }
        };
      }

      // Ensure allTables is always an array and has content
      if (!Array.isArray(allTables) || allTables.length === 0) {
        logger.warn('allTables is not an array or is empty, initializing as empty array');
        allTables = [];
        connection.release();
        return {
          tables: [],
          views: [],
          procedures: [],
          functions: [],
          metadata: {
            databaseName: this.databaseName,
            schemaVersion: '1.0',
            lastUpdated: new Date(),
            totalTables: 0,
            totalColumns: 0,
            schemas: []
          }
        };
      }

      // Ensure we have valid table data before processing
      const validTables = allTables.filter(row => row && row.TABLE_NAME && row.TABLE_SCHEMA);
      
      if (validTables.length === 0) {
        logger.warn('No valid tables found after filtering');
        connection.release();
        return {
          tables: [],
          views: [],
          procedures: [],
          functions: [],
          metadata: {
            databaseName: this.databaseName,
            schemaVersion: '1.0',
            lastUpdated: new Date(),
            totalTables: 0,
            totalColumns: 0,
            schemas: []
          }
        };
      }

      
      
      const tables = await Promise.all(
        validTables.map(async (row) => {
    
            const columns = await this.getColumnInfoForSchema(row.TABLE_NAME, row.TABLE_SCHEMA);
            const indexes = await this.getTableIndexesForSchema(row.TABLE_NAME, row.TABLE_SCHEMA);
            const constraints = await this.getTableConstraintsForSchema(row.TABLE_NAME, row.TABLE_SCHEMA);
            
            return {
              name: row.TABLE_NAME,
              schema: row.TABLE_SCHEMA,
              type: row.TABLE_TYPE === 'BASE TABLE' ? 'table' as const : 'view' as const,
              columns: columns,
              indexes: indexes,
              constraints: constraints,
              metadata: {
                description: row.TABLE_COMMENT || '',
                rowCount: row.rowCount || row.TABLE_ROWS || 0,
                sizeBytes: (row.DATA_LENGTH || 0) + (row.INDEX_LENGTH || 0),
                lastModified: row.UPDATE_TIME ? new Date(row.UPDATE_TIME) : new Date(),
                tags: [],
                engine: row.ENGINE,
                collation: row.TABLE_COLLATION,
                createTime: row.CREATE_TIME ? new Date(row.CREATE_TIME) : undefined
              }
            };
          })
      );
      


      

      // Get foreign key constraints for ALL schemas with enhanced information
      let foreignKeysResult: any[] = [];

      if (Array.isArray(schemas) && schemas.length > 0) {
        const result = await connection.execute(`
          SELECT 
            CONSTRAINT_SCHEMA,
            CONSTRAINT_NAME,
            TABLE_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_SCHEMA,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
          FROM information_schema.KEY_COLUMN_USAGE 
          WHERE REFERENCED_TABLE_SCHEMA IS NOT NULL
          AND CONSTRAINT_SCHEMA IN (${schemas.map(() => '?').join(',')})
          ORDER BY CONSTRAINT_SCHEMA, TABLE_NAME, COLUMN_NAME
        `, schemas);
        foreignKeysResult = result[0] as any[];

      }

      // Apply foreign key information to columns
      for (const fk of foreignKeysResult as any[]) {
        const table = tables.find(t => t.schema === fk.TABLE_SCHEMA && t.name === fk.TABLE_NAME);
        if (table) {
          const column = table.columns.find((col: any) => col.name === fk.COLUMN_NAME);
          if (column) {
            column.isForeignKey = true;
            column.foreignKeyInfo = {
              referencedTable: fk.REFERENCED_TABLE_NAME,
              referencedColumn: fk.REFERENCED_COLUMN_NAME,
              referencedSchema: fk.REFERENCED_TABLE_SCHEMA
            };
          }
        }
      }

      // Get primary key constraints for ALL schemas
      const [primaryKeysResult] = await connection.execute(`
        SELECT 
          TABLE_SCHEMA,
          TABLE_NAME,
          COLUMN_NAME,
          CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE CONSTRAINT_NAME = 'PRIMARY'
        AND TABLE_SCHEMA IN (${Array.isArray(schemas) && schemas.length > 0 ? schemas.map(() => '?').join(',') : 'NULL'})
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
      `, Array.isArray(schemas) && schemas.length > 0 ? schemas : []);

      // Apply primary key information to columns
      for (const pk of primaryKeysResult as any[]) {
        const table = tables.find(t => t.schema === pk.TABLE_SCHEMA && t.name === pk.TABLE_NAME);
        if (table) {
          const column = table.columns.find((col: any) => col.name === pk.COLUMN_NAME);
          if (column) {
            column.isPrimaryKey = true;
          }
        }
      }

      // Get unique constraints for ALL schemas
      const [uniqueConstraintsResult] = await connection.execute(`
        SELECT 
          TABLE_SCHEMA,
          TABLE_NAME,
          COLUMN_NAME,
          CONSTRAINT_NAME,
          NON_UNIQUE
        FROM information_schema.STATISTICS 
        WHERE NON_UNIQUE = 0
        AND TABLE_SCHEMA IN (${Array.isArray(schemas) && schemas.length > 0 ? schemas.map(() => '?').join(',') : 'NULL'})
        ORDER BY TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `, Array.isArray(schemas) && schemas.length > 0 ? schemas : []);

      // Apply unique constraint information to columns
      for (const uc of uniqueConstraintsResult as any[]) {
        const table = tables.find(t => t.schema === uc.TABLE_SCHEMA && t.name === uc.TABLE_NAME);
        if (table) {
          const column = table.columns.find((col: any) => col.name === uc.COLUMN_NAME);
          // Note: ColumnInfo doesn't have indexes property, so we'll handle this in the table-level indexes
        }
      }

      // Get views from ALL schemas with enhanced information
      const [viewsResult] = await connection.execute(`
        SELECT 
          TABLE_SCHEMA,
          TABLE_NAME,
          VIEW_DEFINITION,
          IS_UPDATABLE,
          DEFINER,
          SECURITY_TYPE,
          CHARACTER_SET_CLIENT,
          COLLATION_CONNECTION
        FROM information_schema.VIEWS 
        WHERE TABLE_SCHEMA IN (${Array.isArray(schemas) && schemas.length > 0 ? schemas.map(() => '?').join(',') : 'NULL'})
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `, Array.isArray(schemas) && schemas.length > 0 ? schemas : []);

      views = await Promise.all(
        (viewsResult as any[]).map(async (row) => {
          const columns = await this.getColumnInfoForSchema(row.TABLE_NAME, row.TABLE_SCHEMA);
          return {
            name: row.TABLE_NAME,
            schema: row.TABLE_SCHEMA,
            definition: row.VIEW_DEFINITION,
            columns: columns,
            metadata: {
              isUpdatable: row.IS_UPDATABLE === 'YES',
              definer: row.DEFINER,
              securityType: row.SECURITY_TYPE,
              characterSet: row.CHARACTER_SET_CLIENT,
              collation: row.COLLATION_CONNECTION
            }
          };
        })
      );

      // Get stored procedures and functions
      const [proceduresResult] = await connection.execute(`
        SELECT 
          ROUTINE_SCHEMA,
          ROUTINE_NAME,
          ROUTINE_TYPE,
          DATA_TYPE,
          ROUTINE_DEFINITION,
          IS_DETERMINISTIC,
          SQL_DATA_ACCESS,
          SECURITY_TYPE,
          CREATED,
          LAST_ALTERED
        FROM information_schema.ROUTINES 
        WHERE ROUTINE_SCHEMA IN (${Array.isArray(schemas) && schemas.length > 0 ? schemas.map(() => '?').join(',') : 'NULL'})
        ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
      `, Array.isArray(schemas) && schemas.length > 0 ? schemas : []);

      procedures = (proceduresResult as any[]).filter(row => row.ROUTINE_TYPE === 'PROCEDURE').map(row => ({
        name: row.ROUTINE_NAME,
        parameters: [], // MySQL doesn't expose parameters easily in information_schema
        returnType: undefined
      }));

      functions = (proceduresResult as any[]).filter(row => row.ROUTINE_TYPE === 'FUNCTION').map(row => ({
        name: row.ROUTINE_NAME,
        parameters: [], // MySQL doesn't expose parameters easily in information_schema
        returnType: row.DATA_TYPE
      }));

      connection.release();

      return {
        tables,
        views,
        procedures,
        functions,
        metadata: {
          databaseName: this.databaseName,
          schemaVersion: '1.0',
          lastUpdated: new Date(),
          totalTables: tables.length,
          totalColumns: tables.reduce((sum, table) => sum + table.columns.length, 0),
          schemas: schemas
        }
      };
    } catch (error) {
      throw new Error(`Schema discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      return true;
    } catch (error) {
      return false;
    }
  }

  async executeQuery(query: string, params: any[] = []): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const connection = await this.pool.getConnection();
      const [result] = await connection.execute(query, params);
      connection.release();
      return result as any[];
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const connection = await this.pool.getConnection();
      
      // Validate table name to prevent SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Invalid table name');
      }

      const [result] = await connection.execute(`
        SELECT 
          TABLE_NAME,
          TABLE_TYPE,
          TABLE_COMMENT,
          TABLE_ROWS,
          DATA_LENGTH,
          INDEX_LENGTH
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [this.databaseName, tableName]);

      connection.release();

      if ((result as any[]).length === 0) {
        throw new Error(`Table '${tableName}' not found`);
      }

      const row = (result as any[])[0];
      const columns = await this.getColumnInfo(tableName);

      return {
        name: row.TABLE_NAME,
        schema: this.databaseName,
        type: row.TABLE_TYPE === 'BASE TABLE' ? 'table' as const : 'view' as const,
        columns: columns,
        indexes: [],
        constraints: [],
        metadata: {
          description: row.TABLE_COMMENT || '',
          rowCount: row.TABLE_ROWS || 0,
          sizeBytes: (row.DATA_LENGTH || 0) + (row.INDEX_LENGTH || 0),
          lastModified: new Date(),
          tags: []
        }
      };
    } catch (error) {
      throw new Error(`Failed to get table info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getColumnInfo(tableName: string): Promise<ColumnInfo[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const connection = await this.pool.getConnection();
      
      // Validate table name to prevent SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Invalid table name');
      }

      // Get column information
      const [columnsResult] = await connection.execute(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE,
          COLUMN_COMMENT,
          EXTRA
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [this.databaseName, tableName]);

      // Get primary key information
      const [pkResult] = await connection.execute(`
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
      `, [this.databaseName, tableName]);

      const primaryKeys = new Set((pkResult as any[]).map(row => row.COLUMN_NAME));

      // Get foreign key information
      const [fkResult] = await connection.execute(`
        SELECT 
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME,
          UPDATE_RULE,
          DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [this.databaseName, tableName]);

      const foreignKeys = new Map((fkResult as any[]).map(row => [
        row.COLUMN_NAME,
        {
          referencedTable: row.REFERENCED_TABLE_NAME,
          referencedColumn: row.REFERENCED_COLUMN_NAME,
          onUpdate: row.UPDATE_RULE || 'restrict',
          onDelete: row.DELETE_RULE || 'restrict'
        }
      ]));

      // Get index information
      const [indexResult] = await connection.execute(`
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          INDEX_TYPE
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `, [this.databaseName, tableName]);

      const indexes = new Map();
      (indexResult as any[]).forEach(row => {
        if (!indexes.has(row.COLUMN_NAME)) {
          indexes.set(row.COLUMN_NAME, []);
        }
        indexes.get(row.COLUMN_NAME).push({
          name: row.INDEX_NAME,
          type: row.INDEX_TYPE,
          isUnique: !row.NON_UNIQUE
        });
      });

      // Get ENUM values for ENUM columns
      const enumColumns = (columnsResult as any[]).filter(col => col.DATA_TYPE === 'enum');
      const enumValues = new Map();
      
      for (const col of enumColumns) {
        const [enumResult] = await connection.execute(`
          SELECT COLUMN_TYPE
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
        `, [this.databaseName, tableName, col.COLUMN_NAME]);
        
        if ((enumResult as any[]).length > 0) {
          const enumType = (enumResult as any[])[0].COLUMN_TYPE;
          // Parse ENUM values from string like "enum('value1','value2')"
          const values = enumType.match(/enum\(([^)]+)\)/)?.[1]
            ?.split(',')
            .map((v: string) => v.replace(/['"]/g, '').trim()) || [];
          enumValues.set(col.COLUMN_NAME, values);
        }
      }

      connection.release();

      return (columnsResult as any[]).map(row => {
        const isPrimaryKey = primaryKeys.has(row.COLUMN_NAME);
        const foreignKeyInfo = foreignKeys.get(row.COLUMN_NAME);
        const columnIndexes = indexes.get(row.COLUMN_NAME) || [];
        const enumVals = enumValues.get(row.COLUMN_NAME);

        return {
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE,
          nullable: row.IS_NULLABLE === 'YES',
          defaultValue: row.COLUMN_DEFAULT,
          isPrimaryKey,
          isForeignKey: !!foreignKeyInfo,
          foreignKeyInfo: foreignKeyInfo ? {
            referencedTable: foreignKeyInfo.referencedTable,
            referencedColumn: foreignKeyInfo.referencedColumn,
            onDelete: foreignKeyInfo.onDelete,
            onUpdate: foreignKeyInfo.onUpdate
          } : undefined,
          indexes: columnIndexes,
          enumValues: enumVals,
          enumDescription: enumVals ? `Domain-specific values for ${row.COLUMN_NAME}` : undefined,
          metadata: {
            description: row.COLUMN_COMMENT || '',
            sampleValues: [],
            dataProfile: {
              nullCount: 0,
              uniqueCount: 0
            },
            businessRules: []
          }
        };
      });
    } catch (error) {
      throw new Error(`Failed to get column info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to get column info for a specific schema
  private async getColumnInfoForSchema(tableName: string, schemaName: string): Promise<ColumnInfo[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const connection = await this.pool.getConnection();
      
      const [columnsResult] = await connection.execute(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE,
          COLUMN_COMMENT,
          COLUMN_KEY,
          EXTRA
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [schemaName, tableName]);

      connection.release();

      return (columnsResult as any[]).map(row => ({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        defaultValue: row.COLUMN_DEFAULT,
        isPrimaryKey: row.COLUMN_KEY === 'PRI',
        isForeignKey: false, // Will be determined by constraints
        foreignKeyInfo: undefined,
        metadata: {
          description: row.COLUMN_COMMENT || '',
          sampleValues: [],
          dataProfile: undefined,
          businessRules: []
        }
      }));
    } catch (error) {
      console.error(`Error getting column info for ${schemaName}.${tableName}:`, error);
      return [];
    }
  }

  // Helper method to get table indexes for a specific schema
  private async getTableIndexesForSchema(tableName: string, schemaName: string): Promise<IndexInfo[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const connection = await this.pool.getConnection();
      
      const [indexResult] = await connection.execute(`
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          INDEX_TYPE
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `, [schemaName, tableName]);

      const indexes = new Map();
      (indexResult as any[]).forEach(row => {
        if (!indexes.has(row.COLUMN_NAME)) {
          indexes.set(row.COLUMN_NAME, []);
        }
        indexes.get(row.COLUMN_NAME).push({
          name: row.INDEX_NAME,
          type: row.INDEX_TYPE,
          isUnique: !row.NON_UNIQUE
        });
      });

      connection.release();

             return Array.from(indexes.entries()).map(([columnName, indexList]) => ({
         name: `${tableName}_${columnName}_index`,
         columns: [columnName],
         type: 'btree' as const,
         isUnique: indexList.some((idx: any) => idx.isUnique)
       }));
    } catch (error) {
      console.error(`Error getting indexes for ${schemaName}.${tableName}:`, error);
      return [];
    }
  }

  // Helper method to get table constraints for a specific schema
  private async getTableConstraintsForSchema(tableName: string, schemaName: string): Promise<ConstraintInfo[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const connection = await this.pool.getConnection();
      
      // Get foreign key constraints
      const [foreignKeysResult] = await connection.execute(`
        SELECT 
          CONSTRAINT_SCHEMA,
          CONSTRAINT_NAME,
          TABLE_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_SCHEMA,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME,
          UPDATE_RULE,
          DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE REFERENCED_TABLE_NAME IS NOT NULL
        AND TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY CONSTRAINT_NAME, COLUMN_NAME
      `, [schemaName, tableName]);

      const foreignKeys = new Map((foreignKeysResult as any[]).map(row => [
        row.COLUMN_NAME,
        {
          referencedTable: row.REFERENCED_TABLE_NAME,
          referencedColumn: row.REFERENCED_COLUMN_NAME,
          onUpdate: row.UPDATE_RULE || 'restrict',
          onDelete: row.DELETE_RULE || 'restrict',
          constraintName: row.CONSTRAINT_NAME,
          referencedSchema: row.REFERENCED_TABLE_SCHEMA
        }
      ]));

      // Get primary key constraints
      const [primaryKeysResult] = await connection.execute(`
        SELECT 
          TABLE_SCHEMA,
          TABLE_NAME,
          COLUMN_NAME,
          CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE CONSTRAINT_NAME = 'PRIMARY'
        AND TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY COLUMN_NAME
      `, [schemaName, tableName]);

      const primaryKeys = new Map((primaryKeysResult as any[]).map(row => [
        row.COLUMN_NAME,
        {
          constraintName: row.CONSTRAINT_NAME
        }
      ]));

      // Get unique constraints
      const [uniqueConstraintsResult] = await connection.execute(`
        SELECT 
          TABLE_SCHEMA,
          TABLE_NAME,
          COLUMN_NAME,
          CONSTRAINT_NAME,
          NON_UNIQUE
        FROM information_schema.STATISTICS 
        WHERE NON_UNIQUE = 0
        AND TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY CONSTRAINT_NAME, COLUMN_NAME
      `, [schemaName, tableName]);

      const uniqueConstraints = new Map((uniqueConstraintsResult as any[]).map(row => [
        row.COLUMN_NAME,
        {
          constraintName: row.CONSTRAINT_NAME,
          isUnique: !row.NON_UNIQUE
        }
      ]));

      connection.release();

      const constraints: ConstraintInfo[] = [];
       for (const [columnName, fkInfo] of foreignKeys) {
         constraints.push({
           type: 'foreign_key',
           name: fkInfo.constraintName,
           columns: [columnName]
         });
       }
       for (const [columnName, pkInfo] of primaryKeys) {
         constraints.push({
           type: 'primary_key',
           name: pkInfo.constraintName,
           columns: [columnName]
         });
       }
       for (const [columnName, ucInfo] of uniqueConstraints) {
         constraints.push({
           type: 'unique',
           name: ucInfo.constraintName,
           columns: [columnName]
         });
       }

      return constraints;
    } catch (error) {
      console.error(`Error getting constraints for ${schemaName}.${tableName}:`, error);
      return [];
    }
  }

  /**
   * Get row count for a table
   */
  private async getTableRowCount(connection: mysql.Connection, schema: string, table: string): Promise<number> {
    try {
      const [result] = await connection.execute(`SELECT COUNT(*) as count FROM \`${schema}\`.\`${table}\``);
      return parseInt((result as any[])[0]?.count || '0');
    } catch (error) {
      return 0; // Return 0 if we can't get row count
    }
  }

  /**
   * Check if a table has relationships (foreign keys)
   */
  private async hasTableRelationships(connection: mysql.Connection, schema: string, table: string): Promise<boolean> {
    try {
      const [result] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [schema, table]);
      return parseInt((result as any[])[0]?.count || '0') > 0;
    } catch (error) {
      return false; // Return false if we can't check relationships
    }
  }
}