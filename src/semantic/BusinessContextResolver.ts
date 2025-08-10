import { DatabaseSchema, TableInfo, ColumnInfo } from '../types/Providers';
import { SemanticMapping, BusinessRule } from '../types/SemanticMapping';
import { BusinessLogicAnalyzer, BusinessLogicAnalysis } from '../business/BusinessLogicAnalyzer';
import { logger } from '../utils/logger';

export interface BusinessContext {
  domain: string;
  businessEntities: BusinessEntity[];
  businessRules: BusinessRule[];
  relationships: BusinessRelationship[];
  terminology: BusinessTerminology;
}

export interface BusinessEntity {
  name: string;
  description: string;
  businessPurpose: string;
  keyAttributes: string[];
  businessRules: string[];
}

export interface BusinessRelationship {
  fromEntity: string;
  toEntity: string;
  relationshipType: string;
  businessDescription: string;
  cardinality: string;
}

export interface BusinessTerminology {
  technicalToBusiness: { [key: string]: string };
  businessToTechnical: { [key: string]: string };
  domainTerms: string[];
}

export class BusinessContextResolver {
  private businessAnalyzer: BusinessLogicAnalyzer;

  constructor() {
    this.businessAnalyzer = new BusinessLogicAnalyzer();
  }

  /**
   * Resolve business context from technical schema
   */
  async resolveBusinessContext(schema: DatabaseSchema, sampleData?: Record<string, any[]>): Promise<BusinessContext> {
    logger.info('Resolving business context from database schema...');
    
    try {
      // Use BusinessLogicAnalyzer to get real business insights
      const analysis = await this.businessAnalyzer.analyzeBusinessLogic(schema, sampleData);
      
      // Convert analysis to business context
      const businessEntities = this.convertToBusinessEntities(schema, analysis);
      const relationships = this.convertToBusinessRelationships(analysis);
      const terminology = this.buildBusinessTerminology(schema, analysis);
      
      const context: BusinessContext = {
        domain: analysis.domain,
        businessEntities,
        businessRules: [], // Will be populated by BusinessRuleEngine
        relationships,
        terminology
      };

      logger.success(`Business context resolved: ${businessEntities.length} entities, ${relationships.length} relationships`);
      return context;
      
    } catch (error) {
      logger.error(`Business context resolution failed: ${error}`);
      // Return minimal context instead of empty placeholder
      return this.createMinimalContext(schema);
    }
  }

  /**
   * Apply business context to semantic mapping
   */
  async applyBusinessContextToMapping(mapping: SemanticMapping, context: BusinessContext): Promise<SemanticMapping> {
    logger.info('Applying business context to semantic mapping...');
    
    try {
      const enhancedMapping = { ...mapping };
      
      // Enhance entities with business context
      if (enhancedMapping.entities) {
        enhancedMapping.entities = enhancedMapping.entities.map(entity => {
          const businessEntity = context.businessEntities.find(be => 
            be.name.toLowerCase() === entity.name.toLowerCase() ||
            this.normalizeTableName(entity.databaseTable) === be.name.toLowerCase()
          );
          
          if (businessEntity) {
            return {
              ...entity,
              description: businessEntity.description,
              businessPurpose: businessEntity.businessPurpose,
              businessContext: {
                domain: context.domain,
                keyAttributes: businessEntity.keyAttributes,
                businessRules: businessEntity.businessRules
              }
            };
          }
          return entity;
        });
      }

      // Enhance relationships with business descriptions (relationships are nested in entities)
      enhancedMapping.entities = enhancedMapping.entities.map(entity => ({
        ...entity,
        relationships: entity.relationships.map(rel => {
          const businessRel = context.relationships.find(br => 
            br.fromEntity === rel.fromEntity && br.toEntity === rel.toEntity
          );
          
          if (businessRel) {
            return {
              ...rel,
              description: businessRel.businessDescription,
              metadata: {
                ...rel.metadata,
                businessType: businessRel.relationshipType
              }
            };
          }
          return rel;
        })
      }));

      // Add business terminology to metadata (extend the type)
      (enhancedMapping.metadata as any).businessContext = context;
      (enhancedMapping.metadata as any).businessDomain = context.domain;
      (enhancedMapping.metadata as any).businessTerminology = context.terminology;

      logger.success('Business context applied to semantic mapping');
      return enhancedMapping;
      
    } catch (error) {
      logger.error(`Failed to apply business context: ${error}`);
      return mapping; // Return original mapping on error
    }
  }

  /**
   * Convert database schema and analysis to business entities
   */
  private convertToBusinessEntities(schema: DatabaseSchema, analysis: BusinessLogicAnalysis): BusinessEntity[] {
    const entities: BusinessEntity[] = [];
    
    if (schema.tables) {
      for (const table of schema.tables) {
        const businessName = this.generateBusinessName(table.name);
        const keyAttributes = this.identifyKeyAttributes(table);
        const businessPurpose = this.generateBusinessPurpose(table, analysis);
        
        entities.push({
          name: businessName,
          description: `Business entity representing ${businessName.toLowerCase()} for ${businessPurpose}`,
          businessPurpose,
          keyAttributes,
          businessRules: [] // Will be populated by rule engine
        });
      }
    }
    
    return entities;
  }

  /**
   * Convert analysis relationships to business relationships
   */
  private convertToBusinessRelationships(analysis: BusinessLogicAnalysis): BusinessRelationship[] {
    return analysis.relationships.map(rel => ({
      fromEntity: this.generateBusinessName(rel.fromEntity),
      toEntity: this.generateBusinessName(rel.toEntity),
      relationshipType: rel.type,
      businessDescription: rel.businessPurpose || `${rel.type} relationship between ${rel.fromEntity} and ${rel.toEntity}`,
      cardinality: rel.cardinality || 'unknown'
    }));
  }

  /**
   * Build business terminology mapping
   */
  private buildBusinessTerminology(schema: DatabaseSchema, analysis: BusinessLogicAnalysis): BusinessTerminology {
    const technicalToBusiness: { [key: string]: string } = {};
    const businessToTechnical: { [key: string]: string } = {};
    const domainTerms: string[] = [];

    // Map table names to business terms
    if (schema.tables) {
      for (const table of schema.tables) {
        const businessName = this.generateBusinessName(table.name);
        technicalToBusiness[table.name] = businessName;
        businessToTechnical[businessName] = table.name;
        domainTerms.push(businessName);

        // Map column names to business terms
        for (const column of table.columns) {
          const businessColumnName = this.generateBusinessName(column.name);
          const fullTechnicalName = `${table.name}.${column.name}`;
          const fullBusinessName = `${businessName}.${businessColumnName}`;
          
          technicalToBusiness[fullTechnicalName] = fullBusinessName;
          businessToTechnical[fullBusinessName] = fullTechnicalName;
          
          if (!domainTerms.includes(businessColumnName)) {
            domainTerms.push(businessColumnName);
          }
        }
      }
    }

    // Add domain-specific terms
    domainTerms.push(...this.getDomainTerms(analysis.domain));

    return {
      technicalToBusiness,
      businessToTechnical,
      domainTerms: [...new Set(domainTerms)] // Remove duplicates
    };
  }

  /**
   * Generate business-friendly name from technical name
   */
  private generateBusinessName(technicalName: string): string {
    return technicalName
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Normalize table name for comparison
   */
  private normalizeTableName(tableName: string): string {
    return tableName.toLowerCase().replace(/[_-]/g, '');
  }

  /**
   * Identify key attributes for a table
   */
  private identifyKeyAttributes(table: TableInfo): string[] {
    const keyAttributes: string[] = [];
    
    for (const column of table.columns) {
      // Primary keys are always key attributes
      if (column.isPrimaryKey) {
        keyAttributes.push(column.name);
      }
      // Common business key patterns
      else if (/name|title|email|code|identifier|key/i.test(column.name)) {
        keyAttributes.push(column.name);
      }
      // Foreign keys might be key attributes
      else if (column.isForeignKey) {
        keyAttributes.push(column.name);
      }
    }
    
    return keyAttributes.slice(0, 5); // Limit to top 5
  }

  /**
   * Generate business purpose description
   */
  private generateBusinessPurpose(table: TableInfo, analysis: BusinessLogicAnalysis): string {
    const tableName = table.name.toLowerCase();
    
    // Domain-specific purposes
    if (analysis.domain === 'ecommerce') {
      if (tableName.includes('user') || tableName.includes('customer')) return 'Customer management and user accounts';
      if (tableName.includes('order')) return 'Order processing and fulfillment';
      if (tableName.includes('product')) return 'Product catalog and inventory';
      if (tableName.includes('payment')) return 'Payment processing and billing';
    } else if (analysis.domain === 'saas') {
      if (tableName.includes('user')) return 'User management and authentication';
      if (tableName.includes('subscription')) return 'Subscription management and billing';
      if (tableName.includes('feature')) return 'Feature access and usage tracking';
      if (tableName.includes('billing')) return 'Billing and payment processing';
    }
    
    // Generic purposes based on table name patterns
    if (tableName.includes('user') || tableName.includes('person')) return 'User management and authentication';
    if (tableName.includes('order') || tableName.includes('transaction')) return 'Transaction processing and management';
    if (tableName.includes('product') || tableName.includes('item')) return 'Product or item management';
    if (tableName.includes('log') || tableName.includes('audit')) return 'Logging and audit trail';
    
    return `${this.generateBusinessName(table.name)} management and operations`;
  }

  /**
   * Get domain-specific terminology
   */
  private getDomainTerms(domain: string): string[] {
    const domainTerms: { [key: string]: string[] } = {
      ecommerce: ['Customer', 'Order', 'Product', 'Cart', 'Payment', 'Inventory', 'Shipping', 'Category'],
      saas: ['User', 'Subscription', 'Feature', 'Plan', 'Billing', 'Usage', 'License', 'Organization'],
      finance: ['Account', 'Transaction', 'Balance', 'Payment', 'Invoice', 'Budget', 'Revenue', 'Expense'],
      healthcare: ['Patient', 'Provider', 'Appointment', 'Treatment', 'Diagnosis', 'Medication', 'Insurance'],
      general: ['Entity', 'Record', 'Data', 'Information', 'Status', 'Type', 'Category', 'Reference']
    };
    
    return domainTerms[domain] || domainTerms.general;
  }

  /**
   * Create minimal business context when analysis fails
   */
  private createMinimalContext(schema: DatabaseSchema): BusinessContext {
    const entities: BusinessEntity[] = [];
    
    if (schema.tables) {
      for (const table of schema.tables) {
        entities.push({
          name: this.generateBusinessName(table.name),
          description: `Entity representing ${table.name}`,
          businessPurpose: 'Data storage and management',
          keyAttributes: table.columns.filter(c => c.isPrimaryKey).map(c => c.name),
          businessRules: []
        });
      }
    }

    return {
      domain: 'general',
      businessEntities: entities,
      businessRules: [],
      relationships: [],
      terminology: this.buildBasicTerminology(schema)
    };
  }

  /**
   * Build basic terminology when full analysis fails
   */
  private buildBasicTerminology(schema: DatabaseSchema): BusinessTerminology {
    const technicalToBusiness: { [key: string]: string } = {};
    const businessToTechnical: { [key: string]: string } = {};
    const domainTerms: string[] = [];

    if (schema.tables) {
      for (const table of schema.tables) {
        const businessName = this.generateBusinessName(table.name);
        technicalToBusiness[table.name] = businessName;
        businessToTechnical[businessName] = table.name;
        domainTerms.push(businessName);
      }
    }

    return { technicalToBusiness, businessToTechnical, domainTerms };
  }
} 