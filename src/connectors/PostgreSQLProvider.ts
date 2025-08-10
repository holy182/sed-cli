import { DatabaseProvider, DatabaseConfig, DatabaseSchema, TableInfo, ColumnInfo, ForeignKeyInfo, ViewInfo, IndexInfo, ConstraintInfo, TableMetadata } from '../types/Providers';
import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { DiscoveryConfigManager } from '../utils/DiscoveryConfig';

export class PostgreSQLProvider implements DatabaseProvider {
  name = 'PostgreSQL';
  version = '1.0.0';
  private pool: Pool | null = null;
  private databaseName: string = '';

  async connect(config: DatabaseConfig): Promise<void> {
    try {
      this.databaseName = config.database || '';
      
      // Support both individual parameters and connection string
      const connectionConfig = config.connectionString ? {
        connectionString: config.connectionString
      } : {
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000')
      };

      this.pool = new Pool(connectionConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.connected('PostgreSQL');
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      logger.disconnected('PostgreSQL');
    } catch (error) {
      console.error('Error disconnecting from PostgreSQL:', error);
    }
  }

  async discoverSchema(): Promise<DatabaseSchema> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const client = await this.pool.connect();
      
      // Get automatic discovery configuration
      const discoveryConfig = DiscoveryConfigManager.getDefaultConfig('postgresql');
      
      // Comprehensive table discovery using information_schema + pg_class + pg_namespace
      let tablesResult;
      try {
        // Comprehensive table discovery
        tablesResult = await client.query(`
          SELECT 
            table_schema,
            table_name,
            table_type,
            'information_schema' as source
          FROM information_schema.tables 
          WHERE table_type IN ('BASE TABLE', 'VIEW', 'FOREIGN TABLE')
          ORDER BY table_schema, table_name
        `);
        
        // Supplement with pg_class for any missing tables (including partitioned tables)
        const pgClassResult = await client.query(`
          SELECT 
            n.nspname as table_schema,
            c.relname as table_name,
            CASE 
              WHEN c.relkind = 'r' THEN 'BASE TABLE'
              WHEN c.relkind = 'v' THEN 'VIEW'
              WHEN c.relkind = 'f' THEN 'FOREIGN TABLE'
              WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
              ELSE 'UNKNOWN'
            END as table_type,
            'pg_class' as source
          FROM pg_class c
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE c.relkind IN ('r', 'v', 'f', 'm')
          ORDER BY n.nspname, c.relname
        `);
        
        // Combine and deduplicate results
        const allTables = new Map();
        
        // Add information_schema results
        tablesResult.rows.forEach(row => {
          const key = `${row.table_schema}.${row.table_name}`;
          allTables.set(key, row);
        });
        
        // Add pg_class results (will override if duplicate)
        pgClassResult.rows.forEach(row => {
          const key = `${row.table_schema}.${row.table_name}`;
          allTables.set(key, row);
        });
        
        // Convert back to array format
        tablesResult = {
          rows: Array.from(allTables.values())
        };
        
      } catch (error) {
        logger.warn(`Comprehensive discovery failed, falling back to basic method: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Fallback: Basic table discovery
        tablesResult = await client.query(`
          SELECT 
            schemaname as table_schema,
            tablename as table_name,
            'BASE TABLE' as table_type
          FROM pg_tables 
          ORDER BY schemaname, tablename
        `);
      }

      // Include all tables with permission checking only
      const allTables = [];
      const permissionWarnings = new Set<string>();
      
      for (const row of tablesResult.rows) {
        try {
          // Get table row count and relationship info
          const rowCount = await this.getTableRowCount(client, row.table_schema, row.table_name);
          const hasRelationships = await this.hasTableRelationships(client, row.table_schema, row.table_name);
          
          allTables.push({ 
            ...row, 
            rowCount, 
            hasRelationships, 
            priority: 0.5, 
            reason: 'Table included' 
          });
        } catch (error) {
          // Permission issue - can't access this table
          permissionWarnings.add(row.table_schema);
          logger.warn(`Cannot access table ${row.table_schema}.${row.table_name} — insufficient permissions`);
        }
      }
      
      // Show permission warnings
      permissionWarnings.forEach(schema => {
        logger.warn(`Skipping schema '${schema}' — insufficient permissions`);
      });
      
      // Get unique schemas from all tables
      const schemas = [...new Set(allTables.map(row => row.table_schema))];
      logger.info(`Discovered ${allTables.length} tables across ${schemas.length} schemas`);

      // Get detailed table information with columns
      const detailedTables = await Promise.all(
        allTables.map(async (row) => {
          try {
            const columnsResult = await client.query(`
              SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale
              FROM information_schema.columns 
              WHERE table_schema = $1 AND table_name = $2
              ORDER BY ordinal_position
            `, [row.table_schema, row.table_name]);

            return {
              name: row.table_name,
              schema: row.table_schema,
              type: 'table' as const,
              columns: columnsResult.rows.map(col => ({
                name: col.column_name,
                type: col.data_type,
                nullable: col.is_nullable === 'YES',
                defaultValue: col.column_default,
                isPrimaryKey: false,
                isForeignKey: false,
                foreignKeyInfo: undefined,
                metadata: {
                  description: '',
                  sampleValues: [],
                  dataProfile: undefined,
                  businessRules: []
                }
              })),
              indexes: [],
              constraints: [],
              metadata: {
                description: '',
                rowCount: 0,
                sizeBytes: 0,
                lastModified: new Date(),
                tags: []
              }
            };
                     } catch (error) {
             logger.warn(`Failed to get columns for ${row.table_schema}.${row.table_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
              name: row.table_name,
              schema: row.table_schema,
              type: 'table' as const,
              columns: [],
              indexes: [],
              constraints: [],
              metadata: {
                description: '',
                rowCount: 0,
                sizeBytes: 0,
                lastModified: new Date(),
                tags: []
              }
            };
          }
        })
      );

      // Get foreign key constraints
      const foreignKeysResult = await client.query(`
        SELECT 
          tc.table_schema,
          tc.table_name,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ANY($1)
      `, [schemas]);

      // Apply foreign key information
      for (const fk of foreignKeysResult.rows) {
        const table = detailedTables.find(t => t.schema === fk.table_schema && t.name === fk.table_name);
        if (table) {
          const column = table.columns.find(col => col.name === fk.column_name);
          if (column) {
            column.isForeignKey = true;
                         column.foreignKeyInfo = {
               referencedTable: fk.foreign_table_name,
               referencedColumn: fk.foreign_column_name,
               referencedSchema: fk.foreign_table_schema
             } as any;
          }
        }
      }

      // Get primary key constraints
      const primaryKeysResult = await client.query(`
        SELECT 
          tc.table_schema,
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = ANY($1)
      `, [schemas]);

      // Apply primary key information
      for (const pk of primaryKeysResult.rows) {
        const table = detailedTables.find(t => t.schema === pk.table_schema && t.name === pk.table_name);
        if (table) {
          const column = table.columns.find(col => col.name === pk.column_name);
          if (column) {
            column.isPrimaryKey = true;
          }
        }
      }

      // Get views
      const viewsResult = await client.query(`
        SELECT 
          table_schema,
          table_name,
          view_definition
        FROM information_schema.views 
        WHERE table_schema = ANY($1)
      `, [schemas]);

      const views = viewsResult.rows.map(row => ({
        name: row.table_name,
        schema: row.table_schema,
        definition: row.view_definition,
        columns: []
      }));

      client.release();

      console.log(`Final result: ${detailedTables.length} tables, ${views.length} views across ${schemas.length} schemas`);

      return {
        tables: detailedTables,
        views,
        procedures: [],
        functions: [],
        metadata: {
          databaseName: this.databaseName,
          schemaVersion: '1.0',
          lastUpdated: new Date(),
          totalTables: detailedTables.length,
          totalColumns: detailedTables.reduce((sum, table) => sum + table.columns.length, 0),
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
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
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
      const client = await this.pool.connect();
      const result = await client.query(query, params);
      client.release();
      return result.rows;
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const client = await this.pool.connect();
      
      // Get table info
      const tableResult = await client.query(`
        SELECT 
          table_name,
          table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);

      if (tableResult.rows.length === 0) {
        throw new Error(`Table not found: ${tableName}`);
      }

      const columns = await this.getColumnInfo(tableName);
      client.release();

      return {
        name: tableName,
        schema: 'public',
        type: 'table',
        columns,
        indexes: [],
        constraints: [],
        metadata: {
          description: '',
          rowCount: 0,
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
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const client = await this.pool.connect();
      
      const result = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          pgd.description
        FROM information_schema.columns c
        LEFT JOIN pg_catalog.pg_statio_all_tables st ON c.table_name = st.relname
        LEFT JOIN pg_catalog.pg_description pgd ON st.relid = pgd.objoid AND c.ordinal_position = pgd.objsubid
        WHERE c.table_schema = 'public' AND c.table_name = $1
        ORDER BY c.ordinal_position
      `, [tableName]);

      client.release();

      return result.rows.map(row => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        isPrimaryKey: false, // Will be determined by constraints
        isForeignKey: false, // Will be determined by constraints
        foreignKeyInfo: undefined,
        metadata: {
          description: row.description || '',
          sampleValues: [],
          dataProfile: undefined,
          businessRules: []
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get column info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get row count for a table
   */
  private async getTableRowCount(client: PoolClient, schema: string, table: string): Promise<number> {
    try {
      const result = await client.query(`SELECT COUNT(*) as count FROM "${schema}"."${table}"`);
      return parseInt(result.rows[0]?.count || '0');
    } catch (error) {
      return 0; // Return 0 if we can't get row count
    }
  }

  /**
   * Check if a table has relationships (foreign keys)
   */
  private async hasTableRelationships(client: PoolClient, schema: string, table: string): Promise<boolean> {
    try {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.key_column_usage 
        WHERE table_schema = $1 
        AND table_name = $2 
        AND constraint_name LIKE '%_fkey'
      `, [schema, table]);
      return parseInt(result.rows[0]?.count || '0') > 0;
    } catch (error) {
      return false; // Return false if we can't check relationships
    }
  }
}