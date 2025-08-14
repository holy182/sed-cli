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

// Additional types for CLI operations
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

export interface QueryResult {
  data: unknown[];
  executionTime: number;
  rowCount: number;
  metadata: {
    query: string;
    tables: string[];
    columns: string[];
    timestamp: Date;
  };
}

export interface BusinessRuleExecutionResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message?: string;
  action?: {
    type: 'allow' | 'deny' | 'modify';
    message: string;
    code?: string;
  };
}

export interface RuleEngineResponse {
  allowed: boolean;
  modifiedQuery?: string;
  errors: string[];
  warnings: string[];
  results: BusinessRuleExecutionResult[];
  metadata: {
    rulesEvaluated: number;
    rulesPassed: number;
    rulesFailed: number;
    rulesBlocked: number;
    executionTime: number;
  };
}

export interface ChangeDetectionResult {
  hasChanges: boolean;
  newTables: string[];
  removedTables: string[];
  renamedTables: { old: string; new: string }[];
  newColumns: { table: string; column: string }[];
  removedColumns: { table: string; column: string }[];
  renamedColumns: { table: string; old: string; new: string }[];
  typeChanges: { table: string; column: string; oldType: string; newType: string }[];
  relationshipChanges: { table: string; description: string }[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
  checks: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface BusinessLogicAnalysis {
  detectedCalculations: BusinessCalculation[];
  relationships: BusinessRelationship[];
  workflows: BusinessWorkflow[];
  rules: BusinessLogicRule[];
  metrics: BusinessMetric[];
}

export interface BusinessCalculation {
  name: string;
  pattern: string[];
  formula?: string;
  confidence: number;
  businessDomain: string;
  description: string;
}

export interface BusinessRelationship {
  fromEntity: string;
  toEntity: string;
  type: string;
  cardinality: string;
  businessPurpose: string;
  constraints: string[];
}

export interface BusinessWorkflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  name: string;
  description: string;
  entity: string;
  action: string;
  conditions: string[];
}

export interface BusinessLogicRule {
  name: string;
  description: string;
  type: string;
  condition: string;
  action: string;
  priority: number;
  businessDomain: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface BusinessMetric {
  name: string;
  description: string;
  unit: string;
  category: string;
  calculationType: string;
  formula: string;
} 