export interface SemanticEntity {
  name: string;
  description: string;
  databaseTable: string;
  attributes: SemanticAttribute[];
  relationships: SemanticRelationship[];
  businessRules?: BusinessRule[];
  metadata?: EntityMetadata;
}

export interface SemanticAttribute {
  name: string;
  description: string;
  databaseColumn: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'json';
  isRequired: boolean;
  isPrimaryKey?: boolean;
  businessLogic?: string; // e.g., "format as currency", "calculate age from birthdate"
  metadata?: AttributeMetadata;
}

export interface SemanticRelationship {
  name: string;
  description: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromEntity: string;
  toEntity: string;
  fromAttribute: string;
  toAttribute: string;
  joinCondition?: string; // Custom SQL join condition
  metadata?: RelationshipMetadata;
}

export interface BusinessRule {
  name: string;
  description: string;
  condition: string; // e.g., "amount > 1000"
  action: string; // e.g., "mark as premium customer"
  priority: number;
}

export interface EntityMetadata {
  tags?: string[];
  lineage?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  permissions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  version?: string;
}

export interface AttributeMetadata {
  tags?: string[];
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  format?: string; // e.g., "currency", "percentage", "email"
  validation?: string; // e.g., "email", "phone", "url"
  unit?: string; // e.g., "USD", "kg", "meters"
}

export interface RelationshipMetadata {
  tags?: string[];
  cardinality?: string; // e.g., "1:N", "M:N"
  cascade?: 'none' | 'cascade' | 'restrict';
}

export interface SemanticMapping {
  entities: SemanticEntity[];
  globalRules?: BusinessRule[];
  metadata: {
    version: string;
    createdAt: Date;
    updatedAt: Date;
    description: string;
    tags?: string[];
    owner?: string;
    environment?: 'development' | 'staging' | 'production';
  };
}

// Add these new interfaces for better type safety
export interface QueryContext {
  query: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  tables: string[];
  columns: string[];
  user: {
    id: string;
    role: string;
    permissions: string[];
  };
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface BusinessLogicAnalysis {
  rules: BusinessRule[];
  relationships: SemanticRelationship[];
  metrics: Array<{
    name: string;
    description: string;
    formula: string;
    unit: string;
    category: string;
    calculationType: string;
  }>;
  workflows: Array<{
    name: string;
    description: string;
    steps: Array<{
      name: string;
      description: string;
      entity: string;
      action: string;
      conditions: string[];
    }>;
  }>;
}

export interface ChangeDetection {
  hasChanges: boolean;
  newTables: string[];
  removedTables: string[];
  renamedTables: Array<{ old: string; new: string }>;
  newColumns: Array<{ table: string; column: string }>;
  removedColumns: Array<{ table: string; column: string }>;
  renamedColumns: Array<{ table: string; old: string; new: string }>;
  typeChanges: Array<{ table: string; column: string; oldType: string; newType: string }>;
  relationshipChanges: Array<{ table: string; description: string }>;
} 