import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

interface BusinessRule {
  pattern: string[];
  formula?: string;
  condition?: string;
  description: string;
  business_purpose: string;
  examples?: string[];
}

interface CalculationPattern {
  [key: string]: BusinessRule;
}

interface BusinessRules {
  calculation_patterns: {
    financial: CalculationPattern;
    inventory: CalculationPattern;
    analytics: CalculationPattern;
    operational: CalculationPattern;
    fleet_management?: CalculationPattern; // Added fleet_management
  };
  status_patterns: {
    user_activity: CalculationPattern;
    order_status: CalculationPattern;
    system_status: CalculationPattern;
    business_flags?: CalculationPattern;
    audit_trail?: CalculationPattern;
    fleet_status?: CalculationPattern; // Added fleet_status
  };
  relationship_patterns: {
    foreign_keys: { [key: string]: any };
    calculated_fields: { [key: string]: any };
  };
  business_domains: { [key: string]: any };
  entity_relationships?: { [key: string]: any };
}

export class BusinessLogicDetector {
  private businessRules!: BusinessRules;
  private detectedPatterns: Map<string, any> = new Map();

  constructor() {
    this.loadBusinessRules();
  }

  private loadBusinessRules(): void {
    try {
      const rulesPath = path.join(__dirname, 'business-rules.json');
      const rulesData = fs.readFileSync(rulesPath, 'utf8');
      this.businessRules = JSON.parse(rulesData);
    } catch (error) {
      logger.businessRulesFallback();
      this.businessRules = this.getFallbackRules();
    }
  }

  private getFallbackRules(): BusinessRules {
    return {
      calculation_patterns: {
        financial: {
          total_price: {
            pattern: ['unit_price', 'quantity'],
            formula: 'unit_price * quantity',
            description: 'Total cost calculation',
            business_purpose: 'Revenue calculation',
            examples: ['order_items.total_price = unit_price * quantity']
          },
          total_amount: {
            pattern: ['total_amount'],
            formula: 'SUM(total_amount)',
            description: 'Total amount calculation',
            business_purpose: 'Revenue calculation',
            examples: ['orders.total_amount = SUM(total_amount)']
          }
        },
        inventory: {
          stock_level: {
            pattern: ['initial_stock', 'sold_quantity'],
            formula: 'initial_stock - sold_quantity',
            description: 'Current stock level calculation',
            business_purpose: 'Inventory management',
            examples: ['products.stock_level = initial_stock - sold_quantity']
          }
        },
        analytics: {
          performance_metrics: {
            pattern: ['total_amount', 'order_date'],
            formula: 'AVG(total_amount)',
            description: 'Performance analytics calculation',
            business_purpose: 'Business performance analysis',
            examples: ['orders.avg_order_value = AVG(total_amount)']
          }
        },
        operational: {
          efficiency_metrics: {
            pattern: ['shipped_date', 'order_date'],
            formula: 'shipped_date - order_date',
            description: 'Operational efficiency calculation',
            business_purpose: 'Operational performance',
            examples: ['orders.processing_time = shipped_date - order_date']
          },
          order_processing: {
            pattern: ['order_date', 'shipped_date', 'delivered_date'],
            formula: 'delivered_date - order_date',
            description: 'Order processing time calculation',
            business_purpose: 'Order fulfillment efficiency',
            examples: ['orders.total_processing_time = delivered_date - order_date']
          }
        },
        fleet_management: {
          maintenance_schedule: {
            pattern: ['mileage', 'last_maintenance'],
            formula: 'mileage - last_maintenance_mileage',
            description: 'Maintenance schedule calculation',
            business_purpose: 'Fleet maintenance planning',
            examples: ['vehicles.miles_since_maintenance = mileage - last_maintenance_mileage']
          }
        }
      },
      status_patterns: {
        user_activity: {
          user_status: {
            pattern: ['last_login', 'account_created'],
            condition: 'last_login > account_created',
            description: 'User activity status tracking',
            business_purpose: 'User engagement monitoring',
            examples: ['users.active = last_login > account_created']
          }
        },
        order_status: {
          order_progress: {
            pattern: ['order_date', 'shipped_date', 'delivered_date', 'status'],
            condition: 'status IN ("pending", "shipped", "delivered")',
            description: 'Order progress status tracking',
            business_purpose: 'Order fulfillment monitoring',
            examples: ['orders.progress = CASE status WHEN "pending" THEN "processing" WHEN "shipped" THEN "in_transit" WHEN "delivered" THEN "completed" END']
          }
        },
        system_status: {
          system_health: {
            pattern: ['status', 'last_updated'],
            condition: 'status = "active"',
            description: 'System health status monitoring',
            business_purpose: 'System reliability tracking',
            examples: ['system.status = "active"']
          },
          order_status_tracking: {
            pattern: ['status', 'order_date'],
            condition: 'status IN ("pending", "shipped", "delivered")',
            description: 'Order status tracking',
            business_purpose: 'Order fulfillment monitoring',
            examples: ['orders.status_tracking = status']
          }
        },
        business_flags: {
          business_indicators: {
            pattern: ['flag', 'enabled'],
            condition: 'enabled = true',
            description: 'Business flag indicators',
            business_purpose: 'Business rule enforcement',
            examples: ['business_flags.active = enabled = true']
          },
          order_flags: {
            pattern: ['status', 'order_date'],
            condition: 'status IS NOT NULL',
            description: 'Order status flags',
            business_purpose: 'Order management',
            examples: ['orders.has_status = status IS NOT NULL']
          }
        },
        audit_trail: {
          change_tracking: {
            pattern: ['created_at', 'updated_at', 'modified_by'],
            condition: 'updated_at > created_at',
            description: 'Audit trail change tracking',
            business_purpose: 'Compliance and tracking',
            examples: ['audit_log.changes = updated_at > created_at']
          },
          order_tracking: {
            pattern: ['order_date', 'shipped_date', 'delivered_date'],
            condition: 'delivered_date > order_date',
            description: 'Order delivery tracking',
            business_purpose: 'Order fulfillment audit',
            examples: ['orders.delivery_tracking = delivered_date > order_date']
          }
        },
        fleet_status: {
          vehicle_status: {
            pattern: ['status', 'last_maintenance'],
            condition: 'status = "operational"',
            description: 'Fleet vehicle status tracking',
            business_purpose: 'Fleet management',
            examples: ['vehicles.operational = status = "operational"']
          }
        }
      },
      relationship_patterns: {
        foreign_keys: {
          user_orders: {
            from_table: 'users',
            from_column: 'id',
            to_table: 'orders',
            to_column: 'user_id',
            relationship_type: 'one_to_many',
            description: 'User to orders relationship',
            business_purpose: 'Customer order tracking'
          },
          order_items: {
            from_table: 'orders',
            from_column: 'id',
            to_table: 'order_items',
            to_column: 'order_id',
            relationship_type: 'one_to_many',
            description: 'Order to items relationship',
            business_purpose: 'Order detail management'
          }
        },
        calculated_fields: {
          total_price: {
            table: 'order_items',
            field_name: 'total_price',
            formula: 'quantity * unit_price',
            description: 'Calculated total price field',
            business_purpose: 'Order value calculation',
            pattern: ['quantity', 'unit_price']
          }
        }
      },
      business_domains: {
        ecommerce: {
          key_entities: ['product', 'order', 'customer', 'cart', 'inventory'],
          key_metrics: ['price', 'quantity', 'total', 'sku', 'stock'],
          common_calculations: ['total_price', 'stock_level', 'order_value']
        },
        financial: {
          key_entities: ['account', 'transaction', 'payment', 'balance'],
          key_metrics: ['amount', 'balance', 'transaction_id', 'settlement'],
          common_calculations: ['total_amount', 'balance_calculation']
        },
        healthcare: {
          key_entities: ['patient', 'appointment', 'doctor', 'medical_record'],
          key_metrics: ['patient_id', 'appointment_date', 'diagnosis'],
          common_calculations: ['patient_statistics', 'appointment_metrics']
        }
      },
      entity_relationships: {
        ecommerce: {
          user: {
            order: 'one_to_many',
            profile: 'one_to_one'
          },
          order: {
            order_item: 'one_to_many',
            user: 'many_to_one'
          },
          product: {
            order_item: 'one_to_many',
            category: 'many_to_one'
          }
        },
        financial: {
          account: {
            transaction: 'one_to_many',
            balance: 'one_to_one'
          },
          transaction: {
            account: 'many_to_one',
            payment: 'one_to_one'
          }
        },
        healthcare: {
          patient: {
            appointment: 'one_to_many',
            medical_record: 'one_to_many'
          },
          doctor: {
            appointment: 'one_to_many',
            patient: 'many_to_many'
          }
        }
      }
    };
  }

  /**
   * Detect business logic patterns in a database schema
   */
  detectBusinessLogic(schema: any): BusinessLogicAnalysis {
    const analysis: BusinessLogicAnalysis = {
      detectedCalculations: [],
      detectedStatuses: [],
      detectedRelationships: [],
      businessDomain: this.detectBusinessDomain(schema),
      dataQualityIssues: [],
      confidence: 0
    };

    // Detect calculation patterns with enhanced matching
    this.detectCalculationPatterns(schema, analysis);
    
    // Detect status patterns with enhanced matching
    this.detectStatusPatterns(schema, analysis);
    
    // Detect relationship patterns with enhanced matching
    this.detectRelationshipPatterns(schema, analysis);
    
    // Detect entity relationships
    this.detectEntityRelationships(schema, analysis);
    
    // Detect business rules
    this.detectBusinessRules(schema, analysis);
    
    // Detect data quality issues
    this.detectDataQualityIssues(schema, analysis);
    
    // Calculate overall confidence with enhanced scoring
    analysis.confidence = this.calculateEnhancedConfidence(analysis);
    
    return analysis;
  }

  /**
   * Enhanced calculation pattern detection with better matching
   */
  private detectCalculationPatterns(schema: any, analysis: BusinessLogicAnalysis): void {
    const allTables = schema.tables || [];
    
    for (const table of allTables) {
      const tableColumns = table.columns || [];
      const columnNames = tableColumns.map((col: any) => col.name.toLowerCase());
      const tableName = table.name.toLowerCase();
      
      // Check financial calculations with enhanced matching
      for (const [calcName, rule] of Object.entries(this.businessRules.calculation_patterns.financial)) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedCalculations.push({
            name: calcName,
            table: table.name,
            pattern: rule.pattern,
            formula: rule.formula,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95), // Boost confidence for good matches
            type: 'financial',
            examples: rule.examples || []
          });
        }
      }
      
      // Check inventory calculations
      for (const [calcName, rule] of Object.entries(this.businessRules.calculation_patterns.inventory)) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedCalculations.push({
            name: calcName,
            table: table.name,
            pattern: rule.pattern,
            formula: rule.formula,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'inventory',
            examples: rule.examples || []
          });
        }
      }
      
      // Check analytics calculations
      for (const [calcName, rule] of Object.entries(this.businessRules.calculation_patterns.analytics)) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedCalculations.push({
            name: calcName,
            table: table.name,
            pattern: rule.pattern,
            formula: rule.formula,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'analytics',
            examples: rule.examples || []
          });
        }
      }
      

      
      // Check fleet management calculations
      for (const [calcName, rule] of Object.entries(this.businessRules.calculation_patterns.fleet_management || {})) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedCalculations.push({
            name: calcName,
            table: table.name,
            pattern: rule.pattern,
            formula: rule.formula,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'fleet_management',
            examples: rule.examples || []
          });
        }
      }
      
      // Check operational calculations
      for (const [calcName, rule] of Object.entries(this.businessRules.calculation_patterns.operational)) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedCalculations.push({
            name: calcName,
            table: table.name,
            pattern: rule.pattern,
            formula: rule.formula,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'operational',
            examples: rule.examples || []
          });
        }
      }

      // Check individual columns for calculation patterns
      for (const column of tableColumns) {
        const columnName = column.name.toLowerCase();
        
        // Check if this column appears to be a calculated field
        if (this.isBusinessCalculationField(columnName, tableColumns)) {
          const businessPattern = this.identifyBusinessCalculationPattern(columnName, tableColumns);
          
          analysis.detectedCalculations.push({
            name: column.name,
            table: table.name,
            pattern: businessPattern.pattern,
            formula: businessPattern.formula,
            description: `Detected calculated field: ${column.name}`,
            business_purpose: businessPattern.purpose,
            confidence: 0.75,
            type: 'calculated_field',
            examples: []
          });
        }
      }
    }
  }

  /**
   * Enhanced status pattern detection
   */
  private detectStatusPatterns(schema: any, analysis: BusinessLogicAnalysis): void {
    const allTables = schema.tables || [];
    
    for (const table of allTables) {
      const tableColumns = table.columns || [];
      const columnNames = tableColumns.map((col: any) => col.name.toLowerCase());
      const tableName = table.name.toLowerCase();
      
      // Check user activity statuses
      for (const [statusName, rule] of Object.entries(this.businessRules.status_patterns.user_activity)) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedStatuses.push({
            name: statusName,
            table: table.name,
            pattern: rule.pattern,
            condition: rule.condition,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'user_activity',
            examples: rule.examples || []
          });
        }
      }
      
      // Check order statuses
      for (const [statusName, rule] of Object.entries(this.businessRules.status_patterns.order_status)) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedStatuses.push({
            name: statusName,
            table: table.name,
            pattern: rule.pattern,
            condition: rule.condition,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'order_status',
            examples: rule.examples || []
          });
        }
      }
      
      // Check system statuses
      for (const [statusName, rule] of Object.entries(this.businessRules.status_patterns.system_status)) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedStatuses.push({
            name: statusName,
            table: table.name,
            pattern: rule.pattern,
            condition: rule.condition,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'system_status',
            examples: rule.examples || []
          });
        }
      }
      
      // Check business flags
      for (const [flagName, rule] of Object.entries(this.businessRules.status_patterns.business_flags || {})) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedStatuses.push({
            name: flagName,
            table: table.name,
            pattern: rule.pattern,
            condition: rule.condition,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'business_flags',
            examples: rule.examples || []
          });
        }
      }
      
      // Check audit trail patterns
      for (const [auditName, rule] of Object.entries(this.businessRules.status_patterns.audit_trail || {})) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedStatuses.push({
            name: auditName,
            table: table.name,
            pattern: rule.pattern,
            condition: rule.condition,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'audit_trail',
            examples: rule.examples || []
          });
        }
      }
      
      // Check fleet status patterns
      for (const [statusName, rule] of Object.entries(this.businessRules.status_patterns.fleet_status || {})) {
        const matchScore = this.enhancedPatternMatch(rule.pattern, columnNames, tableName);
        if (matchScore > 0.7) {
          analysis.detectedStatuses.push({
            name: statusName,
            table: table.name,
            pattern: rule.pattern,
            condition: rule.condition,
            description: rule.description,
            business_purpose: rule.business_purpose,
            confidence: Math.min(matchScore + 0.2, 0.95),
            type: 'fleet_status',
            examples: rule.examples || []
          });
        }
      }
    }
  }

  /**
   * Enhanced relationship pattern detection
   */
  private detectRelationshipPatterns(schema: any, analysis: BusinessLogicAnalysis): void {
    const allTables = schema.tables || [];
    
    for (const table of allTables) {
      const tableColumns = table.columns || [];
      
      // Detect foreign key relationships with enhanced logic
      for (const column of tableColumns) {
        if (column.isForeignKey && column.foreignKeyInfo) {
          analysis.detectedRelationships.push({
            type: 'foreign_key',
            from_table: table.name,
            from_column: column.name,
            to_table: column.foreignKeyInfo.referencedTable,
            to_column: column.foreignKeyInfo.referencedColumn,
            relationship_type: 'many_to_one',
            description: `Relationship from ${table.name}.${column.name} to ${column.foreignKeyInfo.referencedTable}.${column.foreignKeyInfo.referencedColumn}`,
            business_purpose: 'Data integrity and relationship management',
            confidence: 0.95
          });
        }
      }
      
      // Detect foreign key relationships from patterns
      for (const [relName, rule] of Object.entries(this.businessRules.relationship_patterns.foreign_keys)) {
        // Check if this table matches the from_table in the pattern
        if (table.name.toLowerCase() === rule.from_table.toLowerCase()) {
          // Look for the foreign key column
          const fkColumn = tableColumns.find((col: any) => col.name.toLowerCase() === rule.from_column.toLowerCase());
          if (fkColumn) {
            analysis.detectedRelationships.push({
              type: 'foreign_key',
              from_table: rule.from_table,
              from_column: rule.from_column,
              to_table: rule.to_table,
              to_column: rule.to_column,
              relationship_type: rule.relationship_type || 'many_to_one',
              description: rule.description,
              business_purpose: rule.business_purpose,
              confidence: 0.9
            });
          }
        }
      }
      
              // Detect calculated field patterns
        for (const [calcName, rule] of Object.entries(this.businessRules.relationship_patterns.calculated_fields)) {
          // Check if the table has the calculated field
          const hasField = tableColumns.some((col: any) => col.name.toLowerCase() === calcName.toLowerCase());
          if (hasField) {
            analysis.detectedRelationships.push({
              type: 'calculated_fields',
              table: table.name,
              field_name: rule.field_name || calcName,
              pattern: rule.pattern || [],
              formula: rule.formula,
              description: rule.description,
              business_purpose: rule.business_purpose,
              confidence: 0.9,
              examples: rule.examples || []
            });
          }
        }
      
      // Detect calculated fields based on business patterns and naming conventions
      for (const column of tableColumns) {
        const columnName = column.name.toLowerCase();
        
        // Check for explicit calculated field indicators
        const calculatedFieldPatterns = ['total_', 'calculated_', 'computed_', 'derived_', 'sum_', 'avg_', 'count_'];
        const isExplicitCalculated = calculatedFieldPatterns.some(pattern => columnName.includes(pattern));
        
        if (isExplicitCalculated) {
          // Try to infer the calculation pattern from related columns
          const relatedColumns = this.inferCalculationPattern(columnName, tableColumns);
          
          analysis.detectedRelationships.push({
            type: 'calculated_fields',
            table: table.name,
            field_name: column.name,
            pattern: relatedColumns,
            formula: this.generateFormula(columnName, relatedColumns),
            description: `Detected calculated field: ${column.name}`,
            business_purpose: 'Business calculation and aggregation',
            confidence: 0.85
          });
        }
        
        // Check for business logic patterns that suggest calculations
        else if (this.isBusinessCalculationField(columnName, tableColumns)) {
          const businessPattern = this.identifyBusinessCalculationPattern(columnName, tableColumns);
          
          analysis.detectedRelationships.push({
            type: 'calculated_fields',
            table: table.name,
            field_name: column.name,
            pattern: businessPattern.pattern,
            formula: businessPattern.formula,
            description: `Business logic suggests this is a calculated field: ${column.name}`,
            business_purpose: businessPattern.purpose,
            confidence: 0.75
          });
        }
      }
      
              // Detect entity relationships based on table names and patterns
        const tableName = table.name.toLowerCase();
        if (tableName.includes('order') && tableName.includes('item')) {
          analysis.detectedRelationships.push({
            type: 'entity_relationships',
            from_table: 'orders',
            to_table: 'order_items',
            relationship_type: 'one_to_many',
            description: 'Orders have many order items',
            business_purpose: 'Order detail management',
            confidence: 0.9
          });
        }
        
        if (tableName.includes('user') && tableName.includes('order')) {
          analysis.detectedRelationships.push({
            type: 'entity_relationships',
            from_table: 'users',
            to_table: 'order_items',
            relationship_type: 'one_to_many',
            description: 'Users have many orders',
            business_purpose: 'Customer order tracking',
            confidence: 0.9
          });
        }
      
      // Detect entity relationships based on business domain knowledge
      const domain = this.detectBusinessDomain(schema);
      const entityRelationships = this.businessRules.entity_relationships?.[domain];
      
      if (entityRelationships) {
        for (const [entity, relationships] of Object.entries(entityRelationships)) {
          if (tableName.includes(entity)) {
            for (const [relatedEntity, relationshipType] of Object.entries(relationships as any)) {
              // Check if the related entity table exists in the schema
              const relatedTableExists = (schema.tables || []).some((t: any) => 
                t.name.toLowerCase().includes(relatedEntity)
              );
              
              if (relatedTableExists) {
                analysis.detectedRelationships.push({
                  type: 'entity_relationships',
                  from_table: table.name,
                  to_table: relatedEntity,
                  relationship_type: relationshipType as string,
                  description: `${table.name} has ${relationshipType} relationship with ${relatedEntity}`,
                  business_purpose: 'Domain-specific entity modeling',
                  confidence: 0.9
                });
              }
            }
          }
        }
      }
      
      // Detect common business entity relationships
      if (tableName.includes('user') || tableName.includes('customer')) {
        analysis.detectedRelationships.push({
          type: 'entity_relationships',
          from_table: table.name,
          to_table: 'orders',
          relationship_type: 'one_to_many',
          description: `${table.name} can have many orders`,
          business_purpose: 'Customer relationship management',
          confidence: 0.8
        });
      }
      
      if (tableName.includes('product') || tableName.includes('item')) {
        analysis.detectedRelationships.push({
          type: 'entity_relationships',
          from_table: table.name,
          to_table: 'order_items',
          relationship_type: 'one_to_many',
          description: `${table.name} can be in many order items`,
          business_purpose: 'Product catalog management',
          confidence: 0.8
        });
      }
    }
  }

  /**
   * Detect entity relationships based on domain knowledge
   */
  private detectEntityRelationships(schema: any, analysis: BusinessLogicAnalysis): void {
    const domain = this.detectBusinessDomain(schema);
    const entityRelationships = this.businessRules.entity_relationships?.[domain];
    
    if (entityRelationships) {
      const tableNames = (schema.tables || []).map((table: any) => table.name.toLowerCase());
      
      for (const [entity, relationships] of Object.entries(entityRelationships)) {
        if (tableNames.some((name: string) => name.includes(entity))) {
          for (const [relatedEntity, relationshipType] of Object.entries(relationships as any)) {
            if (tableNames.some((name: string) => name.includes(relatedEntity))) {
              analysis.detectedRelationships.push({
                type: 'entity_relationship',
                from_table: entity,
                to_table: relatedEntity,
                relationship_type: relationshipType as string,
                description: `${entity} has ${relationshipType} relationship with ${relatedEntity}`,
                business_purpose: 'Domain-specific entity modeling',
                confidence: 0.9
              });
            }
          }
        }
      }
    }
  }

  /**
   * Detect business rules based on domain knowledge
   */
  private detectBusinessRules(schema: any, analysis: BusinessLogicAnalysis): void {
    const domain = this.detectBusinessDomain(schema);
    const domainConfig = this.businessRules.business_domains[domain];
    
    if (domainConfig?.business_rules) {
      for (const rule of domainConfig.business_rules) {
        analysis.detectedRelationships.push({
          type: 'business_rule',
          description: rule,
          business_purpose: 'Domain-specific business logic',
          confidence: 0.85
        });
      }
    }
  }

  /**
   * Enhanced business domain detection with better scoring
   */
  private detectBusinessDomain(schema: any): string {
    const allTables = schema.tables || [];
    const tableNames = allTables.map((table: any) => table.name.toLowerCase());
    const allColumns = allTables.flatMap((table: any) => 
      (table.columns || []).map((col: any) => col.name.toLowerCase())
    );
    
    const domainScores: { [key: string]: number } = {};
    
    for (const [domain, config] of Object.entries(this.businessRules.business_domains)) {
      let score = 0;
      
      // Check key entities with higher weight
      const keyEntities = config.key_entities || [];
      for (const entity of keyEntities) {
        if (tableNames.some((name: string) => name.includes(entity))) {
          score += 4; // Increased weight for entity matches
        }
      }
      
      // Check key metrics
      const keyMetrics = config.key_metrics || [];
      for (const metric of keyMetrics) {
        if (allColumns.some((col: string) => col.includes(metric))) {
          score += 3; // Increased weight for metric matches
        }
      }
      
      // Check common calculations
      const commonCalculations = config.common_calculations || [];
      for (const calc of commonCalculations) {
        if (allColumns.some((col: string) => col.includes(calc))) {
          score += 2;
        }
      }
      
      // Universal domain-specific pattern detection
      const domainPatterns = this.getDomainSpecificPatterns(domain);
      if (domainPatterns) {
        for (const pattern of domainPatterns.tablePatterns || []) {
          if (tableNames.some((name: string) => name.includes(pattern))) {
            score += 2; // Additional boost for domain-specific table patterns
          }
        }
        
        for (const pattern of domainPatterns.columnPatterns || []) {
          if (allColumns.some((col: string) => col.includes(pattern))) {
            score += 1; // Additional boost for domain-specific column patterns
          }
        }
      }
      
      domainScores[domain] = score;
    }
    
    // Return domain with highest score
    const bestDomain = Object.entries(domainScores)
      .sort(([,a], [,b]) => b - a)[0];
    
    // Lower threshold for better domain detection
    return bestDomain && bestDomain[1] > 1 ? bestDomain[0] : 'general';
  }

  /**
   * Get domain-specific patterns for enhanced detection
   */
  private getDomainSpecificPatterns(domain: string): { tablePatterns?: string[], columnPatterns?: string[] } | null {
    const patterns: { [key: string]: { tablePatterns: string[], columnPatterns: string[] } } = {
      'fleet_management': {
        tablePatterns: ['vehicle', 'driver', 'trip', 'fuel', 'maintenance', 'fleet', 'dispatch'],
        columnPatterns: ['license_plate', 'vin', 'mileage', 'fuel_level', 'maintenance_date', 'trip_distance']
      },
      'ecommerce': {
        tablePatterns: ['product', 'order', 'customer', 'cart', 'inventory', 'category'],
        columnPatterns: ['price', 'quantity', 'total', 'sku', 'stock', 'rating']
      },
      'saas': {
        tablePatterns: ['user', 'subscription', 'feature', 'billing', 'usage', 'plan'],
        columnPatterns: ['mrr', 'churn', 'activation', 'feature_usage', 'billing_cycle']
      },
      'fintech': {
        tablePatterns: ['account', 'transaction', 'payment', 'balance', 'card', 'fraud'],
        columnPatterns: ['amount', 'balance', 'transaction_id', 'fraud_score', 'settlement']
      },
      'healthcare': {
        tablePatterns: ['patient', 'appointment', 'doctor', 'medical_record', 'prescription'],
        columnPatterns: ['patient_id', 'appointment_date', 'diagnosis', 'prescription', 'billing']
      },
      'logistics': {
        tablePatterns: ['shipment', 'warehouse', 'route', 'delivery', 'tracking'],
        columnPatterns: ['tracking_number', 'delivery_date', 'route_distance', 'shipping_cost']
      }
    };
    
    return patterns[domain] || null;
  }

  /**
   * Enhanced pattern matching with fuzzy logic and business context
   */
  private enhancedPatternMatch(pattern: string[], columnNames: string[], tableName: string): number {
    let matchScore = 0;
    let totalPatterns = pattern.length;
    
    for (const requiredField of pattern) {
      let bestMatch = 0;
      
      for (const col of columnNames) {
        // Exact match - highest confidence
        if (col === requiredField) {
          bestMatch = 1.0;
          break;
        }
        // Contains match - high confidence for business logic
        else if (col.includes(requiredField) || requiredField.includes(col)) {
          bestMatch = Math.max(bestMatch, 0.8);
        }
        // Business synonym match - medium-high confidence
        else if (this.isBusinessSynonym(col, requiredField)) {
          bestMatch = Math.max(bestMatch, 0.7);
        }
        // Fuzzy match (common variations) - medium confidence
        else if (this.isFuzzyMatch(col, requiredField)) {
          bestMatch = Math.max(bestMatch, 0.6);
        }
        // Partial word match - lower confidence but still valid
        else if (this.isPartialWordMatch(col, requiredField)) {
          bestMatch = Math.max(bestMatch, 0.4);
        }
      }
      
      matchScore += bestMatch;
    }
    
    // Boost score for domain-specific table names and business context
    const domainBoost = this.getDomainTableBoost(tableName);
    const businessContextBoost = this.getBusinessContextBoost(tableName, columnNames);
    
    return Math.min((matchScore / totalPatterns) + domainBoost + businessContextBoost, 1.0);
  }

  /**
   * Business synonym matching for better business logic detection
   */
  private isBusinessSynonym(column: string, pattern: string): boolean {
    const businessSynonyms: { [key: string]: string[] } = {
      'price': ['cost', 'amount', 'value', 'rate', 'fee'],
      'quantity': ['qty', 'count', 'number', 'amount', 'volume'],
      'total': ['sum', 'amount', 'value', 'cost', 'grand_total'],
      'date': ['created', 'updated', 'timestamp', 'time', 'when'],
      'status': ['state', 'condition', 'flag', 'phase'],
      'user': ['customer', 'client', 'member', 'account', 'person'],
      'order': ['purchase', 'transaction', 'sale', 'booking', 'request'],
      'product': ['item', 'goods', 'merchandise', 'sku', 'article'],
      'category': ['type', 'group', 'class', 'department', 'classification'],
      'inventory': ['stock', 'warehouse', 'supply', 'quantity', 'available'],
      'payment': ['transaction', 'transfer', 'settlement', 'receipt'],
      'balance': ['amount', 'total', 'sum', 'remaining', 'outstanding'],
      'delivery': ['shipping', 'transport', 'dispatch', 'fulfillment'],
      'tracking': ['monitoring', 'following', 'pursuing', 'observing']
    };
    
    const patternSynonyms = businessSynonyms[pattern] || [];
    return patternSynonyms.some(synonym => 
      column.includes(synonym) || synonym.includes(column)
    );
  }

  /**
   * Partial word matching for better fuzzy detection
   */
  private isPartialWordMatch(column: string, pattern: string): boolean {
    // Split into words and check for partial matches
    const columnWords = column.split(/[_\s]+/);
    const patternWords = pattern.split(/[_\s]+/);
    
    for (const colWord of columnWords) {
      for (const patWord of patternWords) {
        if (colWord.length > 2 && patWord.length > 2) {
          // Check if words share common prefixes or suffixes
          if (colWord.startsWith(patWord.substring(0, 3)) || 
              patWord.startsWith(colWord.substring(0, 3))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Fuzzy matching for common field variations
   */
  private isFuzzyMatch(column: string, pattern: string): boolean {
    const variations: { [key: string]: string[] } = {
      'price': ['cost', 'amount', 'value', 'rate'],
      'quantity': ['qty', 'count', 'number', 'amount'],
      'total': ['sum', 'amount', 'value', 'cost'],
      'date': ['created', 'updated', 'timestamp', 'time'],
      'status': ['state', 'condition', 'flag'],
      'user': ['customer', 'client', 'member'],
      'order': ['purchase', 'transaction', 'sale', 'booking'],
      'product': ['item', 'goods', 'merchandise', 'sku'],
      'category': ['type', 'group', 'class', 'department'],
      // Universal domain-specific variations
      'vehicle': ['car', 'truck', 'van', 'fleet', 'auto'],
      'driver': ['operator', 'pilot', 'chauffeur'],
      'trip': ['journey', 'route', 'travel', 'drive'],
      'fuel': ['gas', 'petrol', 'diesel', 'energy'],
      'maintenance': ['service', 'repair', 'upkeep', 'inspection'],
      'mileage': ['odometer', 'distance', 'miles', 'kilometers'],
      'license': ['plate', 'registration', 'permit'],
      'vin': ['vehicle_id', 'serial', 'chassis'],
      'customer': ['client', 'buyer', 'user', 'account'],
      'inventory': ['stock', 'warehouse', 'supply'],
      'subscription': ['plan', 'billing', 'membership'],
      'feature': ['function', 'capability', 'tool'],
      'usage': ['consumption', 'activity', 'utilization'],
      'transaction': ['payment', 'transfer', 'exchange'],
      'account': ['wallet', 'balance', 'portfolio'],
      'fraud': ['security', 'risk', 'suspicious'],
      'patient': ['client', 'person', 'individual'],
      'appointment': ['visit', 'consultation', 'session'],
      'doctor': ['physician', 'provider', 'specialist'],
      'shipment': ['package', 'delivery', 'cargo'],
      'warehouse': ['storage', 'facility', 'depot'],
      'route': ['path', 'journey', 'delivery_path']
    };
    
    const patternVariations = variations[pattern] || [];
    return patternVariations.some(variation => 
      column.includes(variation) || variation.includes(column)
    );
  }

  /**
   * Get business context boost based on table and column patterns
   */
  private getBusinessContextBoost(tableName: string, columnNames: string[]): number {
    let boost = 0;
    
    // Boost for tables with business-critical patterns
    const businessCriticalPatterns = ['order', 'payment', 'transaction', 'inventory', 'customer'];
    for (const pattern of businessCriticalPatterns) {
      if (tableName.includes(pattern)) {
        boost += 0.05;
      }
    }
    
    // Boost for columns with business logic indicators
    const businessLogicColumns = ['total', 'calculated', 'derived', 'computed', 'status', 'flag'];
    for (const col of columnNames) {
      for (const indicator of businessLogicColumns) {
        if (col.includes(indicator)) {
          boost += 0.02;
        }
      }
    }
    
    return Math.min(boost, 0.15); // Cap at 0.15
  }

  /**
   * Infer calculation pattern from column name and related columns
   */
  private inferCalculationPattern(columnName: string, tableColumns: any[]): string[] {
    const patterns: { [key: string]: string[] } = {
      'total_price': ['unit_price', 'quantity'],
      'total_amount': ['amount', 'quantity'],
      'stock_level': ['initial_stock', 'sold_quantity'],
      'profit_margin': ['revenue', 'cost'],
      'tax_amount': ['subtotal', 'tax_rate'],
      'discount_amount': ['original_price', 'discount_rate'],
      'shipping_cost': ['weight', 'distance'],
      'order_value': ['item_price', 'quantity']
    };
    
    return patterns[columnName] || [];
  }

  /**
   * Generate formula based on column name and related columns
   */
  private generateFormula(columnName: string, relatedColumns: string[]): string {
    if (relatedColumns.length === 0) {
      return `Calculated field: ${columnName}`;
    }
    
    const patterns: { [key: string]: string } = {
      'total_price': 'unit_price * quantity',
      'total_amount': 'amount * quantity',
      'stock_level': 'initial_stock - sold_quantity',
      'profit_margin': 'revenue - cost',
      'tax_amount': 'subtotal * tax_rate',
      'discount_amount': 'original_price * discount_rate',
      'shipping_cost': 'weight * distance * rate',
      'order_value': 'SUM(item_price * quantity)'
    };
    
    return patterns[columnName] || `${relatedColumns.join(' + ')}`;
  }

  /**
   * Check if a field is likely a business calculation based on context
   */
  private isBusinessCalculationField(columnName: string, tableColumns: any[]): boolean {
    const businessCalculationPatterns = [
      'level', 'count', 'rate', 'percentage', 'ratio', 'index',
      'score', 'rating', 'rank', 'position', 'status', 'flag',
      'total', 'sum', 'average', 'avg', 'min', 'max', 'calculated',
      'derived', 'computed', 'visits', 'activity', 'last'
    ];
    
    return businessCalculationPatterns.some(pattern => columnName.includes(pattern));
  }

  /**
   * Identify business calculation pattern for a field
   */
  private identifyBusinessCalculationPattern(columnName: string, tableColumns: any[]): {
    pattern: string[];
    formula: string;
    purpose: string;
  } {
    const columnNames = tableColumns.map((col: any) => col.name.toLowerCase());
    
    if (columnName.includes('level')) {
      return {
        pattern: ['initial', 'current', 'available'],
        formula: 'initial - consumed + added',
        purpose: 'Resource level tracking'
      };
    }
    
    if (columnName.includes('count') || columnName.includes('visits')) {
      return {
        pattern: ['id', 'reference', 'user_id'],
        formula: 'COUNT(related_records)',
        purpose: 'Record counting and aggregation'
      };
    }
    
    if (columnName.includes('total') || columnName.includes('sum')) {
      return {
        pattern: ['amount', 'quantity', 'value'],
        formula: 'SUM(related_values)',
        purpose: 'Total calculation and aggregation'
      };
    }
    
    if (columnName.includes('rate') || columnName.includes('percentage')) {
      return {
        pattern: ['numerator', 'denominator'],
        formula: '(numerator / denominator) * 100',
        purpose: 'Rate and percentage calculations'
      };
    }
    
    if (columnName.includes('last') || columnName.includes('activity')) {
      return {
        pattern: ['timestamp', 'date', 'created'],
        formula: 'MAX(timestamp_field)',
        purpose: 'Last activity tracking'
      };
    }
    
    return {
      pattern: columnNames.slice(0, 3),
      formula: 'Business logic calculation',
      purpose: 'Business rule implementation'
    };
  }

  /**
   * Get domain-specific table name boost
   */
  private getDomainTableBoost(tableName: string): number {
    const domainTablePatterns: { [key: string]: string[] } = {
      'ecommerce': ['product', 'order', 'customer', 'category', 'inventory'],
      'saas': ['user', 'subscription', 'feature', 'billing', 'usage'],
      'fintech': ['account', 'transaction', 'payment', 'balance', 'card'],
      'fleet_management': ['vehicle', 'driver', 'trip', 'fuel', 'maintenance', 'employee', 'department'],
      'healthcare': ['patient', 'appointment', 'doctor', 'medical', 'prescription'],
      'logistics': ['shipment', 'warehouse', 'vehicle', 'driver', 'route']
    };
    
    for (const [domain, patterns] of Object.entries(domainTablePatterns)) {
      if (patterns.some(pattern => tableName.includes(pattern))) {
        return 0.1; // Small boost for domain-specific tables
      }
    }
    
    return 0;
  }

  /**
   * Enhanced confidence calculation
   */
  private calculateEnhancedConfidence(analysis: BusinessLogicAnalysis): number {
    const totalDetections = 
      analysis.detectedCalculations.length + 
      analysis.detectedStatuses.length + 
      analysis.detectedRelationships.length;
    
    if (totalDetections === 0) return 0;
    
    // Weight different types of detections
    const calculationWeight = 0.4;
    const statusWeight = 0.3;
    const relationshipWeight = 0.3;
    
    const avgCalculationConfidence = analysis.detectedCalculations.length > 0 
      ? analysis.detectedCalculations.reduce((sum, calc) => sum + calc.confidence, 0) / analysis.detectedCalculations.length
      : 0;
    
    const avgStatusConfidence = analysis.detectedStatuses.length > 0
      ? analysis.detectedStatuses.reduce((sum, status) => sum + status.confidence, 0) / analysis.detectedStatuses.length
      : 0;
    
    const avgRelationshipConfidence = analysis.detectedRelationships.length > 0
      ? analysis.detectedRelationships.reduce((sum, rel) => sum + (rel.confidence || 0.8), 0) / analysis.detectedRelationships.length
      : 0;
    
    const weightedConfidence = 
      (avgCalculationConfidence * calculationWeight) +
      (avgStatusConfidence * statusWeight) +
      (avgRelationshipConfidence * relationshipWeight);
    
    // Boost confidence for domain-specific detections
    const domainBoost = analysis.businessDomain !== 'general' ? 0.1 : 0;
    
    return Math.min(weightedConfidence + domainBoost, 1);
  }

  /**
   * Detect data quality issues
   */
  private detectDataQualityIssues(schema: any, analysis: BusinessLogicAnalysis): void {
    const allTables = schema.tables || [];
    
    for (const table of allTables) {
      const tableColumns = table.columns || [];
      
      // Check for missing required fields (common patterns)
      const commonRequiredFields = ['id', 'created_at', 'updated_at'];
      const missingFields = commonRequiredFields.filter(field => 
        !tableColumns.some((col: any) => col.name.toLowerCase() === field.toLowerCase())
      );
      
      if (missingFields.length > 0) {
        analysis.dataQualityIssues.push({
          type: 'missing_fields',
          table: table.name,
          category: 'completeness',
          missing_fields: missingFields,
          severity: 'medium',
          description: `Missing common required fields: ${missingFields.join(', ')}`
        });
      }
      
      // Check for tables with very few columns (potential data quality issue)
      if (tableColumns.length < 3) {
        analysis.dataQualityIssues.push({
          type: 'insufficient_columns',
          table: table.name,
          category: 'completeness',
          severity: 'medium',
          description: `Table has very few columns (${tableColumns.length}), consider adding more fields`
        });
      }
      
      // Check for data consistency issues
      const hasPrimaryKey = tableColumns.some((col: any) => col.isPrimaryKey);
      if (!hasPrimaryKey) {
        analysis.dataQualityIssues.push({
          type: 'data_consistency',
          table: table.name,
          category: 'integrity',
          severity: 'high',
          description: 'Table missing primary key'
        });
      }
      
      // Check for potential audit trail fields
      const auditFields = ['created_at', 'updated_at', 'modified_by', 'deleted_at'];
      const hasAuditTrail = auditFields.some(field => 
        tableColumns.some((col: any) => col.name.toLowerCase().includes(field.toLowerCase()))
      );
      
      if (!hasAuditTrail && table.name.toLowerCase() !== 'audit_log') {
        analysis.dataQualityIssues.push({
          type: 'audit_trail',
          table: table.name,
          category: 'compliance',
          severity: 'low',
          description: 'Consider adding audit trail fields for better tracking'
        });
      }
      
      // Check for missing required fields based on business domain
      const domain = this.detectBusinessDomain(schema);
      if (domain === 'ecommerce') {
        const ecommerceRequiredFields = ['price', 'quantity', 'status'];
        const missingEcommerceFields = ecommerceRequiredFields.filter(field => 
          !tableColumns.some((col: any) => col.name.toLowerCase().includes(field.toLowerCase()))
        );
        
        if (missingEcommerceFields.length > 0) {
          analysis.dataQualityIssues.push({
            type: 'missing_fields',
            table: table.name,
            category: 'business_requirements',
            missing_fields: missingEcommerceFields,
            severity: 'medium',
            description: `Missing e-commerce required fields: ${missingEcommerceFields.join(', ')}`
          });
        }
      }
    }
  }

  /**
   * Generate business logic suggestions for a schema
   */
  generateSuggestions(analysis: BusinessLogicAnalysis): BusinessLogicSuggestions {
    const suggestions: BusinessLogicSuggestions = {
      recommendedCalculations: [],
      recommendedStatuses: [],
      recommendedRelationships: [],
      businessInsights: [],
      dataQualityRecommendations: []
    };

    // Generate calculation suggestions based on detected patterns
    for (const calc of analysis.detectedCalculations) {
      suggestions.recommendedCalculations.push({
        name: calc.name,
        description: calc.description,
        business_purpose: calc.business_purpose,
        implementation: `Consider implementing: ${calc.formula}`,
        priority: calc.confidence > 0.9 ? 'high' : 'medium',
        examples: calc.examples || []
      });
    }

    // Add domain-specific calculation recommendations
    if (analysis.businessDomain !== 'general') {
      const domainRecommendations = this.getDomainCalculationRecommendations(analysis.businessDomain);
      suggestions.recommendedCalculations.push(...domainRecommendations);
    }

    // Generate status suggestions
    for (const status of analysis.detectedStatuses) {
      suggestions.recommendedStatuses.push({
        name: status.name,
        description: status.description,
        business_purpose: status.business_purpose,
        implementation: `Consider implementing: ${status.condition}`,
        priority: status.confidence > 0.9 ? 'high' : 'medium',
        examples: status.examples || []
      });
    }

    // Generate business insights
    if (analysis.businessDomain !== 'general') {
      suggestions.businessInsights.push({
        type: 'domain_identification',
        message: `Schema appears to be in the ${analysis.businessDomain} domain`,
        confidence: analysis.confidence,
        recommendations: this.getDomainRecommendations(analysis.businessDomain)
      });
    }

    // Generate data quality recommendations
    for (const issue of analysis.dataQualityIssues) {
      suggestions.dataQualityRecommendations.push({
        issue: issue.description,
        severity: issue.severity,
        recommendation: `Add missing required fields: ${issue.missing_fields?.join(', ')}`
      });
    }
    
    // Generate relationship suggestions
    for (const rel of analysis.detectedRelationships) {
      suggestions.recommendedRelationships.push({
        name: rel.type,
        description: rel.description,
        business_purpose: rel.business_purpose,
        implementation: `Consider implementing: ${rel.relationship_type || 'relationship'}`,
        priority: (rel.confidence || 0) > 0.9 ? 'high' : 'medium',
        examples: rel.examples || []
      });
    }

    return suggestions;
  }

  /**
   * Get domain-specific recommendations
   */
  private getDomainRecommendations(domain: string): string[] {
    const domainConfig = this.businessRules.business_domains[domain];
    if (!domainConfig) return [];

    const recommendations = [];
    
    if (domainConfig.key_metrics) {
      recommendations.push(`Track key metrics: ${domainConfig.key_metrics.join(', ')}`);
    }
    
    if (domainConfig.common_calculations) {
      recommendations.push(`Implement common calculations: ${domainConfig.common_calculations.join(', ')}`);
    }

    if (domainConfig.business_rules) {
      recommendations.push(`Follow business rules: ${domainConfig.business_rules.slice(0, 2).join(', ')}`);
    }
    
    // Add default recommendations for common domains
    if (domain === 'ecommerce') {
      recommendations.push('Implement order tracking and inventory management');
      recommendations.push('Add customer relationship management features');
    } else if (domain === 'financial') {
      recommendations.push('Implement transaction logging and audit trails');
      recommendations.push('Add compliance and regulatory reporting');
    } else if (domain === 'healthcare') {
      recommendations.push('Implement patient data privacy controls');
      recommendations.push('Add HIPAA compliance features');
    }

    return recommendations;
  }

  /**
   * Get domain-specific calculation recommendations
   */
  private getDomainCalculationRecommendations(domain: string): BusinessLogicRecommendation[] {
    const recommendations: BusinessLogicRecommendation[] = [];
    
    if (domain === 'ecommerce') {
      recommendations.push({
        name: 'total_price_calculation',
        description: 'Calculate total price for orders',
        business_purpose: 'Revenue calculation and order management',
        implementation: 'Implement: quantity * unit_price',
        priority: 'high',
        examples: ['order_items.total_price = quantity * unit_price']
      });
      
      recommendations.push({
        name: 'stock_level_calculation',
        description: 'Calculate current stock levels',
        business_purpose: 'Inventory management',
        implementation: 'Implement: initial_stock - sold_quantity',
        priority: 'high',
        examples: ['products.stock_level = initial_stock - sold_quantity']
      });
      
      recommendations.push({
        name: 'order_value_calculation',
        description: 'Calculate total order value',
        business_purpose: 'Customer analytics and reporting',
        implementation: 'Implement: SUM(order_items.total_price)',
        priority: 'medium',
        examples: ['orders.total_value = SUM(order_items.total_price)']
      });
    } else if (domain === 'financial') {
      recommendations.push({
        name: 'balance_calculation',
        description: 'Calculate account balances',
        business_purpose: 'Financial reporting',
        implementation: 'Implement: SUM(transactions.amount)',
        priority: 'high',
        examples: ['accounts.balance = SUM(transactions.amount)']
      });
    } else if (domain === 'healthcare') {
      recommendations.push({
        name: 'patient_statistics',
        description: 'Calculate patient visit statistics',
        business_purpose: 'Healthcare analytics',
        implementation: 'Implement: COUNT(appointments)',
        priority: 'medium',
        examples: ['patients.visit_count = COUNT(appointments)']
      });
    }
    
    return recommendations;
  }
}

export interface BusinessLogicAnalysis {
  detectedCalculations: DetectedCalculation[];
  detectedStatuses: DetectedStatus[];
  detectedRelationships: DetectedRelationship[];
  businessDomain: string;
  dataQualityIssues: DataQualityIssue[];
  confidence: number;
}

export interface DetectedCalculation {
  name: string;
  table: string;
  pattern: string[];
  formula?: string;
  description: string;
  business_purpose: string;
  confidence: number;
  type: string;
  examples?: string[];
}

export interface DetectedStatus {
  name: string;
  table: string;
  pattern: string[];
  condition?: string;
  description: string;
  business_purpose: string;
  confidence: number;
  type: string;
  examples?: string[];
}

export interface DetectedRelationship {
  type: string;
  table?: string;
  from_table?: string;
  from_column?: string;
  to_table?: string;
  to_column?: string;
  relationship_type?: string;
  field_name?: string;
  pattern?: string[];
  formula?: string;
  description: string;
  business_purpose: string;
  confidence?: number;
  examples?: string[];
}

export interface DataQualityIssue {
  type: string;
  table: string;
  category?: string;
  missing_fields?: string[];
  severity: string;
  description: string;
}

export interface BusinessLogicSuggestions {
  recommendedCalculations: BusinessLogicRecommendation[];
  recommendedStatuses: BusinessLogicRecommendation[];
  recommendedRelationships: BusinessLogicRecommendation[];
  businessInsights: BusinessInsight[];
  dataQualityRecommendations: DataQualityRecommendation[];
}

export interface BusinessLogicRecommendation {
  name: string;
  description: string;
  business_purpose: string;
  implementation: string;
  priority: string;
  examples?: string[];
}

export interface BusinessInsight {
  type: string;
  message: string;
  confidence: number;
  recommendations: string[];
}

export interface DataQualityRecommendation {
  issue: string;
  severity: string;
  recommendation: string;
} 