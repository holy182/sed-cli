import { logger } from '../utils/logger';

export interface BusinessLogicRule {
  id: string;
  name: string;
  description: string;
  type: BusinessRuleType;
  condition: string;
  action: string;
  priority: number;
  confidence: number;
  businessDomain: string;
  metadata?: Record<string, any>;
}

export enum BusinessRuleType {
  CALCULATION = 'calculation',
  VALIDATION = 'validation',
  RELATIONSHIP = 'relationship',
  WORKFLOW = 'workflow',
  COMPLIANCE = 'compliance',
  BUSINESS_METRIC = 'business_metric'
}

export interface BusinessLogicAnalysis {
  rules: BusinessLogicRule[];
  relationships: BusinessRelationship[];
  metrics: BusinessMetric[];
  workflows: BusinessWorkflow[];
  confidence: number;
  domain: string;
}

export interface BusinessRelationship {
  fromEntity: string;
  toEntity: string;
  type: RelationshipType;
  cardinality: string;
  businessPurpose: string;
  constraints: string[];
}

export enum RelationshipType {
  ONE_TO_ONE = 'one_to_one',
  ONE_TO_MANY = 'one_to_many',
  MANY_TO_MANY = 'many_to_many',
  INHERITANCE = 'inheritance',
  COMPOSITION = 'composition'
}

export interface BusinessMetric {
  name: string;
  description: string;
  formula: string;
  unit: string;
  category: string;
  calculationType: string;
}

export interface BusinessWorkflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: string[];
  outcomes: string[];
}

export interface WorkflowStep {
  name: string;
  description: string;
  entity: string;
  action: string;
  conditions: string[];
}

export class BusinessLogicAnalyzer {
  private domainPatterns: Map<string, any>;
  private ruleTemplates: Map<string, any>;

  constructor() {
    this.domainPatterns = new Map();
    this.ruleTemplates = new Map();
    this.initializePatterns();
  }

  /**
   * Analyze business logic from database schema and data
   */
  async analyzeBusinessLogic(schema: any, sampleData?: Record<string, any[]>): Promise<BusinessLogicAnalysis> {
    const analysis: BusinessLogicAnalysis = {
      rules: [],
      relationships: [],
      metrics: [],
      workflows: [],
      confidence: 0,
      domain: 'general'
    };

    try {
      // Detect business domain
      analysis.domain = this.detectBusinessDomain(schema);
      
      // Analyze relationships
      try {
        analysis.relationships = this.analyzeRelationships(schema);
      } catch (error) {
        analysis.relationships = [];
      }
      
      // Analyze business metrics
      analysis.metrics = this.analyzeBusinessMetrics(schema, sampleData);
      
      // Generate business rules
      analysis.rules = this.generateBusinessRules(schema, analysis);
      
      // Analyze workflows
      analysis.workflows = this.analyzeWorkflows(schema, analysis);
      
      // Calculate overall confidence
      analysis.confidence = this.calculateConfidence(analysis);
      
      return analysis;
    } catch (error) {
      logger.error(`Business logic analysis failed: ${error}`);
      return analysis;
    }
  }

  /**
   * Detect business domain from schema
   */
  private detectBusinessDomain(schema: any): string {
    const tableNames = schema.tables?.map((t: any) => t.name.toLowerCase()) || [];
    const columnNames = schema.tables?.flatMap((t: any) => 
      t.columns?.map((c: any) => c.name.toLowerCase()) || []
    ) || [];

    const domainScores: Record<string, number> = {
      ecommerce: 0,
      saas: 0,
      fintech: 0,
      healthcare: 0,
      logistics: 0,
      fleet: 0
    };

    // E-commerce patterns
    if (tableNames.some((name: string) => name.includes('order') || name.includes('product'))) domainScores.ecommerce += 2;
    if (columnNames.some((name: string) => name.includes('price') || name.includes('quantity'))) domainScores.ecommerce += 1;

    // SaaS patterns
    if (tableNames.some((name: string) => name.includes('user') || name.includes('subscription'))) domainScores.saas += 2;
    if (columnNames.some((name: string) => name.includes('mrr') || name.includes('churn'))) domainScores.saas += 1;

    // Fintech patterns
    if (tableNames.some((name: string) => name.includes('transaction') || name.includes('account'))) domainScores.fintech += 2;
    if (columnNames.some((name: string) => name.includes('balance') || name.includes('amount'))) domainScores.fintech += 1;

    // Healthcare patterns
    if (tableNames.some((name: string) => name.includes('patient') || name.includes('appointment'))) domainScores.healthcare += 2;
    if (columnNames.some((name: string) => name.includes('diagnosis') || name.includes('prescription'))) domainScores.healthcare += 1;

    // Logistics patterns
    if (tableNames.some((name: string) => name.includes('shipment') || name.includes('warehouse'))) domainScores.logistics += 2;
    if (columnNames.some((name: string) => name.includes('tracking') || name.includes('delivery'))) domainScores.logistics += 1;

    // Fleet patterns
    if (tableNames.some((name: string) => name.includes('vehicle') || name.includes('driver'))) domainScores.fleet += 2;
    if (columnNames.some((name: string) => name.includes('mileage') || name.includes('fuel'))) domainScores.fleet += 1;

    const maxScore = Math.max(...Object.values(domainScores));
    const detectedDomain = Object.keys(domainScores).find((domain: string) => domainScores[domain] === maxScore);
    
    return detectedDomain || 'general';
  }

  /**
   * Analyze business relationships
   */
  private analyzeRelationships(schema: any): BusinessRelationship[] {
    try {
      const relationships: BusinessRelationship[] = [];
      
      for (const table of schema.tables || []) {
        for (const column of table.columns || []) {
          // Check for explicit foreign key relationships
          if (column.isForeignKey && column.foreignKeyInfo) {
            const relationship = this.createRelationship(table, column, schema);
            if (relationship) {
              relationships.push(relationship);
            }
          }
          // Also check for implicit relationships based on naming patterns
          else if (column.name.toLowerCase().endsWith('_id') && !column.isPrimaryKey) {
            // Try to infer the referenced table from the column name
            const referencedTable = column.name.toLowerCase().replace(/_id$/, '');
            if (referencedTable && schema.tables.some((t: any) => t.name.toLowerCase() === referencedTable)) {
              const relationship = this.createImplicitRelationship(table, column, referencedTable, schema);
              if (relationship) {
                relationships.push(relationship);
              }
            }
          }
        }
      }

      // Also detect many-to-many relationships through junction tables
      this.detectManyToManyRelationships(schema, relationships);

      return relationships;
    } catch (error) {
      console.error('Error in analyzeRelationships:', error);
      return [];
    }
  }

  /**
   * Detect many-to-many relationships through junction tables
   */
  private detectManyToManyRelationships(schema: any, relationships: BusinessRelationship[]): void {
    const tables = schema.tables || [];
    
    for (const table of tables) {
      // Check if this looks like a junction table (has multiple foreign keys)
      const foreignKeyColumns = table.columns?.filter((c: any) => 
        c.isForeignKey || (c.name.toLowerCase().endsWith('_id') && !c.isPrimaryKey)
      ) || [];
      
      if (foreignKeyColumns.length >= 2) {
        // This is likely a junction table, create many-to-many relationships
        for (let i = 0; i < foreignKeyColumns.length; i++) {
          for (let j = i + 1; j < foreignKeyColumns.length; j++) {
            const col1 = foreignKeyColumns[i];
            const col2 = foreignKeyColumns[j];
            
            let table1Name = '';
            let table2Name = '';
            
            if (col1.isForeignKey && col1.foreignKeyInfo) {
              table1Name = col1.foreignKeyInfo.referencedTable;
            } else if (col1.name.toLowerCase().endsWith('_id')) {
              table1Name = col1.name.toLowerCase().replace(/_id$/, '');
            }
            
            if (col2.isForeignKey && col2.foreignKeyInfo) {
              table2Name = col2.foreignKeyInfo.referencedTable;
            } else if (col2.name.toLowerCase().endsWith('_id')) {
              table2Name = col2.name.toLowerCase().replace(/_id$/, '');
            }
            
            if (table1Name && table2Name && 
                schema.tables.some((t: any) => t.name.toLowerCase() === table1Name) &&
                schema.tables.some((t: any) => t.name.toLowerCase() === table2Name)) {
              
              // Create bidirectional many-to-many relationship
              relationships.push({
                fromEntity: table1Name,
                toEntity: table2Name,
                type: RelationshipType.MANY_TO_MANY,
                cardinality: 'M:N',
                businessPurpose: `Junction table ${table.name} manages ${table1Name} to ${table2Name} relationships`,
                constraints: []
              });
            }
          }
        }
      }
    }
  }

  /**
   * Create business relationship from foreign key
   */
  private createRelationship(table: any, column: any, schema: any): BusinessRelationship | null {
    const targetTable = column.foreignKeyInfo.referencedTable;
    const relationshipType = this.determineRelationshipType(table, column, schema);
    const businessPurpose = this.determineBusinessPurpose(table.name, targetTable, column.name);

    return {
      fromEntity: table.name,
      toEntity: targetTable,
      type: relationshipType,
      cardinality: this.determineCardinality(table, column),
      businessPurpose,
      constraints: this.generateConstraints(table, column)
    };
  }

  /**
   * Create business relationship from implicit foreign key pattern
   */
  private createImplicitRelationship(table: any, column: any, referencedTable: string, schema: any): BusinessRelationship | null {
    const relationshipType = this.determineRelationshipType(table, column, schema);
    const businessPurpose = this.determineBusinessPurpose(table.name, referencedTable, column.name);

    return {
      fromEntity: table.name,
      toEntity: referencedTable,
      type: relationshipType,
      cardinality: this.determineCardinality(table, column),
      businessPurpose,
      constraints: this.generateConstraints(table, column)
    };
  }

  /**
   * Analyze business metrics
   */
  private analyzeBusinessMetrics(schema: any, sampleData?: Record<string, any[]>): BusinessMetric[] {
    const metrics: BusinessMetric[] = [];
    const domain = this.detectBusinessDomain(schema);

    // Domain-specific metrics
    const domainMetrics = this.getDomainMetrics(domain);
    metrics.push(...domainMetrics);

    // Schema-based metrics
    const schemaMetrics = this.generateSchemaMetrics(schema);
    metrics.push(...schemaMetrics);

    return metrics;
  }

  /**
   * Generate business rules
   */
  private generateBusinessRules(schema: any, analysis: BusinessLogicAnalysis): BusinessLogicRule[] {
    const rules: BusinessLogicRule[] = [];

    // Generate validation rules
    const validationRules = this.generateValidationRules(schema);
    rules.push(...validationRules);

    // Generate calculation rules
    const calculationRules = this.generateCalculationRules(schema, analysis.metrics);
    rules.push(...calculationRules);

    // Generate relationship rules
    const relationshipRules = this.generateRelationshipRules(analysis.relationships);
    rules.push(...relationshipRules);

    return rules;
  }

  /**
   * Analyze business workflows
   */
  private analyzeWorkflows(schema: any, analysis: BusinessLogicAnalysis): BusinessWorkflow[] {
    const workflows: BusinessWorkflow[] = [];

    // Generate workflows based on relationships and business logic
    const entityWorkflows = this.generateEntityWorkflows(schema, analysis.relationships);
    workflows.push(...entityWorkflows);

    return workflows;
  }

  /**
   * Initialize domain patterns and rule templates
   */
  private initializePatterns(): void {
    // Domain-specific patterns
    this.domainPatterns.set('ecommerce', {
      entities: ['products', 'orders', 'customers', 'categories'],
      metrics: ['revenue', 'conversion_rate', 'average_order_value'],
      rules: ['inventory_validation', 'price_validation', 'order_workflow']
    });

    this.domainPatterns.set('saas', {
      entities: ['users', 'subscriptions', 'features', 'billing'],
      metrics: ['mrr', 'churn_rate', 'activation_rate'],
      rules: ['subscription_validation', 'feature_access', 'billing_workflow']
    });

    // Rule templates
    this.ruleTemplates.set('validation', {
      pattern: 'validate_{entity}_{field}',
      condition: '{entity}.{field} IS NOT NULL AND {entity}.{field} != \'\'',
      action: 'RAISE EXCEPTION \'Invalid {field}\'',
      priority: 100
    });

    this.ruleTemplates.set('calculation', {
      pattern: 'calculate_{metric}',
      condition: 'SELECT {formula}',
      action: 'UPDATE {table} SET {metric} = {formula}',
      priority: 200
    });
  }

  /**
   * Determine relationship type
   */
  private determineRelationshipType(table: any, column: any, schema: any): RelationshipType {
    // Analyze foreign key constraints to determine relationship type
    if (column.isUnique) {
      return RelationshipType.ONE_TO_ONE;
    }
    
    // Check if target table has a foreign key back to this table
    const targetTableName = column.foreignKeyInfo?.referencedTable;
    if (!targetTableName) {
      return RelationshipType.ONE_TO_MANY;
    }
    
    // Look for the target table in the schema
    const targetTable = schema.tables?.find((t: any) => t.name === targetTableName) ||
                       schema.tables?.find((t: any) => t.name.toLowerCase() === targetTableName.toLowerCase());
    
    if (targetTable) {
      // Check if target table has a foreign key back to this table
      const hasReverseFK = targetTable.columns?.some((c: any) => 
        c.isForeignKey && c.foreignKeyInfo?.referencedTable === table.name
      );
      
      if (hasReverseFK) {
        return RelationshipType.ONE_TO_ONE;
      }
    }

    return RelationshipType.ONE_TO_MANY;
  }

  /**
   * Determine business purpose
   */
  private determineBusinessPurpose(fromTable: string, toTable: string, column: string): string {
    const purposes: Record<string, string> = {
      'user_id': 'User ownership and access control',
      'customer_id': 'Customer relationship management',
      'order_id': 'Order tracking and fulfillment',
      'product_id': 'Product catalog and inventory',
      'category_id': 'Classification and organization',
      'payment_id': 'Financial transaction tracking',
      'address_id': 'Location and delivery management'
    };

    return purposes[column] || `Links ${fromTable} to ${toTable} for business process management`;
  }

  /**
   * Determine cardinality
   */
  private determineCardinality(table: any, column: any): string {
    if (column.isUnique) {
      return '1:1';
    }
    return '1:N';
  }

  /**
   * Generate constraints
   */
  private generateConstraints(table: any, column: any): string[] {
    const constraints: string[] = [];

    if (!column.isNullable) {
      constraints.push('NOT NULL');
    }

    if (column.isUnique) {
      constraints.push('UNIQUE');
    }

    if (column.defaultValue) {
      constraints.push(`DEFAULT ${column.defaultValue}`);
    }

    return constraints;
  }

  /**
   * Get domain-specific metrics
   */
  private getDomainMetrics(domain: string): BusinessMetric[] {
    const domainMetrics: Record<string, BusinessMetric[]> = {
      ecommerce: [
        {
          name: 'total_revenue',
          description: 'Total revenue from all orders',
          formula: 'SUM(orders.total_amount)',
          unit: 'USD',
          category: 'financial',
          calculationType: 'aggregation'
        },
        {
          name: 'conversion_rate',
          description: 'Percentage of visitors who make a purchase',
          formula: 'COUNT(orders.id) / COUNT(visitors.id) * 100',
          unit: 'percentage',
          category: 'performance',
          calculationType: 'ratio'
        }
      ],
      saas: [
        {
          name: 'monthly_recurring_revenue',
          description: 'Monthly recurring revenue from subscriptions',
          formula: 'SUM(subscriptions.monthly_amount)',
          unit: 'USD',
          category: 'financial',
          calculationType: 'aggregation'
        },
        {
          name: 'churn_rate',
          description: 'Percentage of customers who cancel subscriptions',
          formula: 'COUNT(cancelled_subscriptions.id) / COUNT(active_subscriptions.id) * 100',
          unit: 'percentage',
          category: 'retention',
          calculationType: 'ratio'
        }
      ]
    };

    return domainMetrics[domain] || [];
  }

  /**
   * Generate schema-based metrics
   */
  private generateSchemaMetrics(schema: any): BusinessMetric[] {
    const metrics: BusinessMetric[] = [];

    // Count-based metrics
    for (const table of schema.tables || []) {
      metrics.push({
        name: `${table.name}_count`,
        description: `Total number of ${table.name}`,
        formula: `COUNT(${table.name}.id)`,
        unit: 'count',
        category: 'operational',
        calculationType: 'count'
      });
    }

    return metrics;
  }

  /**
   * Generate validation rules
   */
  private generateValidationRules(schema: any): BusinessLogicRule[] {
    const rules: BusinessLogicRule[] = [];

    for (const table of schema.tables || []) {
      for (const column of table.columns || []) {
        // Check if column is required (not nullable or is primary key)
        if (column.isNullable === false || column.nullable === false || column.isPrimaryKey) {
          rules.push({
            id: `validation_${table.name}_${column.name}`,
            name: `${column.name} Required`,
            description: `${column.name} is required in ${table.name}`,
            type: BusinessRuleType.VALIDATION,
            condition: `${table.name}.${column.name} IS NOT NULL AND ${table.name}.${column.name} IS REQUIRED`,
            action: 'RAISE EXCEPTION',
            priority: 100,
            confidence: 0.9,
            businessDomain: this.detectBusinessDomain(schema)
          });
        }
      }
    }

    return rules;
  }

  /**
   * Generate calculation rules
   */
  private generateCalculationRules(schema: any, metrics: BusinessMetric[]): BusinessLogicRule[] {
    const rules: BusinessLogicRule[] = [];

    // Generate rules for computed fields in schema
    for (const table of schema.tables || []) {
      for (const column of table.columns || []) {
        if (column.isComputed && column.computedFormula) {
          rules.push({
            id: `calculation_${table.name}_${column.name}`,
            name: `Calculate ${column.name} in ${table.name}`,
            description: `${column.name} is computed as ${column.computedFormula}`,
            type: BusinessRuleType.CALCULATION,
            condition: 'ON INSERT OR UPDATE',
            action: `${table.name}.${column.name} = ${column.computedFormula}`,
            priority: 200,
            confidence: 0.9,
            businessDomain: this.detectBusinessDomain(schema)
          });
        }
        // Also generate calculation rules for fields that look like they should be computed
        else if (column.name.toLowerCase().includes('total') || column.name.toLowerCase().includes('sum') || column.name.toLowerCase().includes('count')) {
          rules.push({
            id: `calculation_${table.name}_${column.name}`,
            name: `Calculate ${column.name} in ${table.name}`,
            description: `${column.name} appears to be a calculated field`,
            type: BusinessRuleType.CALCULATION,
            condition: 'ON INSERT OR UPDATE',
            action: `${table.name}.${column.name} = CALCULATE_BASED_ON_BUSINESS_LOGIC`,
            priority: 200,
            confidence: 0.7,
            businessDomain: this.detectBusinessDomain(schema)
          });
        }
      }
    }

    // Generate rules for business metrics
    for (const metric of metrics) {
      rules.push({
        id: `calculation_${metric.name}`,
        name: `Calculate ${metric.name}`,
        description: metric.description,
        type: BusinessRuleType.CALCULATION,
        condition: 'ON INSERT OR UPDATE',
        action: metric.formula,
        priority: 200,
        confidence: 0.8,
        businessDomain: 'general',
        metadata: {
          unit: metric.unit,
          category: metric.category,
          calculationType: metric.calculationType
        }
      });
    }

    return rules;
  }

  /**
   * Generate relationship rules
   */
  private generateRelationshipRules(relationships: BusinessRelationship[]): BusinessLogicRule[] {
    const rules: BusinessLogicRule[] = [];

    for (const relationship of relationships) {
      rules.push({
        id: `relationship_${relationship.fromEntity}_${relationship.toEntity}`,
        name: `${relationship.fromEntity} to ${relationship.toEntity} Relationship`,
        description: relationship.businessPurpose,
        type: BusinessRuleType.RELATIONSHIP,
        condition: `${relationship.fromEntity}.id IS NOT NULL`,
        action: `ENSURE ${relationship.toEntity}.id EXISTS`,
        priority: 150,
        confidence: 0.9,
        businessDomain: 'general',
        metadata: {
          relationshipType: relationship.type,
          cardinality: relationship.cardinality,
          constraints: relationship.constraints
        }
      });
    }

    return rules;
  }

  /**
   * Generate entity workflows
   */
  private generateEntityWorkflows(schema: any, relationships: BusinessRelationship[]): BusinessWorkflow[] {
    const workflows: BusinessWorkflow[] = [];

    // Generate workflows based on common business patterns
    for (const table of schema.tables || []) {
      const workflow = this.createEntityWorkflow(table, relationships);
      if (workflow) {
        workflows.push(workflow);
      }
    }

    return workflows;
  }

    /**
   * Create entity workflow
   */
  private createEntityWorkflow(table: any, relationships: BusinessRelationship[]): BusinessWorkflow | null {
    const tableName = table.name.toLowerCase();
    
    // Common workflow patterns
    if (tableName.includes('order')) {
      return {
        name: 'Order Processing Workflow',
        description: 'Complete order processing workflow',
        steps: [
          {
            name: 'Order Creation',
            description: 'Create new order',
            entity: table.name,
            action: 'INSERT',
            conditions: ['customer_id IS NOT NULL', 'total_amount > 0']
          },
          {
            name: 'Payment Processing',
            description: 'Process payment for order',
            entity: 'payments',
            action: 'CREATE',
            conditions: ['order_id IS NOT NULL', 'payment_amount > 0']
          },
          {
            name: 'Inventory Update',
            description: 'Update inventory levels',
            entity: 'inventory',
            action: 'UPDATE',
            conditions: ['product_id IS NOT NULL', 'quantity_available >= order_quantity']
          }
        ],
        triggers: ['order_created', 'payment_received'],
        outcomes: ['order_fulfilled', 'order_cancelled']
      };
    }
    
    if (tableName.includes('user')) {
      return {
        name: 'User Registration Workflow',
        description: 'Complete user registration workflow',
        steps: [
          {
            name: 'User Creation',
            description: 'Create new user account',
            entity: table.name,
            action: 'INSERT',
            conditions: ['email IS NOT NULL', 'name IS NOT NULL']
          },
          {
            name: 'Email Verification',
            description: 'Send verification email',
            entity: 'verifications',
            action: 'CREATE',
            conditions: ['user_id IS NOT NULL', 'email IS NOT NULL']
          },
          {
            name: 'Profile Setup',
            description: 'Complete user profile',
            entity: table.name,
            action: 'UPDATE',
            conditions: ['id IS NOT NULL', 'email_verified = true']
          }
        ],
        triggers: ['user_registered', 'email_verified'],
        outcomes: ['user_activated', 'user_pending']
      };
    }
    
    return null;
  }

  /**
   * Calculate analysis confidence
   */
  private calculateConfidence(analysis: BusinessLogicAnalysis): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence based on detected patterns
    if (analysis.rules.length > 0) confidence += 0.2;
    if (analysis.relationships.length > 0) confidence += 0.15;
    if (analysis.metrics.length > 0) confidence += 0.1;
    if (analysis.workflows.length > 0) confidence += 0.05;

    // Domain-specific confidence boost
    if (analysis.domain !== 'general') confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}
