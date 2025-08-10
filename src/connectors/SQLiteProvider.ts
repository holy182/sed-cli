import { DatabaseProvider, DatabaseConfig, DatabaseSchema, TableInfo, ColumnInfo, ForeignKeyInfo, ViewInfo, IndexInfo, ConstraintInfo, TableMetadata } from '../types/Providers';
import { Database } from 'sqlite3';
import { open, Database as SQLiteDB } from 'sqlite';
import { logger } from '../utils/logger';
import { DiscoveryConfigManager } from '../utils/DiscoveryConfig';

export class SQLiteProvider implements DatabaseProvider {
  name = 'SQLite';
  version = '1.0.0';
  private db: SQLiteDB | null = null;
  private dbPath: string = '';

  async connect(config: DatabaseConfig): Promise<void> {
    try {
      // SQLite uses file path instead of host/port
      this.dbPath = config.database || config.connectionString || ':memory:';
      
      this.db = await open({
        filename: this.dbPath,
        driver: Database
      });

      // Test connection
      await this.db.get('SELECT 1');
      logger.connected('SQLite');
    } catch (error) {
      throw new Error(`SQLite connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.db) {
        await this.db.close();
        this.db = null;
      }
      logger.disconnected('SQLite');
    } catch (error) {
      console.error('Error disconnecting from SQLite:', error);
    }
  }

  async discoverSchema(): Promise<DatabaseSchema> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    try {
      // Get automatic discovery configuration
      const discoveryConfig = DiscoveryConfigManager.getDefaultConfig('sqlite');
      
      // Comprehensive table discovery using sqlite_master
      const tablesResult = await this.db.all(`
        SELECT 
          name,
          type,
          sql,
          tbl_name,
          rootpage
        FROM sqlite_master 
        WHERE type IN ('table', 'view')
        ORDER BY name
      `);


      logger.info(`Discovered ${tablesResult.length} tables/views in SQLite database`);
      
      // Include all tables
      const allTables = [];
      
      for (const row of tablesResult) {
        // Get table row count and relationship info
        const rowCount = await this.getTableRowCount(row.name);
        const hasRelationships = await this.hasTableRelationships(row.name);
        
        allTables.push({ 
          ...row, 
          rowCount, 
          hasRelationships, 
          priority: 0.5, 
          reason: 'Table included' 
        });
      }
      

      logger.info(`Discovered ${allTables.length} tables`);

      const tables = await Promise.all(
        allTables.map(async (row) => {
          const columns = await this.getColumnInfo(row.name);
          const rowCount = await this.getTableRowCount(row.name);
          const indexes = await this.getTableIndexes(row.name);
          const constraints = await this.getTableConstraints(row.name);
          
          return {
            name: row.name,
            schema: 'main', // SQLite uses 'main' as default schema
            type: row.type === 'table' ? 'table' as const : 'view' as const,
            columns: columns,
            indexes: indexes,
            constraints: constraints,
            metadata: {
              description: '',
              rowCount: rowCount,
              sizeBytes: 0, // SQLite doesn't expose table size easily
              lastModified: new Date(),
              tags: [],
              rootPage: row.rootpage
            }
          };
        })
      );

      // Separate tables and views
      const tableEntities = tables.filter(t => t.type === 'table');
      const viewEntities = tables.filter(t => t.type === 'view');

      const views = await Promise.all(
        viewEntities.map(async (table) => {
          const viewDefinition = await this.getViewDefinition(table.name);
          return {
            name: table.name,
            schema: 'main',
            definition: viewDefinition,
            columns: table.columns
          };
        })
      );

      // Get foreign key relationships with enhanced information
      await this.enrichForeignKeys(tableEntities);

      // Get database metadata
      const dbInfo = await this.getDatabaseInfo();

      return {
        tables: tableEntities,
        views,
        procedures: [], // SQLite doesn't support stored procedures
        functions: [], // SQLite doesn't support stored functions
        metadata: {
          databaseName: this.dbPath,
          schemaVersion: '1.0',
          lastUpdated: new Date(),
          totalTables: tableEntities.length,
          totalColumns: tableEntities.reduce((sum, table) => sum + table.columns.length, 0),
          schemas: ['main'] // SQLite typically uses 'main' schema
        }
      };
    } catch (error) {
      throw new Error(`Schema discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.db) {
        return false;
      }
      await this.db.get('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  async executeQuery(query: string, params: any[] = []): Promise<any[]> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    try {
      const result = await this.db.all(query, params);
      return result;
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    try {
      // Validate table name to prevent SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Invalid table name');
      }

      const result = await this.db.get(`
        SELECT 
          name,
          type,
          sql
        FROM sqlite_master 
        WHERE type IN ('table', 'view') AND name = ?
      `, [tableName]);

      if (!result) {
        throw new Error(`Table '${tableName}' not found`);
      }

      const columns = await this.getColumnInfo(tableName);
      const rowCount = await this.getTableRowCount(tableName);

             return {
         name: result.name,
         schema: 'main',
         type: result.type === 'table' ? 'table' as const : 'view' as const,
         columns: columns,
         indexes: [],
         constraints: [],
         metadata: {
           description: '',
           rowCount: rowCount,
           sizeBytes: 0,
           lastModified: new Date(),
           tags: []
         }
       };
    } catch (error) {
      throw new Error(`Failed to get table info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getColumnInfo(tableName: string): Promise<ColumnInfo[]> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    try {
      // Validate table name to prevent SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Invalid table name');
      }

      // Get column information using PRAGMA with enhanced details
      const columnsResult = await this.db.all(`PRAGMA table_info("${tableName}")`);

      // Get foreign key information with enhanced details
      const fkResult = await this.db.all(`PRAGMA foreign_key_list("${tableName}")`);

      // Get index information with enhanced details
      const indexResult = await this.db.all(`PRAGMA index_list("${tableName}")`);

      // Get table constraints
      const constraintResult = await this.db.all(`PRAGMA table_info("${tableName}")`);

      // Process foreign keys with enhanced information
      const foreignKeys = new Map();
      fkResult.forEach(fk => {
        foreignKeys.set(fk.from, {
          referencedTable: fk.table,
          referencedColumn: fk.to,
          onDelete: fk.on_delete || 'restrict',
          onUpdate: fk.on_update || 'restrict',
          id: fk.id,
          seq: fk.seq
        });
      });

      // Process indexes with enhanced information
      const indexes = new Map();
      for (const index of indexResult) {
        const indexInfo = await this.db.all(`PRAGMA index_info("${index.name}")`);
        // Ensure indexInfo is an array before calling forEach
        if (Array.isArray(indexInfo)) {
          indexInfo.forEach(info => {
            const columnName = columnsResult[info.cid]?.name;
            if (columnName) {
              if (!indexes.has(columnName)) {
                indexes.set(columnName, []);
              }
              indexes.get(columnName).push({
                name: index.name,
                type: 'btree',
                isUnique: index.unique === 1,
                partial: index.partial === 1
              });
            }
          });
        }
      }

      // Process constraints
      const constraints = new Map();
      constraintResult.forEach(col => {
        if (col.pk) {
          constraints.set(col.name, { type: 'primary_key', autoincrement: col.pk > 1 });
        }
        if (col.notnull) {
          constraints.set(col.name, { type: 'not_null' });
        }
      });

      return columnsResult.map(row => {
        const isPrimaryKey = row.pk === 1;
        const foreignKeyInfo = foreignKeys.get(row.name);
        const columnIndexes = indexes.get(row.name) || [];
        const constraint = constraints.get(row.name);

        return {
          name: row.name,
          type: row.type,
          nullable: row.notnull === 0,
          defaultValue: row.dflt_value,
          isPrimaryKey,
          isForeignKey: !!foreignKeyInfo,
          foreignKeyInfo: foreignKeyInfo ? {
            referencedTable: foreignKeyInfo.referencedTable,
            referencedColumn: foreignKeyInfo.referencedColumn,
            onDelete: foreignKeyInfo.onDelete,
            onUpdate: foreignKeyInfo.onUpdate
          } : undefined,
          metadata: {
            description: '',
            sampleValues: [],
            dataProfile: {
              nullCount: 0,
              uniqueCount: 0
            },
            businessRules: [],
            autoincrement: constraint?.type === 'primary_key' && constraint.autoincrement,
            constraintType: constraint?.type
          }
        };
      });
    } catch (error) {
      throw new Error(`Failed to get column info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTableRowCount(tableName: string): Promise<number> {
    if (!this.db) {
      return 0;
    }

    try {
      const result = await this.db.get(`SELECT COUNT(*) as count FROM "${tableName}"`);
      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  // Helper method to get table indexes
  private async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    if (!this.db) return [];

    try {
      const indexesResult = await this.db.all(`
        SELECT 
          name,
          sql
        FROM sqlite_master 
        WHERE type = 'index' AND tbl_name = ?
      `, [tableName]);

      return indexesResult.map(row => ({
        name: row.name,
        columns: [], // Would need to parse SQL to get columns
        type: 'btree' as const,
        isUnique: row.sql?.toLowerCase().includes('unique') || false
      }));
    } catch (error) {
      console.error(`Error getting indexes for ${tableName}:`, error);
      return [];
    }
  }

  // Helper method to get table constraints
  private async getTableConstraints(tableName: string): Promise<ConstraintInfo[]> {
    if (!this.db) return [];

    try {
      const constraintsResult = await this.db.all(`PRAGMA table_info("${tableName}")`);

      const constraints: ConstraintInfo[] = [];

      for (const col of constraintsResult) {
        if (col.pk) {
          constraints.push({
            name: `pk_${tableName}_${col.name}`,
            type: 'primary_key',
            columns: [col.name],
            definition: `PRIMARY KEY (${col.name})`
          });
        }
        if (col.notnull) {
          constraints.push({
            name: `nn_${tableName}_${col.name}`,
            type: 'not_null',
            columns: [col.name],
            definition: `NOT NULL`
          });
        }
      }

      return constraints;
    } catch (error) {
      console.error(`Error getting constraints for ${tableName}:`, error);
      return [];
    }
  }

  // Helper method to enrich foreign key information with enhanced details
  private async enrichForeignKeys(tables: any[]): Promise<void> {
    if (!this.db) return;

    try {
      for (const table of tables) {
        const foreignKeysResult = await this.db.all(`PRAGMA foreign_key_list("${table.name}")`);

        for (const fk of foreignKeysResult) {
          const column = table.columns.find((col: any) => col.name === fk.from);
          if (column) {
            column.isForeignKey = true;
            column.foreignKeyInfo = {
              referencedTable: fk.table,
              referencedColumn: fk.to,
              referencedSchema: 'main',
              onDelete: fk.on_delete as any,
              onUpdate: fk.on_update as any
            };
            
            // Add additional metadata about the foreign key relationship
            if (!column.metadata.businessRules) {
              column.metadata.businessRules = [];
            }
            column.metadata.businessRules.push(
              `References ${fk.table}.${fk.to} with ${fk.on_delete || 'RESTRICT'} on delete and ${fk.on_update || 'RESTRICT'} on update`
            );
          }
        }
      }
    } catch (error) {
      console.error('Error enriching foreign keys:', error);
    }
  }

  private async getViewDefinition(viewName: string): Promise<string> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    try {
      const result = await this.db.get(`
        SELECT sql FROM sqlite_master WHERE type = 'view' AND name = ?
      `, [viewName]);

      if (!result) {
        return '';
      }
      return result.sql;
    } catch (error) {
      console.error(`Error getting view definition for ${viewName}:`, error);
      return '';
    }
  }

  private async getDatabaseInfo(): Promise<any> {
    if (!this.db) {
      return {};
    }

    try {
      const result = await this.db.get(`PRAGMA user_version`);
      return {
        userVersion: result?.user_version || 0,
        pageSize: await this.db.get(`PRAGMA page_size`),
        pageCount: await this.db.get(`PRAGMA page_count`),
        schemaCount: await this.db.get(`PRAGMA schema_version`),
        schemaNames: await this.db.all(`PRAGMA schema_list`)
      };
    } catch (error) {
      console.error('Error getting database info:', error);
      return {};
    }
  }

  /**
   * Check if a table has relationships (foreign keys)
   */
  private async hasTableRelationships(tableName: string): Promise<boolean> {
    if (!this.db) return false;
    
    try {
      const result = await this.db.all(`PRAGMA foreign_key_list("${tableName}")`);
      return result.length > 0;
    } catch (error) {
      return false; // Return false if we can't check relationships
    }
  }
} 