export enum ChangeType {
  COLUMN_ADDED = 'column_added',
  COLUMN_REMOVED = 'column_removed',
  COLUMN_RENAMED = 'column_renamed',
  COLUMN_TYPE_CHANGED = 'column_type_changed',
  COLUMN_NULLABLE_CHANGED = 'column_nullable_changed',
  TABLE_ADDED = 'table_added',
  TABLE_REMOVED = 'table_removed',
  TABLE_RENAMED = 'table_renamed',
  INDEX_ADDED = 'index_added',
  INDEX_REMOVED = 'index_removed',
  CONSTRAINT_ADDED = 'constraint_added',
  CONSTRAINT_REMOVED = 'constraint_removed',
  RELATIONSHIP_ADDED = 'relationship_added',
  RELATIONSHIP_REMOVED = 'relationship_removed'
}

export enum ChangeSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ChangeImpact {
  NONE = 'none',
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  BREAKING = 'breaking'
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  comment?: string;
  constraints?: string[];
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  indexes: string[];
  constraints: string[];
  relationships: SchemaRelationship[];
  comment?: string;
}

export interface SchemaRelationship {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

export interface SchemaChange {
  id: string;
  type: ChangeType;
  severity: ChangeSeverity;
  impact: ChangeImpact;
  table?: string;
  column?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  version: string;
  description: string;
  breakingChange: boolean;
  affectedQueries?: string[];
  migrationScript?: string;
  rollbackScript?: string;
  metadata?: Record<string, any>;
}

export interface SchemaSnapshot {
  id: string;
  version: string;
  timestamp: Date;
  tables: SchemaTable[];
  relationships: SchemaRelationship[];
  metadata: {
    totalTables: number;
    totalColumns: number;
    totalRelationships: number;
    checksum: string;
  };
}

export interface ChangeDetectionConfig {
  enabled: boolean;
  autoDetect: boolean;
  notifyOnChanges: boolean;
  severityThreshold: ChangeSeverity;
  impactThreshold: ChangeImpact;
  excludedTables?: string[];
  excludedColumns?: string[];
  customRules?: ChangeRule[];
}

export interface ChangeRule {
  id: string;
  name: string;
  description: string;
  condition: (change: SchemaChange) => boolean;
  action: (change: SchemaChange) => Promise<void>;
  severity: ChangeSeverity;
  enabled: boolean;
}

export interface ChangeNotification {
  id: string;
  changeId: string;
  type: 'email' | 'webhook' | 'slack' | 'console';
  recipients?: string[];
  webhookUrl?: string;
  message: string;
  timestamp: Date;
  sent: boolean;
  error?: string;
}

export interface SchemaChangeHistory {
  changes: SchemaChange[];
  snapshots: SchemaSnapshot[];
  notifications: ChangeNotification[];
  metadata: {
    totalChanges: number;
    breakingChanges: number;
    lastChange: Date;
    version: string;
  };
}
