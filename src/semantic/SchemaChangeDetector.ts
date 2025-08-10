import { 
  ChangeType, 
  ChangeSeverity, 
  ChangeImpact, 
  SchemaChange, 
  SchemaSnapshot, 
  SchemaTable, 
  SchemaColumn, 
  SchemaRelationship,
  ChangeDetectionConfig,
  ChangeRule,
  ChangeNotification,
  SchemaChangeHistory
} from '../types/SchemaChange';
import { DatabaseProvider } from '../types/Providers';
import { CacheManager } from '../cache/CacheManager';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class SchemaChangeDetector {
  private dbProvider: DatabaseProvider;
  private cache: CacheManager;
  private config: ChangeDetectionConfig;
  private history!: SchemaChangeHistory;
  private customRules: ChangeRule[];
  private snapshotPath: string;
  private historyPath: string;

  constructor(
    dbProvider: DatabaseProvider, 
    cache: CacheManager, 
    config: ChangeDetectionConfig,
    projectPath: string
  ) {
    this.dbProvider = dbProvider;
    this.cache = cache;
    this.config = config;
    this.customRules = config.customRules || [];
    this.snapshotPath = path.join(projectPath, '.sed', 'snapshots');
    this.historyPath = path.join(projectPath, '.sed', 'history.json');
    
    this.ensureDirectories();
    this.loadHistory();
  }

  /**
   * Create a snapshot of the current database schema
   */
  async createSnapshot(): Promise<SchemaSnapshot> {
    try {
      logger.info('Creating schema snapshot...');
      
      const schema = await this.dbProvider.discoverSchema();
      const tables = await this.normalizeTables(schema.tables);
      const relationships = await this.detectRelationships(tables);
      
      const snapshot: SchemaSnapshot = {
        id: uuidv4(),
        version: await this.generateVersion(),
        timestamp: new Date(),
        tables,
        relationships,
        metadata: {
          totalTables: tables.length,
          totalColumns: tables.reduce((sum, table) => sum + table.columns.length, 0),
          totalRelationships: relationships.length,
          checksum: this.calculateChecksum(tables, relationships)
        }
      };

      await this.saveSnapshot(snapshot);
      this.history.snapshots.push(snapshot);
      await this.saveHistory();

      logger.success(`Schema snapshot created: ${snapshot.id}`);
      return snapshot;

    } catch (error) {
      logger.error(`Failed to create schema snapshot: ${error}`);
      throw new Error(`Schema snapshot creation failed: ${error}`);
    }
  }

  /**
   * Detect changes between current schema and last snapshot
   */
  async detectChanges(): Promise<SchemaChange[]> {
    try {
      logger.info('Detecting schema changes...');
      
      const currentSnapshot = await this.createSnapshot();
      const previousSnapshot = this.getLastSnapshot();
      
      if (!previousSnapshot) {
        logger.info('No previous snapshot found. This is the initial snapshot.');
        return [];
      }

      const changes: SchemaChange[] = [];
      
      // Detect table changes
      changes.push(...this.detectTableChanges(previousSnapshot, currentSnapshot));
      
      // Detect column changes
      changes.push(...this.detectColumnChanges(previousSnapshot, currentSnapshot));
      
      // Detect relationship changes
      changes.push(...this.detectRelationshipChanges(previousSnapshot, currentSnapshot));
      
      // Apply custom rules
      changes.push(...await this.applyCustomRules(changes));
      
      // Filter by severity and impact thresholds
      const filteredChanges = this.filterChanges(changes);
      
      // Update history
      this.history.changes.push(...filteredChanges);
      await this.saveHistory();
      
      // Send notifications for significant changes
      await this.sendNotifications(filteredChanges);
      
      logger.success(`Detected ${filteredChanges.length} schema changes`);
      return filteredChanges;

    } catch (error) {
      logger.error(`Failed to detect schema changes: ${error}`);
      throw new Error(`Schema change detection failed: ${error}`);
    }
  }

  /**
   * Validate if changes are safe for deployment
   */
  async validateChanges(changes: SchemaChange[]): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    breakingChanges: SchemaChange[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const breakingChanges: SchemaChange[] = [];

    for (const change of changes) {
      // Check for breaking changes
      if (change.breakingChange) {
        breakingChanges.push(change);
        errors.push(`Breaking change detected: ${change.description}`);
      }

      // Check for high severity changes
      if (change.severity === ChangeSeverity.CRITICAL) {
        errors.push(`Critical change detected: ${change.description}`);
      }

      // Check for major impact changes
      if (change.impact === ChangeImpact.MAJOR || change.impact === ChangeImpact.BREAKING) {
        warnings.push(`Major impact change: ${change.description}`);
      }

      // Validate against custom rules
      for (const rule of this.customRules) {
        if (rule.enabled && rule.condition(change)) {
          try {
            await rule.action(change);
          } catch (error) {
            errors.push(`Custom rule '${rule.name}' failed: ${error}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      breakingChanges
    };
  }

  /**
   * Get change history with filtering and pagination
   */
  getChangeHistory(options: {
    fromDate?: Date;
    toDate?: Date;
    severity?: ChangeSeverity[];
    impact?: ChangeImpact[];
    table?: string;
    limit?: number;
    offset?: number;
  } = {}): SchemaChange[] {
    let filtered = this.history.changes;

    // Apply date filters
    if (options.fromDate) {
      filtered = filtered.filter(change => change.timestamp >= options.fromDate!);
    }
    if (options.toDate) {
      filtered = filtered.filter(change => change.timestamp <= options.toDate!);
    }

    // Apply severity filters
    if (options.severity) {
      filtered = filtered.filter(change => options.severity!.includes(change.severity));
    }

    // Apply impact filters
    if (options.impact) {
      filtered = filtered.filter(change => options.impact!.includes(change.impact));
    }

    // Apply table filter
    if (options.table) {
      filtered = filtered.filter(change => change.table === options.table);
    }

    // Apply pagination
    if (options.offset) {
      filtered = filtered.slice(options.offset);
    }
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // Private helper methods will be implemented in the next part...
  private ensureDirectories(): void {
    const dirs = [this.snapshotPath];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyPath)) {
        const data = fs.readFileSync(this.historyPath, 'utf8');
        this.history = JSON.parse(data);
      } else {
        this.history = {
          changes: [],
          snapshots: [],
          notifications: [],
          metadata: {
            totalChanges: 0,
            breakingChanges: 0,
            lastChange: new Date(),
            version: '1.0.0'
          }
        };
      }
    } catch (error) {
      logger.error(`Failed to load change history: ${error}`);
      this.history = {
        changes: [],
        snapshots: [],
        notifications: [],
        metadata: {
          totalChanges: 0,
          breakingChanges: 0,
          lastChange: new Date(),
          version: '1.0.0'
        }
      };
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      this.history.metadata.totalChanges = this.history.changes.length;
      this.history.metadata.breakingChanges = this.history.changes.filter(c => c.breakingChange).length;
      this.history.metadata.lastChange = new Date();
      
      fs.writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2));
    } catch (error) {
      logger.error(`Failed to save change history: ${error}`);
      throw new Error(`Failed to save change history: ${error}`);
    }
  }

  private async saveSnapshot(snapshot: SchemaSnapshot): Promise<void> {
    try {
      const filePath = path.join(this.snapshotPath, `${snapshot.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    } catch (error) {
      logger.error(`Failed to save snapshot: ${error}`);
      throw new Error(`Failed to save snapshot: ${error}`);
    }
  }

  private getLastSnapshot(): SchemaSnapshot | null {
    if (this.history.snapshots.length === 0) {
      return null;
    }
    return this.history.snapshots[this.history.snapshots.length - 1];
  }

  private async normalizeTables(tables: any[]): Promise<SchemaTable[]> {
    return tables.map(table => ({
      name: table.name,
      columns: table.columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        defaultValue: col.defaultValue,
        isPrimaryKey: col.isPrimaryKey,
        isUnique: col.isUnique,
        isIndexed: col.isIndexed,
        comment: col.comment,
        constraints: col.constraints || []
      })),
      indexes: table.indexes || [],
      constraints: table.constraints || [],
      relationships: [],
      comment: table.comment
    }));
  }

  private async detectRelationships(tables: SchemaTable[]): Promise<SchemaRelationship[]> {
    const relationships: SchemaRelationship[] = [];
    
    for (const table of tables) {
      for (const column of table.columns) {
        if (column.name.endsWith('_id') || column.name.includes('_fk')) {
          const targetTable = this.findTargetTable(column.name, tables);
          if (targetTable) {
            relationships.push({
              name: `${table.name}_${targetTable.name}`,
              type: 'one-to-many',
              sourceTable: table.name,
              sourceColumn: column.name,
              targetTable: targetTable.name,
              targetColumn: 'id'
            });
          }
        }
      }
    }
    
    return relationships;
  }

  private findTargetTable(columnName: string, tables: SchemaTable[]): SchemaTable | null {
    const possibleTableName = columnName.replace(/_id$/, '').replace(/_fk$/, '');
    return tables.find(table => table.name === possibleTableName) || null;
  }

  private calculateChecksum(tables: SchemaTable[], relationships: SchemaRelationship[]): string {
    const data = JSON.stringify({ tables, relationships });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async generateVersion(): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0];
    const count = this.history.snapshots.length + 1;
    return `${timestamp}-${count}`;
  }

  // Placeholder methods for change detection - will be implemented next
  private detectTableChanges(previous: SchemaSnapshot, current: SchemaSnapshot): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const prevTables = new Set(previous.tables.map(t => t.name));
    const currTables = new Set(current.tables.map(t => t.name));

    // Added tables
    for (const t of current.tables) {
      if (!prevTables.has(t.name)) {
        changes.push({
          id: uuidv4(),
          type: ChangeType.TABLE_ADDED,
          severity: ChangeSeverity.LOW,
          impact: ChangeImpact.MINOR,
          table: t.name,
          timestamp: new Date(),
          version: current.version,
          description: `Table added: ${t.name}`,
          breakingChange: false
        });
      }
    }

    // Removed tables
    for (const t of previous.tables) {
      if (!currTables.has(t.name)) {
        changes.push({
          id: uuidv4(),
          type: ChangeType.TABLE_REMOVED,
          severity: ChangeSeverity.HIGH,
          impact: ChangeImpact.BREAKING,
          table: t.name,
          timestamp: new Date(),
          version: current.version,
          description: `Table removed: ${t.name}`,
          breakingChange: true
        });
      }
    }

    return changes;
  }

  private detectColumnChanges(previous: SchemaSnapshot, current: SchemaSnapshot): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const prevTableMap = new Map(previous.tables.map(t => [t.name, t] as const));
    const currTableMap = new Map(current.tables.map(t => [t.name, t] as const));

    // For tables present in both snapshots, compare columns
    for (const [tableName, currTable] of currTableMap) {
      if (!prevTableMap.has(tableName)) continue;
      const prevTable = prevTableMap.get(tableName)!;

      const prevCols = new Map(prevTable.columns.map(c => [c.name, c] as const));
      const currCols = new Map(currTable.columns.map(c => [c.name, c] as const));

      // Added columns
      for (const [colName, col] of currCols) {
        if (!prevCols.has(colName)) {
          changes.push({
            id: uuidv4(),
            type: ChangeType.COLUMN_ADDED,
            severity: ChangeSeverity.MEDIUM,
            impact: ChangeImpact.MINOR,
            table: tableName,
            column: colName,
            timestamp: new Date(),
            version: current.version,
            description: `Column added: ${tableName}.${colName}`,
            breakingChange: false
          });
        }
      }

      // Removed columns
      for (const [colName, col] of prevCols) {
        if (!currCols.has(colName)) {
          changes.push({
            id: uuidv4(),
            type: ChangeType.COLUMN_REMOVED,
            severity: ChangeSeverity.HIGH,
            impact: ChangeImpact.BREAKING,
            table: tableName,
            column: colName,
            timestamp: new Date(),
            version: current.version,
            description: `Column removed: ${tableName}.${colName}`,
            breakingChange: true
          });
        }
      }

      // Type or nullability changes
      for (const [colName, currCol] of currCols) {
        const prevCol = prevCols.get(colName);
        if (!prevCol) continue;

        if (currCol.type !== prevCol.type) {
          changes.push({
            id: uuidv4(),
            type: ChangeType.COLUMN_TYPE_CHANGED,
            severity: ChangeSeverity.MEDIUM,
            impact: ChangeImpact.MODERATE,
            table: tableName,
            column: colName,
            oldValue: prevCol.type,
            newValue: currCol.type,
            timestamp: new Date(),
            version: current.version,
            description: `Column type changed: ${tableName}.${colName} ${prevCol.type} -> ${currCol.type}`,
            breakingChange: true
          });
        }

        if (currCol.nullable !== prevCol.nullable) {
          changes.push({
            id: uuidv4(),
            type: ChangeType.COLUMN_NULLABLE_CHANGED,
            severity: ChangeSeverity.MEDIUM,
            impact: currCol.nullable ? ChangeImpact.MINOR : ChangeImpact.MODERATE,
            table: tableName,
            column: colName,
            oldValue: prevCol.nullable,
            newValue: currCol.nullable,
            timestamp: new Date(),
            version: current.version,
            description: `Column nullability changed: ${tableName}.${colName} ${prevCol.nullable} -> ${currCol.nullable}`,
            breakingChange: !currCol.nullable
          });
        }
      }
    }

    return changes;
  }

  private detectRelationshipChanges(previous: SchemaSnapshot, current: SchemaSnapshot): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const relKey = (r: SchemaRelationship) => `${r.sourceTable}.${r.sourceColumn}->${r.targetTable}.${r.targetColumn}`;

    const prevRels = new Map(previous.relationships.map(r => [relKey(r), r] as const));
    const currRels = new Map(current.relationships.map(r => [relKey(r), r] as const));

    // Added relationships
    for (const [key, r] of currRels) {
      if (!prevRels.has(key)) {
        changes.push({
          id: uuidv4(),
          type: ChangeType.RELATIONSHIP_ADDED,
          severity: ChangeSeverity.LOW,
          impact: ChangeImpact.MINOR,
          table: r.sourceTable,
          column: r.sourceColumn,
          timestamp: new Date(),
          version: current.version,
          description: `Relationship added: ${key}`,
          breakingChange: false
        });
      }
    }

    // Removed relationships
    for (const [key, r] of prevRels) {
      if (!currRels.has(key)) {
        changes.push({
          id: uuidv4(),
          type: ChangeType.RELATIONSHIP_REMOVED,
          severity: ChangeSeverity.MEDIUM,
          impact: ChangeImpact.MODERATE,
          table: r.sourceTable,
          column: r.sourceColumn,
          timestamp: new Date(),
          version: current.version,
          description: `Relationship removed: ${key}`,
          breakingChange: true
        });
      }
    }

    return changes;
  }

  private async applyCustomRules(changes: SchemaChange[]): Promise<SchemaChange[]> {
    const result: SchemaChange[] = [];
    for (const change of changes) {
      result.push(change);
      for (const rule of this.customRules) {
        if (!rule.enabled) continue;
        try {
          if (rule.condition(change)) {
            await rule.action(change);
          }
        } catch (error) {
          logger.warn(`Custom change rule '${rule.name}' failed: ${error}`);
        }
      }
    }
    return result;
  }

  private filterChanges(changes: SchemaChange[]): SchemaChange[] {
    // Filter by severity and impact thresholds
    const severityOrder: ChangeSeverity[] = [ChangeSeverity.LOW, ChangeSeverity.MEDIUM, ChangeSeverity.HIGH, ChangeSeverity.CRITICAL];
    const impactOrder: ChangeImpact[] = [ChangeImpact.NONE, ChangeImpact.MINOR, ChangeImpact.MODERATE, ChangeImpact.MAJOR, ChangeImpact.BREAKING];

    return changes.filter(c => {
      const sevOk = severityOrder.indexOf(c.severity) >= severityOrder.indexOf(this.config.severityThreshold);
      const impOk = impactOrder.indexOf(c.impact) >= impactOrder.indexOf(this.config.impactThreshold);
      return sevOk && impOk;
    });
  }

  private async sendNotifications(changes: SchemaChange[]): Promise<void> {
    if (!this.config.notifyOnChanges || changes.length === 0) return;
    // MVP: log to console; integrations (email/webhook) can be added later
    changes.forEach((c) => logger.info(`Schema change: [${c.type}] ${c.description}`));
  }
}
