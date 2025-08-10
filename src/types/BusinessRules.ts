export enum RuleType {
  // Access Control Rules
  ACCESS_POLICY = 'access_policy',
  COLUMN_ACCESS = 'column_access',
  TABLE_ACCESS = 'table_access',
  
  // Data Validation Rules
  DATA_VALIDATION = 'data_validation',
  CONSTRAINT_CHECK = 'constraint_check',
  BUSINESS_LOGIC = 'business_logic',
  
  // Query Rules
  QUERY_PATTERN = 'query_pattern',
  JOIN_RULE = 'join_rule',
  AGGREGATION_RULE = 'aggregation_rule',
  
  // Business Logic Rules
  METRIC_DEFINITION = 'metric_definition',
  CALCULATION_RULE = 'calculation_rule',
  TRANSFORMATION_RULE = 'transformation_rule',
  
  // Compliance Rules
  PII_PROTECTION = 'pii_protection',
  AUDIT_REQUIREMENT = 'audit_requirement',
  RETENTION_POLICY = 'retention_policy'
}

export enum RuleSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  BLOCK = 'block'
}

export enum RuleScope {
  GLOBAL = 'global',
  DATABASE = 'database',
  TABLE = 'table',
  COLUMN = 'column',
  RELATIONSHIP = 'relationship'
}

export enum RuleTrigger {
  BEFORE_QUERY = 'before_query',
  AFTER_QUERY = 'after_query',
  ON_SCHEMA_CHANGE = 'on_schema_change',
  ON_DATA_CHANGE = 'on_data_change',
  ON_ACCESS = 'on_access'
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  severity: RuleSeverity;
  scope: RuleScope;
  trigger: RuleTrigger;
  enabled: boolean;
  priority: number;
  
  // Rule definition
  condition: RuleCondition;
  action: RuleAction;
  
  // Metadata
  tags: string[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // Dependencies
  dependsOn?: string[];
  conflictsWith?: string[];
  
  // Documentation
  examples?: RuleExample[];
  documentation?: string;
}

export interface RuleCondition {
  type: 'expression' | 'pattern' | 'function' | 'composite';
  expression?: string;
  pattern?: string;
  function?: string;
  parameters?: Record<string, any>;
  composite?: {
    operator: 'AND' | 'OR' | 'NOT';
    conditions: RuleCondition[];
  };
}

export interface RuleAction {
  type: 'allow' | 'deny' | 'modify' | 'log' | 'notify' | 'transform';
  parameters?: Record<string, any>;
  message?: string;
  code?: string;
  metadata?: Record<string, any>;
}

export interface RuleExample {
  description: string;
  input: any;
  expectedOutput: any;
  shouldPass: boolean;
}

// Specific Rule Interfaces
export interface AccessPolicyRule extends BusinessRule {
  type: RuleType.ACCESS_POLICY;
  target: {
    tables?: string[];
    columns?: string[];
    operations?: ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[];
  };
  conditions: {
    userRole?: string[];
    timeWindow?: {
      start: string;
      end: string;
    };
    ipRange?: string[];
  };
}

export interface MetricDefinitionRule extends BusinessRule {
  type: RuleType.METRIC_DEFINITION;
  metric: {
    name: string;
    description: string;
    formula: string;
    unit?: string;
    category?: string;
  };
  calculation: {
    tables: string[];
    joins: JoinDefinition[];
    filters: FilterDefinition[];
    aggregations: AggregationDefinition[];
  };
  validation: {
    minValue?: number;
    maxValue?: number;
    expectedRange?: [number, number];
    dataTypes?: string[];
  };
}

export interface JoinRule extends BusinessRule {
  type: RuleType.JOIN_RULE;
  join: {
    sourceTable: string;
    targetTable: string;
    sourceColumn: string;
    targetColumn: string;
    joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    conditions?: string[];
  };
  enforcement: {
    required: boolean;
    preferred: boolean;
    alternatives?: string[];
  };
}

export interface DataValidationRule extends BusinessRule {
  type: RuleType.DATA_VALIDATION;
  validation: {
    field: string;
    rules: ValidationRule[];
    customFunction?: string;
  };
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value?: any;
  message?: string;
  parameters?: Record<string, any>;
}

export interface JoinDefinition {
  table: string;
  on: string;
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

export interface FilterDefinition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface AggregationDefinition {
  field: string;
  function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'DISTINCT';
  alias?: string;
}

// Rule Engine Configuration
export interface RuleEngineConfig {
  enabled: boolean;
  strictMode: boolean;
  defaultSeverity: RuleSeverity;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  cacheEnabled: boolean;
  cacheTTL: number;
  maxRulesPerQuery: number;
  timeoutMs: number;
}

// Rule Execution Context
export interface RuleExecutionContext {
  query: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  tables: string[];
  columns: string[];
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
  timestamp: Date;
  metadata: Record<string, any>;
}

// Rule Execution Result
export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  severity: RuleSeverity;
  message?: string;
  action?: RuleAction;
  executionTime: number;
  metadata?: Record<string, any>;
}

// Rule Engine Response
export interface RuleEngineResponse {
  allowed: boolean;
  modifiedQuery?: string;
  results: RuleExecutionResult[];
  warnings: string[];
  errors: string[];
  executionTime: number;
  metadata: {
    rulesEvaluated: number;
    rulesPassed: number;
    rulesFailed: number;
    rulesBlocked: number;
  };
}

// Rule Template
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: Partial<BusinessRule>;
  parameters: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description: string;
    defaultValue?: any;
  }[];
  examples: RuleExample[];
}

// Rule Set
export interface RuleSet {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: BusinessRule[];
  dependencies?: string[];
  metadata: {
    totalRules: number;
    enabledRules: number;
    categories: string[];
    lastUpdated: Date;
  };
}
