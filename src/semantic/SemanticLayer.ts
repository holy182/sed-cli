import { DatabaseProvider, DatabaseSchema } from '../types/Providers';
import { SemanticMapping, SemanticEntity, SemanticAttribute } from '../types/SemanticMapping';
import { CacheManager } from '../cache/CacheManager';
import { Config } from '../types/Config';
import { BusinessLogicDetector, BusinessLogicAnalysis } from '../patterns/BusinessLogicDetector';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export enum ErrorType {
  MAPPING_FAILURE = 'MAPPING_FAILURE',
  SQL_SYNTAX_ERROR = 'SQL_SYNTAX_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

export interface SemanticError {
  type: ErrorType;
  message: string;
  details?: any;
  stage: 'discovery' | 'mapping' | 'query_processing' | 'sql_generation';
  timestamp: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

/**
 * Pattern matcher for entity and attribute naming
 */
class PatternMatcher {
  private static readonly ENTITY_PATTERNS: { [key: string]: string } = {
    // User management
    'users': 'User',
    'user': 'User',
    'accounts': 'Account',
    'account': 'Account',
    'profiles': 'Profile',
    'profile': 'Profile',
    'customers': 'Customer',
    'customer': 'Customer',
    'clients': 'Client',
    'client': 'Client',
    
    // Business entities
    'orders': 'Order',
    'order': 'Order',
    'products': 'Product',
    'product': 'Product',
    'invoices': 'Invoice',
    'invoice': 'Invoice',
    'payments': 'Payment',
    'payment': 'Payment',
    'transactions': 'Transaction',
    'transaction': 'Transaction',
    
    // Fleet management
    'vehicles': 'Vehicle',
    'vehicle': 'Vehicle',
    'drivers': 'Driver',
    'driver': 'Driver',
    'trips': 'Trip',
    'trip': 'Trip',
    'maintenance': 'Maintenance',
    'fuel': 'Fuel',
    'routes': 'Route',
    'route': 'Route',
    
    // HR/Employee
    'employees': 'Employee',
    'employee': 'Employee',
    'departments': 'Department',
    'department': 'Department',
    'payroll': 'Payroll',
    'attendance': 'Attendance',
    'schedules': 'Schedule',
    'schedule': 'Schedule',
    
    // Generic patterns
    'logs': 'Log',
    'log': 'Log',
    'settings': 'Setting',
    'setting': 'Setting',
    'config': 'Configuration',
    'configuration': 'Configuration',
    'metadata': 'Metadata',
    'audit': 'Audit',
    'history': 'History',
    'backup': 'Backup'
  };

  private static readonly ATTRIBUTE_PATTERNS: { [key: string]: string } = {
    // IDs
    'id': 'ID',
    '_id': 'ID',
    'uuid': 'UUID',
    'guid': 'GUID',
    
    // Names
    'name': 'Name',
    'title': 'Title',
    'description': 'Description',
    'label': 'Label',
    
    // Contact
    'email': 'Email',
    'phone': 'Phone',
    'address': 'Address',
    'city': 'City',
    'state': 'State',
    'country': 'Country',
    'zip': 'ZIP Code',
    'postal_code': 'Postal Code',
    
    // Dates
    'created_at': 'Created Date',
    'created_date': 'Created Date',
    'updated_at': 'Updated Date',
    'updated_date': 'Updated Date',
    'date': 'Date',
    'timestamp': 'Timestamp',
    'time': 'Time',
    
    // Status
    'status': 'Status',
    'active': 'Active',
    'enabled': 'Enabled',
    'disabled': 'Disabled',
    
    // Business fields
    'amount': 'Amount',
    'price': 'Price',
    'cost': 'Cost',
    'quantity': 'Quantity',
    'total': 'Total',
    'balance': 'Balance',
    
    // Vehicle specific
    'license_plate': 'License Plate',
    'vin': 'VIN',
    'make': 'Make',
    'model': 'Model',
    'year': 'Year',
    'mileage': 'Mileage',
    'fuel_level': 'Fuel Level',
    
    // Employee specific
    'employee_id': 'Employee ID',
    'hire_date': 'Hire Date',
    'salary': 'Salary',
    'position': 'Position',
    'manager': 'Manager'
  };

  static getEntityName(tableName: string): string {
    const lowerName = tableName.toLowerCase();
    
    // Check exact matches first
    if (this.ENTITY_PATTERNS[lowerName]) {
      return this.ENTITY_PATTERNS[lowerName];
    }
    
    // Check patterns with underscores
    const underscoreName = lowerName.replace(/_/g, '');
    if (this.ENTITY_PATTERNS[underscoreName]) {
      return this.ENTITY_PATTERNS[underscoreName];
    }
    
    // Fallback: capitalize and clean
    return tableName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  static getAttributeName(columnName: string): string {
    const lowerName = columnName.toLowerCase();
    
    // Check exact matches first
    if (this.ATTRIBUTE_PATTERNS[lowerName]) {
      return this.ATTRIBUTE_PATTERNS[lowerName];
    }
    
    // Check patterns with underscores
    const underscoreName = lowerName.replace(/_/g, '');
    if (this.ATTRIBUTE_PATTERNS[underscoreName]) {
      return this.ATTRIBUTE_PATTERNS[underscoreName];
    }
    
    // Fallback: capitalize and clean
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export class SemanticLayer {
  private dbProvider: DatabaseProvider;
  private cache: CacheManager;
  private semanticMapping: SemanticMapping | null = null;
  private config: Config;
  private errors: SemanticError[] = [];
  private projectName: string;
  private sedFolder: string;
  private businessLogicDetector = new BusinessLogicDetector();

  constructor(dbProvider: DatabaseProvider, cache: CacheManager, config: Config) {
    this.dbProvider = dbProvider;
    this.cache = cache;
    this.config = config;
    
    // Local processing only - no AI dependencies
    
    // Determine project name from database name or current directory
    this.projectName = config.database.database || path.basename(process.cwd());
    this.sedFolder = path.join(process.cwd(), '.sed');
    
    // Ensure .sed folder exists
    this.ensureSedFolder();
  }

  /**
   * Ensure .sed folder exists
   */
  private ensureSedFolder(): void {
    if (!fs.existsSync(this.sedFolder)) {
      fs.mkdirSync(this.sedFolder, { recursive: true });
    }
  }

  /**
   * Get default mapping file path
   */
  private getDefaultMappingPath(): string {
    return path.join(this.sedFolder, `${this.projectName}.mapping.json`);
  }

  /**
   * Save semantic mapping to file
   */
  private async saveMappingToFile(mapping: SemanticMapping, filePath?: string): Promise<void> {
    const targetPath = filePath || this.getDefaultMappingPath();
    
    // Ensure directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save mapping with metadata and editing instructions
    const mappingData = {
      ...mapping,
      metadata: {
        ...mapping.metadata,
        savedAt: new Date(),
        filePath: targetPath,
        instructions: [
          "This semantic layer file can be edited manually to customize your schema",
          "Add business context, improve descriptions, or fix generated content",
          "Run 'sed sync' to detect database changes and update this file",
          "Run 'sedql validate' to check if your edits are valid against the database"
        ]
      }
    };
    
    fs.writeFileSync(targetPath, JSON.stringify(mappingData, null, 2));
    logger.mappingSaved(targetPath);
    logger.info('You can edit this file manually to customize your semantic layer');
  }

  /**
   * Load semantic mapping from file
   */
  private async loadMappingFromFile(filePath?: string): Promise<SemanticMapping> {
    const targetPath = filePath || this.getDefaultMappingPath();
    
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Semantic mapping file not found: ${targetPath}`);
    }
    
    const fileContent = fs.readFileSync(targetPath, 'utf8');
    const mapping = JSON.parse(fileContent);
    
    // Validate the mapping against current schema
    const schema = await this.dbProvider.discoverSchema();
    const validation = this.validateLayer(mapping, schema);
    
    if (!validation.isValid) {
      console.error('❌ Semantic mapping validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Semantic mapping contains invalid references');
    }
    
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Semantic mapping warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    console.log(`📂 Semantic mapping loaded from: ${targetPath} (${validation.confidence}% confidence)`);
    return mapping;
  }

  /**
   * Load user-defined semantic mapping
   */
  async loadSemanticMapping(mapping: SemanticMapping, filePath?: string): Promise<void> {
    this.semanticMapping = mapping;
    
    // Validate mapping against actual database schema
    await this.validateMapping();
    
    // Cache the mapping
    await this.cache.set('semantic_mapping', mapping);
    
    // Save to file
    await this.saveMappingToFile(mapping, filePath);
    
    logger.mappingLoaded(mapping.entities.length);
  }

  /**
   * Load semantic mapping without database validation (for read-only operations)
   */
  loadSemanticMappingWithoutValidation(mapping: SemanticMapping): void {
    this.semanticMapping = mapping;
    logger.mappingLoaded(mapping.entities.length);
  }

  /**
   * Auto-create intelligent semantic mapping from database schema with advanced business logic detection
   */
  async createMappingFromSchema(): Promise<SemanticMapping> {
    logger.creatingMapping();
    
    try {
      // Get database schema
      const schema = await this.dbProvider.discoverSchema();
      const totalColumns = schema.tables.reduce((sum, t) => sum + t.columns.length, 0);
      logger.info(`Schema discovered: ${schema.tables.length} tables, ${totalColumns} columns`);
      
      // Advanced business logic analysis
      logger.analyzingPatterns();
      const businessAnalysis = this.businessLogicDetector.detectBusinessLogic(schema);
      
      // Advanced business entity detection
      logger.info('Performing advanced business entity detection...');
      const businessEntities = this.detectAdvancedBusinessEntities(schema, businessAnalysis);
      
      // Advanced relationship analysis
      logger.info('Performing advanced relationship analysis...');
      const advancedRelationships = this.analyzeAdvancedRelationships(schema, businessAnalysis);
      
      // Log comprehensive business insights
      if (businessAnalysis.businessDomain !== 'general') {
        console.log(`🏢 Detected business domain: ${businessAnalysis.businessDomain} (confidence: ${(businessAnalysis.confidence * 100).toFixed(1)}%)`);
      }
      
      if (businessEntities.length > 0) {
        console.log(`🏢 Detected ${businessEntities.length} advanced business entities`);
        businessEntities.forEach(entity => {
          console.log(`  - ${entity.name}: ${entity.description} (${entity.entityType})`);
        });
      }
      
      if (advancedRelationships.length > 0) {
        console.log(`🔗 Detected ${advancedRelationships.length} advanced relationships`);
        advancedRelationships.forEach(rel => {
          console.log(`  - ${rel.fromEntity} → ${rel.toEntity}: ${rel.relationshipType} (${rel.businessPurpose})`);
        });
      }
      
      if (businessAnalysis.detectedCalculations.length > 0) {
        console.log(`💰 Detected ${businessAnalysis.detectedCalculations.length} business calculations`);
        businessAnalysis.detectedCalculations.forEach(calc => {
          console.log(`  - ${calc.name}: ${calc.description}`);
        });
      }
      
      if (businessAnalysis.detectedStatuses.length > 0) {
        console.log(`📊 Detected ${businessAnalysis.detectedStatuses.length} status patterns`);
        businessAnalysis.detectedStatuses.forEach(status => {
          console.log(`  - ${status.name}: ${status.description}`);
        });
      }
      
      // Create enhanced mapping with advanced business logic
      const mapping = this.createConservativeMapping(schema);
      
      // Enhance mapping with advanced business logic insights and relationships
      const enhancedMapping = this.enhanceMappingWithAdvancedBusinessLogic(
        mapping, 
        businessAnalysis, 
        businessEntities, 
        advancedRelationships
      );
      
      // Map advanced relationships to individual entities
      const finalMapping = this.mapAdvancedRelationshipsToEntities(
        enhancedMapping, 
        schema, 
        businessAnalysis, 
        businessEntities, 
        advancedRelationships
      );
      
      // Save mapping
      await this.saveMappingToFile(finalMapping);
      
      logger.mappingGenerated();
      return finalMapping;
      
    } catch (error) {
      console.error('❌ Error creating semantic mapping:', error);
      throw error;
    }
  }

  /**
   * Detect advanced business entities with comprehensive analysis
   */
  private detectAdvancedBusinessEntities(schema: DatabaseSchema, businessAnalysis: BusinessLogicAnalysis): any[] {
    const entities: any[] = [];
    
    for (const table of schema.tables) {
      const entity = this.createAdvancedBusinessEntity(table, businessAnalysis);
      if (entity) {
        entities.push(entity);
      }
    }
    
    return entities;
  }

  /**
   * Create advanced business entity with comprehensive metadata
   */
  private createAdvancedBusinessEntity(table: any, businessAnalysis: BusinessLogicAnalysis): any {
    const entityType = this.determineEntityType(table.name, table.columns, businessAnalysis);
    const businessPurpose = this.determineBusinessPurpose(table.name, businessAnalysis);
    const lifecycle = this.determineEntityLifecycle(table.name, table.columns);
    const businessRules = this.extractBusinessRules(table, businessAnalysis);
    
    return {
      name: this.generateEntityName(table.name),
      description: this.generateEntityDescription(table.name, entityType, businessPurpose),
      databaseTable: table.name,
      entityType,
      businessPurpose,
      lifecycle,
      businessRules,
      attributes: this.generateAdvancedAttributes(table.columns, businessAnalysis),
      relationships: [],
      metadata: {
        tableSize: table.columns.length,
        hasPrimaryKey: table.columns.some((c: any) => c.isPrimaryKey),
        hasForeignKeys: table.columns.some((c: any) => c.isForeignKey),
        businessDomain: businessAnalysis.businessDomain,
        confidence: businessAnalysis.confidence
      }
    };
  }

  /**
   * Analyze advanced relationships with business context
   */
  private analyzeAdvancedRelationships(schema: DatabaseSchema, businessAnalysis: BusinessLogicAnalysis): any[] {
    const relationships: any[] = [];
    
    // Analyze foreign key relationships
    for (const table of schema.tables) {
      for (const column of table.columns) {
        if (column.isForeignKey && column.foreignKeyInfo) {
          const relationship = this.createAdvancedRelationship(table, column, businessAnalysis);
          if (relationship) {
            relationships.push(relationship);
          }
        }
      }
    }
    
    // Analyze business logic relationships
    for (const calc of businessAnalysis.detectedCalculations) {
      const businessRelationship = this.createBusinessLogicRelationship(calc, businessAnalysis);
      if (businessRelationship) {
        relationships.push(businessRelationship);
      }
    }
    
    return relationships;
  }

  /**
   * Create advanced relationship with business context
   */
  private createAdvancedRelationship(table: any, column: any, businessAnalysis: BusinessLogicAnalysis): any {
    const targetTable = column.foreignKeyInfo.referencedTable;
    const relationshipType = this.determineAdvancedRelationshipType(table, column);
    const businessPurpose = this.determineRelationshipBusinessPurpose(table.name, targetTable, column.name, businessAnalysis);
    const constraints = this.generateRelationshipConstraints(table, column);
    const businessRules = this.generateRelationshipBusinessRules(table, column, businessAnalysis);
    
    return {
      fromEntity: table.name,
      toEntity: targetTable,
      relationshipType,
      cardinality: column.isUnique ? '1:1' : '1:N',
      businessPurpose,
      constraints,
      businessRules,
      joinCondition: `${table.name}.${column.name} = ${targetTable}.${column.foreignKeyInfo.referencedColumn}`,
      metadata: {
        isRequired: !column.isNullable,
        isUnique: column.isUnique,
        cascadeDelete: this.determineCascadeBehavior(column),
        businessDomain: businessAnalysis.businessDomain
      }
    };
  }

  /**
   * Enhance mapping with advanced business logic
   */
  private enhanceMappingWithAdvancedBusinessLogic(
    mapping: SemanticMapping, 
    businessAnalysis: BusinessLogicAnalysis,
    businessEntities: any[],
    advancedRelationships: any[]
  ): SemanticMapping {
    const enhancedMapping = { ...mapping };
    
    // Add advanced business logic metadata
    (enhancedMapping.metadata as any) = {
      ...enhancedMapping.metadata,
      description: `${enhancedMapping.metadata.description} with advanced business intelligence (${businessAnalysis.businessDomain} domain, ${(businessAnalysis.confidence * 100).toFixed(1)}% confidence)`,
      advancedBusinessInsights: {
        domain: businessAnalysis.businessDomain,
        confidence: businessAnalysis.confidence,
        businessEntities: businessEntities.length,
        advancedRelationships: advancedRelationships.length,
        calculations: businessAnalysis.detectedCalculations.length,
        statuses: businessAnalysis.detectedStatuses.length,
        relationships: businessAnalysis.detectedRelationships.length,
        details: {
          businessEntities: businessEntities.map(entity => ({
            name: entity.name,
            entityType: entity.entityType,
            businessPurpose: entity.businessPurpose,
            lifecycle: entity.lifecycle
          })),
          advancedRelationships: advancedRelationships.map(rel => ({
            fromEntity: rel.fromEntity,
            toEntity: rel.toEntity,
            relationshipType: rel.relationshipType,
            businessPurpose: rel.businessPurpose,
            constraints: rel.constraints
          })),
          calculations: businessAnalysis.detectedCalculations.map(calc => ({
            name: calc.name,
            description: calc.description,
            business_purpose: calc.business_purpose,
            formula: calc.formula
          })),
          statuses: businessAnalysis.detectedStatuses.map(status => ({
            name: status.name,
            description: status.description,
            business_purpose: status.business_purpose,
            condition: status.condition
          })),
          relationships: businessAnalysis.detectedRelationships.map(rel => ({
            type: rel.type,
            description: rel.description,
            business_purpose: rel.business_purpose
          }))
        }
      }
    };
    
    // Enhance entities with advanced business logic
    enhancedMapping.entities = enhancedMapping.entities.map(entity => {
      const businessEntity = businessEntities.find(be => be.databaseTable === entity.databaseTable);
      if (businessEntity) {
        return {
          ...entity,
          ...businessEntity,
          attributes: this.enhanceAttributesWithBusinessLogic(entity.attributes, businessAnalysis)
        };
      }
      return entity;
    });
    
    return enhancedMapping;
  }

  /**
   * Map advanced relationships to entities
   */
  private mapAdvancedRelationshipsToEntities(
    mapping: SemanticMapping, 
    schema: DatabaseSchema, 
    businessAnalysis: BusinessLogicAnalysis,
    businessEntities: any[],
    advancedRelationships: any[]
  ): SemanticMapping {
    const enhancedMapping = { ...mapping };
    
    // Create a map of table names to entities for quick lookup
    const entityMap = new Map<string, any>();
    enhancedMapping.entities.forEach(entity => {
      entityMap.set(entity.databaseTable, entity);
    });
    
    // Process advanced relationships
    for (const table of schema.tables) {
      const entity = entityMap.get(table.name);
      if (!entity) continue;
      
      const relationships: any[] = [];
      
      // Add advanced relationships
      for (const rel of advancedRelationships) {
        if (rel.fromEntity === table.name) {
          const targetEntity = entityMap.get(rel.toEntity);
          if (targetEntity) {
            relationships.push({
              name: `${entity.name}_${targetEntity.name}`,
              description: rel.businessPurpose,
              type: rel.relationshipType,
              fromEntity: entity.name,
              toEntity: targetEntity.name,
              fromAttribute: this.generateAttributeName(rel.fromEntity),
              toAttribute: this.generateAttributeName(rel.toEntity),
              joinCondition: rel.joinCondition,
              businessRules: rel.businessRules,
              metadata: rel.metadata
            });
          }
        }
      }
      
      // Add detected relationships from business analysis
      for (const rel of businessAnalysis.detectedRelationships) {
        if (rel.table === table.name) {
          const targetEntity = entityMap.get(rel.to_table || '');
          if (targetEntity) {
            relationships.push({
              name: rel.field_name || `${entity.name}_${targetEntity.name}`,
              description: rel.description,
              type: rel.relationship_type || 'one-to-many',
              fromEntity: entity.name,
              toEntity: targetEntity.name,
              fromAttribute: rel.from_column || '',
              toAttribute: rel.to_column || '',
              joinCondition: `${rel.from_table}.${rel.from_column} = ${rel.to_table}.${rel.to_column}`,
              businessPurpose: rel.business_purpose
            });
          }
        }
      }
      
      // Update entity with relationships
      entity.relationships = relationships;
    }
    
    return enhancedMapping;
  }

  /**
   * Map detected relationships to individual entities
   */
  private mapRelationshipsToEntities(mapping: SemanticMapping, schema: DatabaseSchema, businessAnalysis: BusinessLogicAnalysis): SemanticMapping {
    const enhancedMapping = { ...mapping };
    
    // Create a map of table names to entities for quick lookup
    const entityMap = new Map<string, any>();
    enhancedMapping.entities.forEach(entity => {
      entityMap.set(entity.databaseTable, entity);
    });
    
    // Process foreign key relationships
    for (const table of schema.tables) {
      const entity = entityMap.get(table.name);
      if (!entity) continue;
      
      const relationships: any[] = [];
      
      // Check each column for foreign keys
      for (const column of table.columns) {
        if (column.isForeignKey && column.foreignKeyInfo) {
          const targetEntity = entityMap.get(column.foreignKeyInfo.referencedTable);
          if (targetEntity) {
            // Determine relationship type based on column name patterns
            const relationshipType = this.determineRelationshipType(column.name, table.name, column.foreignKeyInfo.referencedTable);
            const relationshipName = this.generateRelationshipName(column.name, table.name, column.foreignKeyInfo.referencedTable);
            
            relationships.push({
              name: relationshipName,
              description: `${entity.name} is linked to ${targetEntity.name} through ${column.name}`,
              type: relationshipType,
              fromEntity: entity.name,
              toEntity: targetEntity.name,
              fromAttribute: this.generateAttributeName(column.name),
              toAttribute: 'ID', // Assuming primary key is named 'ID'
              joinCondition: `${table.name}.${column.name} = ${column.foreignKeyInfo.referencedTable}.${column.foreignKeyInfo.referencedColumn}`
            });
          }
        }
      }
      
      // Add detected relationships from business analysis
      for (const rel of businessAnalysis.detectedRelationships) {
        if (rel.table === table.name) {
          const targetEntity = entityMap.get(rel.to_table || '');
          if (targetEntity) {
            relationships.push({
              name: rel.field_name || `${entity.name}_${targetEntity.name}`,
              description: rel.description,
              type: rel.relationship_type || 'one-to-many',
              fromEntity: entity.name,
              toEntity: targetEntity.name,
              fromAttribute: rel.from_column || '',
              toAttribute: rel.to_column || '',
              joinCondition: `${rel.from_table}.${rel.from_column} = ${rel.to_table}.${rel.to_column}`
            });
          }
        }
      }
      
      // Update entity with relationships
      entity.relationships = relationships;
    }
    
    return enhancedMapping;
  }

  /**
   * Determine relationship type based on naming patterns
   */
  private determineRelationshipType(columnName: string, fromTable: string, toTable: string): 'one-to-one' | 'one-to-many' | 'many-to-many' {
    const lowerColumn = columnName.toLowerCase();
    const lowerFromTable = fromTable.toLowerCase();
    const lowerToTable = toTable.toLowerCase();
    
    // Check for many-to-many patterns
    if (lowerFromTable.includes('junction') || lowerFromTable.includes('bridge') || 
        lowerFromTable.includes('mapping') || lowerFromTable.includes('link')) {
      return 'many-to-many';
    }
    
    // Check for one-to-one patterns (usually with 'id' suffix)
    if (lowerColumn.endsWith('_id') && !lowerColumn.includes('_ids')) {
      return 'one-to-many'; // Foreign key typically indicates one-to-many
    }
    
    // Default to one-to-many for foreign keys
    return 'one-to-many';
  }

  /**
   * Generate relationship name based on tables and column
   */
  private generateRelationshipName(columnName: string, fromTable: string, toTable: string): string {
    const fromEntity = this.generateEntityName(fromTable);
    const toEntity = this.generateEntityName(toTable);
    
    // Remove common suffixes
    const cleanColumn = columnName.replace(/_id$/, '').replace(/_fk$/, '');
    
    // Generate meaningful name
    if (cleanColumn === fromTable.replace(/s$/, '')) {
      return `${toEntity}Collection`; // e.g., "VehicleCollection" for vehicles.vehicle_id
    }
    
    if (cleanColumn === toTable.replace(/s$/, '')) {
      return `${toEntity}Reference`; // e.g., "VehicleReference" for trips.vehicle_id
    }
    
    // Use column name as relationship name
    return this.generateAttributeName(cleanColumn);
  }

  /**
   * Enhance mapping with business logic insights
   */
  private enhanceMappingWithBusinessLogic(mapping: SemanticMapping, businessAnalysis: BusinessLogicAnalysis): SemanticMapping {
    const enhancedMapping = { ...mapping };
    
    // Add business logic metadata
    (enhancedMapping.metadata as any) = {
      ...enhancedMapping.metadata,
      description: `${enhancedMapping.metadata.description} with business intelligence (${businessAnalysis.businessDomain} domain, ${(businessAnalysis.confidence * 100).toFixed(1)}% confidence)`,
      businessInsights: {
        domain: businessAnalysis.businessDomain,
        confidence: businessAnalysis.confidence,
        calculations: businessAnalysis.detectedCalculations.length,
        statuses: businessAnalysis.detectedStatuses.length,
        relationships: businessAnalysis.detectedRelationships.length,
        details: {
          calculations: businessAnalysis.detectedCalculations.map(calc => ({
            name: calc.name,
            description: calc.description,
            business_purpose: calc.business_purpose,
            formula: calc.formula
          })),
          statuses: businessAnalysis.detectedStatuses.map(status => ({
            name: status.name,
            description: status.description,
            business_purpose: status.business_purpose,
            condition: status.condition
          })),
          relationships: businessAnalysis.detectedRelationships.map(rel => ({
            type: rel.type,
            description: rel.description,
            business_purpose: rel.business_purpose
          }))
        }
      }
    };
    
    // Enhance entity descriptions with domain-specific context
    enhancedMapping.entities = enhancedMapping.entities.map(entity => {
      const enhancedEntity = { ...entity };
      
      // Add domain-specific context to entity description
      if (businessAnalysis.businessDomain !== 'general') {
        enhancedEntity.description = `${enhancedEntity.description} in ${businessAnalysis.businessDomain} domain`;
      }
      
      // Enhance attributes with business logic insights
      enhancedEntity.attributes = enhancedEntity.attributes.map(attr => {
        const enhancedAttr = { ...attr };
        
        // Check if this attribute is part of a detected calculation
        const relatedCalculation = businessAnalysis.detectedCalculations.find(calc => 
          calc.pattern.some(pattern => attr.databaseColumn.toLowerCase().includes(pattern))
        );
        
        if (relatedCalculation) {
          (enhancedAttr.metadata as any) = {
            ...enhancedAttr.metadata,
            businessLogic: {
              calculation: relatedCalculation.name,
              business_purpose: relatedCalculation.business_purpose,
              formula: relatedCalculation.formula
            }
          };
        }
        
        // Check if this attribute is part of a detected status
        const relatedStatus = businessAnalysis.detectedStatuses.find(status => 
          status.pattern.some(pattern => attr.databaseColumn.toLowerCase().includes(pattern))
        );
        
        if (relatedStatus) {
          (enhancedAttr.metadata as any) = {
            ...enhancedAttr.metadata,
            businessLogic: {
              status: relatedStatus.name,
              business_purpose: relatedStatus.business_purpose,
              condition: relatedStatus.condition
            }
          };
        }
        
        // Enhance description with domain-specific context
        enhancedAttr.description = this.generateDomainSpecificDescription(attr.databaseColumn, businessAnalysis.businessDomain);
        
        return enhancedAttr;
      });
      
      return enhancedEntity;
    });
    
    return enhancedMapping;
  }

  /**
   * Generate domain-specific descriptions for attributes
   */
  private generateDomainSpecificDescription(columnName: string, domain: string): string {
    const lowerColumn = columnName.toLowerCase();
    const lowerDomain = domain.toLowerCase();
    
    // Universal domain-agnostic descriptions that work for everyone
    if (lowerColumn.includes('id')) {
      if (lowerColumn.includes('user')) return 'Unique identifier for user account';
      if (lowerColumn.includes('customer')) return 'Unique identifier for customer record';
      if (lowerColumn.includes('order')) return 'Unique identifier for order transaction';
      if (lowerColumn.includes('product')) return 'Unique identifier for product item';
      if (lowerColumn.includes('vehicle')) return 'Unique identifier for vehicle asset';
      if (lowerColumn.includes('driver')) return 'Unique identifier for driver record';
      if (lowerColumn.includes('trip')) return 'Unique identifier for trip/journey';
      if (lowerColumn.includes('maintenance')) return 'Unique identifier for maintenance record';
      if (lowerColumn.includes('payment')) return 'Unique identifier for payment transaction';
      if (lowerColumn.includes('invoice')) return 'Unique identifier for invoice document';
      if (lowerColumn.includes('employee')) return 'Unique identifier for employee record';
      if (lowerColumn.includes('department')) return 'Unique identifier for department';
      return 'Primary identifier for database record';
    }
    
    if (lowerColumn.includes('name')) {
      if (lowerColumn.includes('user')) return 'User account name or username';
      if (lowerColumn.includes('customer')) return 'Customer full name or business name';
      if (lowerColumn.includes('product')) return 'Product name or title';
      if (lowerColumn.includes('vehicle')) return 'Vehicle name or model designation';
      if (lowerColumn.includes('driver')) return 'Driver full name';
      if (lowerColumn.includes('employee')) return 'Employee full name';
      if (lowerColumn.includes('department')) return 'Department name';
      return 'Human-readable identifier or title';
    }
    
    if (lowerColumn.includes('description')) return 'Detailed information or explanation';
    
    if (lowerColumn.includes('status')) {
      if (lowerColumn.includes('order')) return 'Current order processing status';
      if (lowerColumn.includes('payment')) return 'Payment processing status';
      if (lowerColumn.includes('vehicle')) return 'Vehicle operational status';
      if (lowerColumn.includes('driver')) return 'Driver availability status';
      if (lowerColumn.includes('user')) return 'User account status';
      if (lowerColumn.includes('maintenance')) return 'Maintenance completion status';
      return 'Current state or condition indicator';
    }
    
    if (lowerColumn.includes('date') || lowerColumn.includes('time')) {
      if (lowerColumn.includes('created')) return 'Record creation timestamp';
      if (lowerColumn.includes('updated')) return 'Record last update timestamp';
      if (lowerColumn.includes('start')) return 'Start time for activity or period';
      if (lowerColumn.includes('end')) return 'End time for activity or period';
      if (lowerColumn.includes('due')) return 'Due date for task or payment';
      if (lowerColumn.includes('expiry')) return 'Expiration date for license or subscription';
      if (lowerColumn.includes('birth')) return 'Date of birth';
      if (lowerColumn.includes('hire')) return 'Employment hire date';
      return 'Temporal information for tracking and scheduling';
    }
    
    if (lowerColumn.includes('email')) return 'Electronic mail address for communication';
    if (lowerColumn.includes('phone')) return 'Telephone contact information';
    if (lowerColumn.includes('address')) return 'Physical location or contact address';
    
    if (lowerColumn.includes('amount') || lowerColumn.includes('price') || lowerColumn.includes('cost')) {
      if (lowerColumn.includes('total')) return 'Total monetary value including all charges';
      if (lowerColumn.includes('subtotal')) return 'Subtotal before taxes and fees';
      if (lowerColumn.includes('tax')) return 'Tax amount for transaction';
      if (lowerColumn.includes('shipping')) return 'Shipping or delivery cost';
      if (lowerColumn.includes('discount')) return 'Discount amount applied';
      if (lowerColumn.includes('salary')) return 'Employee salary amount';
      if (lowerColumn.includes('maintenance')) return 'Maintenance service cost';
      return 'Monetary value for financial calculations';
    }
    
    if (lowerColumn.includes('quantity') || lowerColumn.includes('count')) {
      if (lowerColumn.includes('stock')) return 'Available inventory quantity';
      if (lowerColumn.includes('order')) return 'Ordered item quantity';
      if (lowerColumn.includes('mileage')) return 'Distance traveled in miles/kilometers';
      if (lowerColumn.includes('distance')) return 'Distance measurement';
      return 'Numeric value for inventory or measurement';
    }
    
    // Domain-specific patterns that work universally
    if (lowerColumn.includes('type')) return 'Classification or category type';
    if (lowerColumn.includes('category')) return 'Grouping or classification category';
    if (lowerColumn.includes('model')) return 'Specific model or version designation';
    if (lowerColumn.includes('make')) return 'Manufacturer or brand name';
    if (lowerColumn.includes('year')) return 'Year value (manufacturing, creation, etc.)';
    if (lowerColumn.includes('license')) return 'License number or permit identifier';
    if (lowerColumn.includes('vin')) return 'Vehicle Identification Number';
    if (lowerColumn.includes('mileage')) return 'Distance measurement for vehicles or equipment';
    if (lowerColumn.includes('fuel')) return 'Fuel level or fuel type information';
    if (lowerColumn.includes('maintenance')) return 'Maintenance-related information';
    if (lowerColumn.includes('trip')) return 'Trip or journey-related information';
    if (lowerColumn.includes('driver')) return 'Driver-related information';
    if (lowerColumn.includes('vehicle')) return 'Vehicle-related information';
    if (lowerColumn.includes('employee')) return 'Employee-related information';
    if (lowerColumn.includes('department')) return 'Department-related information';
    if (lowerColumn.includes('customer')) return 'Customer-related information';
    if (lowerColumn.includes('order')) return 'Order-related information';
    if (lowerColumn.includes('product')) return 'Product-related information';
    if (lowerColumn.includes('payment')) return 'Payment-related information';
    if (lowerColumn.includes('invoice')) return 'Invoice-related information';
    if (lowerColumn.includes('user')) return 'User-related information';
    
    // Default description that works for any domain
    return `Data field for ${columnName} in ${domain} domain`;
  }

  /**
   * Detect relationships between tables
   */
  private detectRelationships(schema: DatabaseSchema): any[] {
    const relationships: any[] = [];
    
    for (const table of schema.tables) {
      for (const column of table.columns) {
        if (column.isForeignKey && column.foreignKeyInfo) {
          relationships.push({
            sourceTable: table.name,
            sourceColumn: column.name,
            targetTable: column.foreignKeyInfo.referencedTable,
            targetColumn: column.foreignKeyInfo.referencedColumn,
            type: 'foreign_key',
            description: `References ${column.foreignKeyInfo.referencedTable}.${column.foreignKeyInfo.referencedColumn}`
          });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Create conservative mapping using pattern matching
   */
  private createConservativeMapping(schema: DatabaseSchema): SemanticMapping {
    const entities: SemanticEntity[] = [];
    
    for (const table of schema.tables) {
      const entityName = PatternMatcher.getEntityName(table.name);
      const attributes: SemanticAttribute[] = [];
      
      for (const column of table.columns) {
        const attributeName = PatternMatcher.getAttributeName(column.name);
                 attributes.push({
           name: attributeName,
           description: `Attribute for ${column.name}`,
           databaseColumn: column.name,
           dataType: this.mapDataType(column.type),
           isRequired: !column.nullable,
           isPrimaryKey: column.isPrimaryKey
         });
      }
      
      entities.push({
        name: entityName,
        description: `Entity representing ${table.name}`,
        databaseTable: table.name,
        attributes,
        relationships: []
      });
    }
    
         return {
       entities,
       metadata: {
         version: '1.0',
         createdAt: new Date(),
         updatedAt: new Date(),
         description: 'Semantic layer generated using pattern matching'
       }
     };
  }

  /**
   * Load semantic mapping from file (public method)
   */
  async loadMappingFromFilePath(filePath?: string): Promise<void> {
    const mapping = await this.loadMappingFromFile(filePath);
    await this.loadSemanticMapping(mapping, filePath);
  }

  /**
   * Get the path where the current mapping is stored
   */
  getMappingFilePath(): string {
    return this.getDefaultMappingPath();
  }

  /**
   * Build context string for applications with semantic mapping
   */
  buildSemanticContext(): string {
    if (!this.semanticMapping) return '';

    let context = 'Available semantic entities:\n\n';
    
    for (const entity of this.semanticMapping.entities) {
      context += `Entity: ${entity.name}\n`;
      context += `Description: ${entity.description}\n`;
      context += `Database Table: ${entity.databaseTable}\n`;
      context += 'Attributes:\n';
      
      for (const attr of entity.attributes) {
        context += `  - ${attr.name}: ${attr.description} (${attr.dataType})\n`;
      }
      
      if (entity.relationships.length > 0) {
        context += 'Relationships:\n';
        for (const rel of entity.relationships) {
          context += `  - ${rel.name}: ${rel.description} (${rel.type})\n`;
        }
      }
      
      context += '\n';
    }

    return context;
  }

  /**
   * Validate semantic mapping against actual database
   */
  async validateMapping(): Promise<void> {
    if (!this.semanticMapping) return;

    const schema = await this.dbProvider.discoverSchema();
    const errors: string[] = [];

    for (const entity of this.semanticMapping.entities) {
      // Check if table exists
      const table = schema.tables.find(t => t.name === entity.databaseTable);
      if (!table) {
        errors.push(`Table '${entity.databaseTable}' not found in database for entity '${entity.name}'`);
        continue;
      }

      // Check if columns exist
      for (const attr of entity.attributes) {
        const column = table.columns.find(c => c.name === attr.databaseColumn);
        if (!column) {
          errors.push(`Column '${attr.databaseColumn}' not found in table '${entity.databaseTable}' for attribute '${attr.name}'`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Semantic mapping validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Generate entity name from table name
   */
  private generateEntityName(tableName: string): string {
    return PatternMatcher.getEntityName(tableName);
  }

  /**
   * Generate attribute name from column name
   */
  private generateAttributeName(columnName: string): string {
    return PatternMatcher.getAttributeName(columnName);
  }

  /**
   * Map database data type to semantic data type
   */
  private mapDataType(dbType: string): 'string' | 'number' | 'date' | 'boolean' | 'json' {
    const type = dbType.toLowerCase();
    
    if (type.includes('int') || type.includes('float') || type.includes('decimal') || type.includes('numeric')) {
      return 'number';
    }
    if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
      return 'date';
    }
    if (type.includes('bool')) {
      return 'boolean';
    }
    if (type.includes('json')) {
      return 'json';
    }
    
    return 'string';
  }

  /**
   * Get current semantic mapping
   */
  getSemanticMapping(): SemanticMapping | null {
    return this.semanticMapping;
  }

  /**
   * Export current semantic mapping
   */
  exportMapping(): string {
    return this.semanticMapping ? JSON.stringify(this.semanticMapping, null, 2) : '{}';
  }

  /**
   * Validate layer against schema
   */
  private validateLayer(mapping: SemanticMapping, schema: DatabaseSchema): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    confidence: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check entities
    for (const entity of mapping.entities) {
      const table = schema.tables.find(t => t.name === entity.databaseTable);
      if (!table) {
        errors.push(`Entity '${entity.name}' references non-existent table '${entity.databaseTable}'`);
        continue;
      }
      
      // Check attributes
      for (const attr of entity.attributes) {
        const column = table.columns.find(c => c.name === attr.databaseColumn);
        if (!column) {
          errors.push(`Attribute '${attr.name}' references non-existent column '${attr.databaseColumn}' in table '${entity.databaseTable}'`);
        }
      }
    }
    
    // Calculate confidence
    const totalChecks = mapping.entities.length;
    const passedChecks = totalChecks - errors.length;
    const confidence = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      confidence: Math.round(confidence)
    };
  }

  /**
   * Search semantic layer using pattern matching (no AI required)
   */
  async searchSemanticLayer(query: string, limit: number = 5): Promise<any[]> {
    if (!this.semanticMapping) {
      throw new Error('No semantic mapping available');
    }

    const results: any[] = [];
    const queryLower = query.toLowerCase();

    // Search through entities and attributes using pattern matching
    for (const entity of this.semanticMapping.entities) {
      // Check entity name and description
      if (entity.name.toLowerCase().includes(queryLower) || 
          entity.description.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'entity',
          source: entity.name,
          description: entity.description,
          score: 0.9
        });
      }

      // Check attributes
      for (const attr of entity.attributes) {
        if (attr.name.toLowerCase().includes(queryLower) || 
            attr.description.toLowerCase().includes(queryLower)) {
          results.push({
            type: 'attribute',
            source: `${entity.name}.${attr.name}`,
            description: attr.description,
            entity: entity.name,
            score: 0.8
          });
        }
      }

      // Check relationships
      for (const rel of entity.relationships) {
        if (rel.name.toLowerCase().includes(queryLower) || 
            rel.description.toLowerCase().includes(queryLower)) {
          results.push({
            type: 'relationship',
            source: `${entity.name}.${rel.name}`,
            description: rel.description,
            entity: entity.name,
            score: 0.7
          });
        }
      }
    }

    // Sort by score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Advanced Business Logic Helper Methods

  private determineEntityType(tableName: string, columns: any[], businessAnalysis: any): string {
    const tableNameLower = tableName.toLowerCase();
    
    // Domain-specific entity types
    if (businessAnalysis.businessDomain === 'ecommerce') {
      if (tableNameLower.includes('product')) return 'Product';
      if (tableNameLower.includes('order')) return 'Order';
      if (tableNameLower.includes('customer')) return 'Customer';
      if (tableNameLower.includes('category')) return 'Category';
    }
    
    if (businessAnalysis.businessDomain === 'saas') {
      if (tableNameLower.includes('user')) return 'User';
      if (tableNameLower.includes('subscription')) return 'Subscription';
      if (tableNameLower.includes('feature')) return 'Feature';
      if (tableNameLower.includes('billing')) return 'Billing';
    }
    
    // Generic entity types based on patterns
    if (tableNameLower.includes('log') || tableNameLower.includes('audit')) return 'Audit';
    if (tableNameLower.includes('config') || tableNameLower.includes('setting')) return 'Configuration';
    if (tableNameLower.includes('temp') || tableNameLower.includes('cache')) return 'Temporary';
    
    return 'Business Entity';
  }

  private determineBusinessPurpose(tableName: string, businessAnalysis: any): string {
    const tableNameLower = tableName.toLowerCase();
    
    if (tableNameLower.includes('user')) return 'User management and authentication';
    if (tableNameLower.includes('customer')) return 'Customer relationship management';
    if (tableNameLower.includes('order')) return 'Order processing and fulfillment';
    if (tableNameLower.includes('product')) return 'Product catalog and inventory management';
    if (tableNameLower.includes('payment')) return 'Financial transaction processing';
    if (tableNameLower.includes('audit')) return 'Audit trail and compliance tracking';
    if (tableNameLower.includes('log')) return 'System logging and monitoring';
    
    return 'Business process management';
  }

  private determineEntityLifecycle(tableName: string, columns: any[]): string {
    const hasCreatedAt = columns.some((c: any) => c.name.toLowerCase().includes('created'));
    const hasUpdatedAt = columns.some((c: any) => c.name.toLowerCase().includes('updated'));
    const hasDeletedAt = columns.some((c: any) => c.name.toLowerCase().includes('deleted'));
    
    if (hasCreatedAt && hasUpdatedAt && hasDeletedAt) return 'Full Lifecycle';
    if (hasCreatedAt && hasUpdatedAt) return 'Creation and Updates';
    if (hasCreatedAt) return 'Creation Only';
    
    return 'Static';
  }

  private extractBusinessRules(table: any, businessAnalysis: any): any[] {
    const rules: any[] = [];
    
    // Extract validation rules from column constraints
    for (const column of table.columns) {
      if (!column.isNullable) {
        rules.push({
          type: 'validation',
          description: `${column.name} is required`,
          condition: `${table.name}.${column.name} IS NOT NULL`
        });
      }
      
      if (column.isUnique) {
        rules.push({
          type: 'uniqueness',
          description: `${column.name} must be unique`,
          condition: `${table.name}.${column.name} UNIQUE`
        });
      }
    }
    
    return rules;
  }

  private generateEntityDescription(tableName: string, entityType: string, businessPurpose: string): string {
    return `${entityType} representing ${tableName} for ${businessPurpose}`;
  }

  private generateAdvancedAttributes(columns: any[], businessAnalysis: any): any[] {
    return columns.map(column => ({
      name: this.generateAttributeName(column.name),
      description: this.generateDomainSpecificDescription(column.name, businessAnalysis.businessDomain),
      databaseColumn: column.name,
      dataType: column.type,
      isNullable: column.isNullable,
      isPrimaryKey: column.isPrimaryKey,
      isForeignKey: column.isForeignKey,
      businessPurpose: this.determineAttributeBusinessPurpose(column.name, businessAnalysis),
      metadata: {
        columnType: column.type,
        constraints: this.extractColumnConstraints(column)
      }
    }));
  }

  private determineAttributeBusinessPurpose(columnName: string, businessAnalysis: any): string {
    const columnNameLower = columnName.toLowerCase();
    
    if (columnNameLower.includes('id')) return 'Unique identifier';
    if (columnNameLower.includes('name')) return 'Display name';
    if (columnNameLower.includes('email')) return 'Contact information';
    if (columnNameLower.includes('phone')) return 'Contact information';
    if (columnNameLower.includes('address')) return 'Location information';
    if (columnNameLower.includes('created')) return 'Audit timestamp';
    if (columnNameLower.includes('updated')) return 'Audit timestamp';
    if (columnNameLower.includes('status')) return 'State management';
    
    return 'Business data';
  }

  private extractColumnConstraints(column: any): any[] {
    const constraints: any[] = [];
    
    if (!column.isNullable) constraints.push('NOT NULL');
    if (column.isUnique) constraints.push('UNIQUE');
    if (column.isPrimaryKey) constraints.push('PRIMARY KEY');
    if (column.isForeignKey) constraints.push('FOREIGN KEY');
    if (column.defaultValue) constraints.push(`DEFAULT ${column.defaultValue}`);
    
    return constraints;
  }

  private createBusinessLogicRelationship(calc: any, businessAnalysis: any): any {
    return {
      fromEntity: calc.table,
      toEntity: 'calculated',
      relationshipType: 'calculation',
      businessPurpose: calc.business_purpose,
      formula: calc.formula,
      metadata: {
        calculationType: calc.type,
        confidence: calc.confidence
      }
    };
  }

  private determineAdvancedRelationshipType(table: any, column: any): string {
    if (column.isUnique) return 'one-to-one';
    
    // Check for many-to-many patterns
    const hasReverseFK = table.columns.some((c: any) => 
      c.isForeignKey && c.foreignKeyInfo?.referencedTable === column.foreignKeyInfo.referencedTable
    );
    
    if (hasReverseFK) return 'many-to-many';
    
    return 'one-to-many';
  }

  private determineRelationshipBusinessPurpose(fromTable: string, toTable: string, column: string, businessAnalysis: any): string {
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

  private generateRelationshipConstraints(table: any, column: any): any[] {
    const constraints: any[] = [];
    
    if (!column.isNullable) constraints.push('NOT NULL');
    if (column.isUnique) constraints.push('UNIQUE');
    
    return constraints;
  }

  private generateRelationshipBusinessRules(table: any, column: any, businessAnalysis: any): any[] {
    const rules: any[] = [];
    
    // Foreign key integrity rule
    rules.push({
      type: 'integrity',
      description: `Ensure ${column.name} references valid ${column.foreignKeyInfo.referencedTable}`,
      condition: `${table.name}.${column.name} IN (SELECT ${column.foreignKeyInfo.referencedColumn} FROM ${column.foreignKeyInfo.referencedTable})`
    });
    
    return rules;
  }

  private determineCascadeBehavior(column: any): string {
    // This would be determined from actual foreign key constraints
    return 'RESTRICT'; // Default behavior
  }

  private enhanceAttributesWithBusinessLogic(attributes: any[], businessAnalysis: any): any[] {
    return attributes.map(attr => {
      const enhancedAttr = { ...attr };
      
      // Add business logic metadata
      const relatedCalculation = businessAnalysis.detectedCalculations.find((calc: any) => 
        calc.pattern.some((pattern: string) => attr.databaseColumn.toLowerCase().includes(pattern))
      );
      
      if (relatedCalculation) {
        (enhancedAttr.metadata as any) = {
          ...enhancedAttr.metadata,
          businessLogic: {
            calculation: relatedCalculation.name,
            business_purpose: relatedCalculation.business_purpose,
            formula: relatedCalculation.formula
          }
        };
      }
      
      return enhancedAttr;
    });
  }
}