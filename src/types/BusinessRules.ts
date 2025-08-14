export enum RuleType {
  // Existing rule types
  ACCESS_POLICY = 'access_policy',
  PII_PROTECTION = 'pii_protection',
  DATA_VALIDATION = 'data_validation',
  CALCULATION_RULE = 'calculation_rule',
  JOIN_RULE = 'join_rule',
  METRIC_DEFINITION = 'metric_definition',
  BUSINESS_LOGIC = 'business_logic',
  AUDIT_REQUIREMENT = 'audit_requirement',
  
  // New rule types for Data Analysts & Engineers
  DATA_QUALITY = 'data_quality',
  DATA_FRESHNESS = 'data_freshness',
  DATA_LINEAGE = 'data_lineage',
  SCHEMA_VALIDATION = 'schema_validation',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  COST_OPTIMIZATION = 'cost_optimization',
  COMPLIANCE_CHECK = 'compliance_check',
  DATA_CATALOG = 'data_catalog',
  ETL_VALIDATION = 'etl_validation',
  DATA_PROFILING = 'data_profiling',
  ANOMALY_DETECTION = 'anomaly_detection',
  SLA_MONITORING = 'sla_monitoring',
  DEPENDENCY_CHECK = 'dependency_check',
  BACKUP_VERIFICATION = 'backup_verification',
  DATA_RETENTION = 'data_retention'
}

export enum RuleSeverity {
  // Existing severity levels
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  BLOCK = 'block',
  CRITICAL = 'critical',
  
  // New severity levels for data professionals
  DATA_QUALITY_ISSUE = 'data_quality_issue',
  PERFORMANCE_IMPACT = 'performance_impact',
  COST_ALERT = 'cost_alert',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  SLA_BREACH = 'sla_breach',
  ANOMALY = 'anomaly'
}

export enum RuleScope {
  // Existing scopes
  GLOBAL = 'global',
  DATABASE = 'database',
  TABLE = 'table',
  COLUMN = 'column',
  USER = 'user',
  ROLE = 'role',
  
  // New scopes for data professionals
  PIPELINE = 'pipeline',
  WORKFLOW = 'workflow',
  JOB = 'job',
  SCHEDULE = 'schedule',
  ENVIRONMENT = 'environment',
  REGION = 'region',
  TENANT = 'tenant',
  PROJECT = 'project',
  TEAM = 'team',
  DATA_DOMAIN = 'data_domain'
}

export enum RuleTrigger {
  // Existing triggers
  BEFORE_QUERY = 'before_query',
  AFTER_QUERY = 'after_query',
  ON_ACCESS = 'on_access',
  ON_UPDATE = 'on_update',
  ON_DELETE = 'on_delete',
  
  // New triggers for data workflows
  ON_DATA_LOAD = 'on_data_load',
  ON_ETL_COMPLETE = 'on_etl_complete',
  ON_SCHEDULE = 'on_schedule',
  ON_METRIC_CALCULATION = 'on_metric_calculation',
  ON_ANOMALY_DETECTED = 'on_anomaly_detected',
  ON_SLA_CHECK = 'on_sla_check',
  ON_BACKUP_VERIFICATION = 'on_backup_verification',
  ON_RETENTION_CHECK = 'on_retention_check'
}

export enum ActionType {
  // Existing action types
  ALLOW = 'allow',
  DENY = 'deny',
  MODIFY = 'modify',
  LOG = 'log',
  NOTIFY = 'notify',
  
  // New action types for data professionals
  ALERT = 'alert',
  ESCALATE = 'escalate',
  RETRY = 'retry',
  FALLBACK = 'fallback',
  ROLLBACK = 'rollback',
  COMPENSATE = 'compensate',
  THROTTLE = 'throttle',
  CACHE = 'cache',
  PREWARM = 'prewarm',
  OPTIMIZE = 'optimize',
  PROFILING = 'profiling',
  SAMPLING = 'sampling',
  VALIDATION = 'validation',
  CLEANSING = 'cleansing',
  ENRICHMENT = 'enrichment',
  AGGREGATION = 'aggregation',
  PARTITIONING = 'partitioning',
  INDEXING = 'indexing'
}

export enum ConditionType {
  // Existing condition types
  FUNCTION = 'function',
  EXPRESSION = 'expression',
  PATTERN = 'pattern',
  COMPOSITE = 'composite',
  
  // New condition types for data professionals
  DATA_QUALITY = 'data_quality',
  PERFORMANCE_METRIC = 'performance_metric',
  COST_THRESHOLD = 'cost_threshold',
  SLA_METRIC = 'sla_metric',
  ANOMALY_DETECTION = 'anomaly_detection',
  TREND_ANALYSIS = 'trend_analysis',
  STATISTICAL_TEST = 'statistical_test',
  MACHINE_LEARNING = 'machine_learning',
  BUSINESS_METRIC = 'business_metric',
  COMPLIANCE_CHECK = 'compliance_check',
  DEPENDENCY_GRAPH = 'dependency_graph',
  RESOURCE_UTILIZATION = 'resource_utilization',
  DATA_FRESHNESS = 'data_freshness',
  SCHEMA_COMPLIANCE = 'schema_compliance',
  REFERENTIAL_INTEGRITY = 'referential_integrity'
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
  condition: RuleCondition;
  action: RuleAction;
  tags: string[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // New metadata fields for data professionals
  metadata?: {
    // Data Quality & Governance
    dataQualityMetrics?: {
      completeness?: number;
      accuracy?: number;
      consistency?: number;
      timeliness?: number;
      validity?: number;
      uniqueness?: number;
    };
    
    // Performance & Cost
    performanceMetrics?: {
      queryTime?: number;
      resourceUsage?: number;
      costPerQuery?: number;
      throughput?: number;
      latency?: number;
    };
    
    // Compliance & Audit
    complianceInfo?: {
      regulation?: string;
      standard?: string;
      auditFrequency?: string;
      lastAudit?: Date;
      nextAudit?: Date;
      complianceScore?: number;
    };
    
    // SLA & Monitoring
    slaInfo?: {
      target?: number;
      threshold?: number;
      measurement?: string;
      escalationPath?: string[];
      notificationChannels?: string[];
    };
    
    // Data Lineage & Dependencies
    lineageInfo?: {
      upstreamSources?: string[];
      downstreamConsumers?: string[];
      transformationSteps?: string[];
      dataFlow?: string;
      refreshSchedule?: string;
    };
    
    // Business Context
    businessContext?: {
      domain?: string;
      owner?: string;
      stakeholders?: string[];
      businessImpact?: string;
      riskLevel?: string;
      priority?: string;
    };
    
    // Technical Details
    technicalDetails?: {
      technology?: string;
      version?: string;
      dependencies?: string[];
      configuration?: Record<string, unknown>;
      customFields?: Record<string, unknown>;
    };
  };
}

export interface RuleCondition {
  type: ConditionType;
  
  // Basic conditions
  expression?: string;
  pattern?: string;
  function?: string;
  
  // Advanced conditions for data professionals
  dataQuality?: {
    metric: 'completeness' | 'accuracy' | 'consistency' | 'timeliness' | 'validity' | 'uniqueness';
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    threshold: number;
    column?: string;
    table?: string;
  };
  
  performance?: {
    metric: 'queryTime' | 'resourceUsage' | 'costPerQuery' | 'throughput' | 'latency';
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    threshold: number;
    timeWindow?: string; // e.g., "1h", "24h", "7d"
  };
  
  anomaly?: {
    method: 'statistical' | 'ml' | 'threshold' | 'trend';
    sensitivity: 'low' | 'medium' | 'high';
    baseline?: number;
    deviation?: number;
  };
  
  compliance?: {
    regulation: string;
    standard: string;
    checkType: 'audit' | 'validation' | 'monitoring';
    frequency?: string;
  };
  
  sla?: {
    metric: string;
    target: number;
    breachThreshold: number;
    measurementWindow: string;
  };
  
  dependency?: {
    upstreamTables: string[];
    downstreamTables: string[];
    checkType: 'availability' | 'freshness' | 'quality';
  };
  
  schedule?: {
    cron?: string;
    timezone?: string;
    businessHours?: boolean;
    holidays?: string[];
  };
  
  composite?: {
    operator: 'AND' | 'OR' | 'NOT';
    conditions: RuleCondition[];
  };
}

export interface RuleAction {
  type: ActionType;
  
  // Basic actions
  message?: string;
  code?: string;
  
  // Advanced actions for data professionals
  alert?: {
    channels: string[]; // 'email', 'slack', 'pagerduty', 'webhook'
    recipients: string[];
    template?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
  
  escalation?: {
    levels: Array<{
      level: number;
      timeout: string;
      recipients: string[];
      actions: string[];
    }>;
    maxLevel: number;
  };
  
  retry?: {
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    initialDelay: string;
    maxDelay: string;
  };
  
  fallback?: {
    strategy: 'default_value' | 'previous_value' | 'alternative_source' | 'degraded_mode';
    value?: unknown;
    source?: string;
  };
  
  rollback?: {
    checkpoint: string;
    strategy: 'full' | 'partial' | 'compensating';
    compensationLogic?: string;
  };
  
  throttle?: {
    rateLimit: number;
    burstLimit: number;
    timeWindow: string;
    strategy: 'drop' | 'queue' | 'delay';
  };
  
  cache?: {
    ttl: string;
    strategy: 'write_through' | 'write_behind' | 'refresh_ahead';
    invalidation: 'time_based' | 'event_based' | 'manual';
  };
  
  optimize?: {
    strategy: 'partitioning' | 'indexing' | 'compression' | 'caching';
    parameters: Record<string, unknown>;
  };
  
  profiling?: {
    metrics: string[];
    sampleSize?: number;
    frequency: string;
    output: 'log' | 'metric' | 'alert' | 'dashboard';
  };
  
  validation?: {
    checks: string[];
    severity: 'warning' | 'error' | 'block';
    autoFix?: boolean;
    notification?: boolean;
  };
  
  cleansing?: {
    operations: Array<{
      type: 'trim' | 'normalize' | 'format' | 'validate' | 'transform';
      parameters: Record<string, unknown>;
    }>;
    output: 'replace' | 'append' | 'log';
  };
  
  enrichment?: {
    sources: string[];
    fields: string[];
    strategy: 'lookup' | 'api' | 'ml_model';
    fallback?: unknown;
  };
  
  aggregation?: {
    function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'custom';
    groupBy?: string[];
    having?: string;
    output: 'table' | 'view' | 'materialized_view';
  };
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

// Rule templates for data professionals
export const DATA_PROFESSIONAL_RULE_TEMPLATES = {
  // Data Quality Rules
  dataQuality: {
    completeness: {
      name: 'Data Completeness Check',
      description: 'Ensure required fields are not null or empty',
      type: RuleType.DATA_QUALITY,
      severity: RuleSeverity.DATA_QUALITY_ISSUE,
      condition: {
        type: ConditionType.DATA_QUALITY,
        dataQuality: {
          metric: 'completeness',
          operator: 'lt',
          threshold: 0.95
        }
      },
      action: {
        type: ActionType.ALERT,
        alert: {
          channels: ['email', 'slack'],
          recipients: ['data-team'],
          priority: 'medium'
        }
      }
    },
    
    accuracy: {
      name: 'Data Accuracy Validation',
      description: 'Validate data against business rules and constraints',
      type: RuleType.DATA_QUALITY,
      severity: RuleSeverity.DATA_QUALITY_ISSUE,
      condition: {
        type: ConditionType.DATA_QUALITY,
        dataQuality: {
          metric: 'accuracy',
          operator: 'lt',
          threshold: 0.98
        }
      },
      action: {
        type: ActionType.VALIDATION,
        validation: {
          checks: ['business_rules', 'constraints', 'format'],
          severity: 'error',
          autoFix: false,
          notification: true
        }
      }
    }
  },
  
  // Performance Rules
  performance: {
    queryOptimization: {
      name: 'Query Performance Monitor',
      description: 'Alert on slow queries that exceed performance thresholds',
      type: RuleType.PERFORMANCE_OPTIMIZATION,
      severity: RuleSeverity.PERFORMANCE_IMPACT,
      condition: {
        type: ConditionType.PERFORMANCE_METRIC,
        performance: {
          metric: 'queryTime',
          operator: 'gt',
          threshold: 5000, // 5 seconds
          timeWindow: '1h'
        }
      },
      action: {
        type: ActionType.OPTIMIZE,
        optimize: {
          strategy: 'indexing',
          parameters: { autoIndex: true, analyzePlan: true }
        }
      }
    },
    
    costOptimization: {
      name: 'Cost Threshold Monitor',
      description: 'Alert when query costs exceed budget thresholds',
      type: RuleType.COST_OPTIMIZATION,
      severity: RuleSeverity.COST_ALERT,
      condition: {
        type: ConditionType.COST_THRESHOLD,
        performance: {
          metric: 'costPerQuery',
          operator: 'gt',
          threshold: 0.10, // $0.10 per query
          timeWindow: '24h'
        }
      },
      action: {
        type: ActionType.THROTTLE,
        throttle: {
          rateLimit: 10,
          burstLimit: 5,
          timeWindow: '1h',
          strategy: 'queue'
        }
      }
    }
  },
  
  // Compliance Rules
  compliance: {
    gdpr: {
      name: 'GDPR Data Protection',
      description: 'Ensure PII data is handled according to GDPR requirements',
      type: RuleType.COMPLIANCE_CHECK,
      severity: RuleSeverity.COMPLIANCE_VIOLATION,
      condition: {
        type: ConditionType.COMPLIANCE_CHECK,
        compliance: {
          regulation: 'GDPR',
          standard: 'EU-2016/679',
          checkType: 'monitoring',
          frequency: '24h'
        }
      },
      action: {
        type: ActionType.ESCALATE,
        escalation: {
          levels: [
            {
              level: 1,
              timeout: '1h',
              recipients: ['data-privacy-team'],
              actions: ['investigate', 'notify']
            },
            {
              level: 2,
              timeout: '4h',
              recipients: ['legal-team', 'management'],
              actions: ['audit', 'remediate']
            }
          ],
          maxLevel: 2
        }
      }
    },
    
    sox: {
      name: 'SOX Financial Compliance',
      description: 'Ensure financial data meets SOX compliance requirements',
      type: RuleType.COMPLIANCE_CHECK,
      severity: RuleSeverity.COMPLIANCE_VIOLATION,
      condition: {
        type: ConditionType.COMPLIANCE_CHECK,
        compliance: {
          regulation: 'SOX',
          standard: 'Sarbanes-Oxley',
          checkType: 'audit',
          frequency: '7d'
        }
      },
      action: {
        type: ActionType.VALIDATION,
        validation: {
          checks: ['audit_trail', 'data_integrity', 'access_control'],
          severity: 'error',
          autoFix: false,
          notification: true
        }
      }
    }
  },
  
  // SLA Rules
  sla: {
    dataFreshness: {
      name: 'Data Freshness SLA',
      description: 'Monitor data freshness against defined SLAs',
      type: RuleType.SLA_MONITORING,
      severity: RuleSeverity.SLA_BREACH,
      condition: {
        type: ConditionType.SLA_METRIC,
        sla: {
          metric: 'data_freshness',
          target: 3600, // 1 hour
          breachThreshold: 7200, // 2 hours
          measurementWindow: '15m'
        }
      },
      action: {
        type: ActionType.ALERT,
        alert: {
          channels: ['pagerduty', 'slack'],
          recipients: ['oncall-team'],
          priority: 'high'
        }
      }
    },
    
    availability: {
      name: 'Data Availability SLA',
      description: 'Ensure data sources meet availability requirements',
      type: RuleType.SLA_MONITORING,
      severity: RuleSeverity.SLA_BREACH,
      condition: {
        type: ConditionType.SLA_METRIC,
        sla: {
          metric: 'availability',
          target: 0.999, // 99.9%
          breachThreshold: 0.99, // 99%
          measurementWindow: '1h'
        }
      },
      action: {
        type: ActionType.FALLBACK,
        fallback: {
          strategy: 'alternative_source',
          source: 'backup_database'
        }
      }
    }
  },
  
  // Anomaly Detection
  anomaly: {
    statistical: {
      name: 'Statistical Anomaly Detection',
      description: 'Detect anomalies using statistical methods',
      type: RuleType.ANOMALY_DETECTION,
      severity: RuleSeverity.ANOMALY,
      condition: {
        type: ConditionType.ANOMALY_DETECTION,
        anomaly: {
          method: 'statistical',
          sensitivity: 'medium',
          baseline: 1000,
          deviation: 3.0 // 3 standard deviations
        }
      },
      action: {
        type: ActionType.ALERT,
        alert: {
          channels: ['slack', 'email'],
          recipients: ['data-science-team'],
          priority: 'medium'
        }
      }
    },
    
    ml: {
      name: 'ML-Based Anomaly Detection',
      description: 'Detect anomalies using machine learning models',
      type: RuleType.ANOMALY_DETECTION,
      severity: RuleSeverity.ANOMALY,
      condition: {
        type: ConditionType.ANOMALY_DETECTION,
        anomaly: {
          method: 'ml',
          sensitivity: 'high',
          baseline: 0.8,
          deviation: 0.2
        }
      },
      action: {
        type: ActionType.PROFILING,
        profiling: {
          metrics: ['anomaly_score', 'confidence', 'features'],
          sampleSize: 1000,
          frequency: '1h',
          output: 'dashboard'
        }
      }
    }
  }
};

// Export the templates
export type DataProfessionalRuleTemplate = typeof DATA_PROFESSIONAL_RULE_TEMPLATES;
