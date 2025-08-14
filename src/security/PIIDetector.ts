import { logger } from '../utils/logger';
import * as crypto from 'crypto';

export interface PIIDetectionResult {
  column: string;
  table: string;
  piiType: PIIType;
  confidence: number;
  detectionMethod: DetectionMethod;
  riskLevel: RiskLevel;
  compliance: ComplianceRequirement[];
  sampleValues?: string[];
  patterns?: string[];
  metadata?: Record<string, string | number | boolean>;
}

export enum PIIType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  ADDRESS = 'address',
  NAME = 'name',
  DATE_OF_BIRTH = 'date_of_birth',
  DRIVERS_LICENSE = 'drivers_license',
  PASSPORT = 'passport',
  IP_ADDRESS = 'ip_address',
  MAC_ADDRESS = 'mac_address',
  VEHICLE_ID = 'vehicle_id',
  MEDICAL_ID = 'medical_id',
  FINANCIAL_ACCOUNT = 'financial_account',
  BIOMETRIC = 'biometric',
  LOCATION = 'location',
  BEHAVIORAL = 'behavioral'
}

export enum DetectionMethod {
  PATTERN_MATCHING = 'pattern_matching',
  SEMANTIC_ANALYSIS = 'semantic_analysis',
  DATA_PROFILING = 'data_profiling',
  ML_CLASSIFICATION = 'ml_classification',
  CONTEXT_ANALYSIS = 'context_analysis',
  HEURISTIC = 'heuristic'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ComplianceRequirement {
  regulation: string;
  requirement: string;
  severity: RiskLevel;
  description: string;
}

export interface PIIDetectionConfig {
  enableML: boolean;
  enableProfiling: boolean;
  enableSemanticAnalysis: boolean;
  confidenceThreshold: number;
  sampleSize: number;
  maxProcessingTime: number;
}

export interface DatabaseColumn {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isUnique?: boolean;
  defaultValue?: string;
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  rowCount?: number;
  schema?: string;
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
  version?: string;
  timestamp?: Date;
}

export class PIIDetector {
  private config: PIIDetectionConfig;
  private patterns: Map<PIIType, RegExp[]>;
  private semanticPatterns: Map<PIIType, string[]>;
  private complianceMap: Map<PIIType, ComplianceRequirement[]>;

  constructor(config: PIIDetectionConfig) {
    this.config = config;
    this.patterns = new Map();
    this.semanticPatterns = new Map();
    this.complianceMap = new Map();
    this.initializePatterns();
    this.initializeSemanticPatterns();
    this.initializeComplianceMap();
  }

  /**
   * Detect PII in database schema and sample data
   */
  async detectPII(schema: DatabaseSchema, sampleData?: Record<string, string[]>): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];
    const startTime = Date.now();

    try {
      for (const table of schema.tables || []) {
        for (const column of table.columns || []) {
          // Skip if processing time exceeded
          if (Date.now() - startTime > this.config.maxProcessingTime) {
            logger.warn('PII detection timeout reached');
            break;
          }

          const columnResults = await this.detectPIIInColumn(column, table, sampleData);
          results.push(...columnResults);
        }
      }

      // Remove duplicates and sort by confidence
      const uniqueResults = this.deduplicateResults(results);
      return uniqueResults.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      logger.error(`PII detection failed: ${error}`);
      return [];
    }
  }

  /**
   * Detect PII in a specific column using multiple detection methods
   */
  private async detectPIIInColumn(
    column: DatabaseColumn, 
    table: DatabaseTable, 
    sampleData?: Record<string, string[]>
  ): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];
    const columnName = column.name.toLowerCase();
    const tableName = table.name.toLowerCase();

    // 1. Pattern-based detection
    const patternResults = this.detectByPatterns(columnName, tableName, column);
    results.push(...patternResults);

    // 2. Semantic analysis
    if (this.config.enableSemanticAnalysis) {
      const semanticResults = this.detectBySemanticAnalysis(columnName, tableName, column);
      results.push(...semanticResults);
    }

    // 3. Data profiling
    if (this.config.enableProfiling && sampleData) {
      const profilingResults = await this.detectByDataProfiling(
        columnName, 
        tableName, 
        column, 
        sampleData
      );
      results.push(...profilingResults);
    }

    // 4. ML-based classification (if enabled)
    if (this.config.enableML) {
      const mlResults = await this.detectByML(columnName, tableName, column, sampleData);
      results.push(...mlResults);
    }

    // 5. Context analysis
    const contextResults = this.detectByContext(columnName, tableName, column, table);
    results.push(...contextResults);

    return results;
  }

  /**
   * Pattern-based PII detection using regex patterns
   */
  private detectByPatterns(columnName: string, tableName: string, column: DatabaseColumn): PIIDetectionResult[] {
    const results: PIIDetectionResult[] = [];

    for (const [piiType, patterns] of this.patterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(columnName)) {
          const confidence = this.calculatePatternConfidence(columnName, pattern, piiType);
          
          if (confidence >= this.config.confidenceThreshold) {
            results.push({
              column: column.name,
              table: tableName,
              piiType,
              confidence,
              detectionMethod: DetectionMethod.PATTERN_MATCHING,
              riskLevel: this.getRiskLevel(piiType),
              compliance: this.complianceMap.get(piiType) || [],
              patterns: [pattern.source],
              metadata: {
                pattern: pattern.source,
                columnType: column.type,
                nullable: column.isNullable
              }
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Semantic analysis-based PII detection
   */
  private detectBySemanticAnalysis(columnName: string, tableName: string, column: DatabaseColumn): PIIDetectionResult[] {
    const results: PIIDetectionResult[] = [];

    for (const [piiType, patterns] of this.semanticPatterns.entries()) {
      for (const pattern of patterns) {
        if (columnName.includes(pattern.toLowerCase())) {
          const confidence = this.calculateSemanticConfidence(columnName, pattern, piiType);
          
          if (confidence >= this.config.confidenceThreshold) {
            results.push({
              column: column.name,
              table: tableName,
              piiType,
              confidence,
              detectionMethod: DetectionMethod.SEMANTIC_ANALYSIS,
              riskLevel: this.getRiskLevel(piiType),
              compliance: this.complianceMap.get(piiType) || [],
              patterns: [pattern],
              metadata: {
                semanticPattern: pattern,
                columnType: column.type,
                tableContext: tableName
              }
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Data profiling-based PII detection
   */
  private async detectByDataProfiling(
    columnName: string, 
    tableName: string, 
    column: DatabaseColumn, 
    sampleData: Record<string, string[]>
  ): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];
    const data = sampleData[columnName] || [];

    if (data.length === 0) {
      return results;
    }

    // Analyze data patterns
    const dataProfile = this.analyzeDataProfile(data, column.type);
    
    for (const [piiType, patterns] of this.patterns.entries()) {
      const matchScore = this.calculateDataMatchScore(data, patterns, piiType);
      
      if (matchScore >= this.config.confidenceThreshold) {
        results.push({
          column: column.name,
          table: tableName,
          piiType,
          confidence: matchScore,
          detectionMethod: DetectionMethod.DATA_PROFILING,
          riskLevel: this.getRiskLevel(piiType),
          compliance: this.complianceMap.get(piiType) || [],
          sampleValues: this.getSampleValues(data, 5),
          metadata: {
            dataProfile,
            sampleSize: data.length,
            columnType: column.type
          }
        });
      }
    }

    return results;
  }

  /**
   * ML-based PII detection (placeholder implementation)
   */
  private async detectByML(
    columnName: string, 
    tableName: string, 
    column: DatabaseColumn, 
    sampleData?: Record<string, string[]>
  ): Promise<PIIDetectionResult[]> {
    // This would integrate with actual ML models
    // For now, return empty results
    return [];
  }

  /**
   * Context-based PII detection
   */
  private detectByContext(columnName: string, tableName: string, column: DatabaseColumn, table: DatabaseTable): PIIDetectionResult[] {
    const results: PIIDetectionResult[] = [];
    
    // Analyze table context
    const tableContext = this.analyzeTableContext(tableName, table);
    const columnContext = this.analyzeColumnContext(columnName, table);

    // Check for PII indicators in context
    for (const [piiType, patterns] of this.patterns.entries()) {
      const contextScore = this.calculateContextScore(columnName, tableContext, piiType);
      
      if (contextScore >= this.config.confidenceThreshold) {
        results.push({
          column: column.name,
          table: tableName,
          piiType,
          confidence: contextScore,
          detectionMethod: DetectionMethod.CONTEXT_ANALYSIS,
          riskLevel: this.getRiskLevel(piiType),
          compliance: this.complianceMap.get(piiType) || [],
          metadata: {
            tableContext,
            columnContext,
            columnType: column.type
          }
        });
      }
    }

    return results;
  }

  /**
   * Calculate pattern-based confidence score
   */
  private calculatePatternConfidence(columnName: string, pattern: RegExp, piiType: PIIType): number {
    let score = 0.5; // Base score
    
    // Pattern strength
    if (pattern.source.length > 10) score += 0.2;
    if (pattern.source.includes('\\b')) score += 0.1; // Word boundaries
    
    // Column name relevance
    if (columnName.includes(piiType)) score += 0.2;
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate semantic confidence score
   */
  private calculateSemanticConfidence(columnName: string, pattern: string, piiType: PIIType): number {
    let score = 0.4; // Base score
    
    // Pattern match strength
    if (columnName === pattern.toLowerCase()) score += 0.4;
    else if (columnName.includes(pattern.toLowerCase())) score += 0.2;
    
    // PII type relevance
    if (columnName.includes(piiType)) score += 0.2;
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate data match score
   */
  private calculateDataMatchScore(data: string[], patterns: RegExp[], piiType: PIIType): number {
    if (data.length === 0) return 0;
    
    let totalScore = 0;
    const sampleSize = Math.min(data.length, this.config.sampleSize);
    
    for (let i = 0; i < sampleSize; i++) {
      const value = data[i];
      let valueScore = 0;
      
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          valueScore = Math.max(valueScore, 0.8);
        }
      }
      
      totalScore += valueScore;
    }
    
    return totalScore / sampleSize;
  }

  /**
   * Calculate context score
   */
  private calculateContextScore(columnName: string, tableContext: Record<string, boolean>, piiType: PIIType): number {
    let score = 0.3; // Base score
    
    // Table context indicators
    if (tableContext.hasPrimaryKey) score += 0.1;
    if (tableContext.hasForeignKeys) score += 0.1;
    
    // Column context indicators
    if (columnName.includes('id') || columnName.includes('key')) score += 0.2;
    if (columnName.includes('name') || columnName.includes('email')) score += 0.2;
    
    return Math.min(1.0, score);
  }

  /**
   * Get risk level for PII type
   */
  private getRiskLevel(piiType: PIIType): RiskLevel {
    const highRiskTypes = [PIIType.SSN, PIIType.CREDIT_CARD, PIIType.PASSWORD, PIIType.BIOMETRIC];
    const mediumRiskTypes = [PIIType.EMAIL, PIIType.PHONE, PIIType.ADDRESS, PIIType.DATE_OF_BIRTH];
    
    if (highRiskTypes.includes(piiType)) return RiskLevel.HIGH;
    if (mediumRiskTypes.includes(piiType)) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Analyze data profile
   */
  private analyzeDataProfile(data: string[], columnType: string): Record<string, string | number | boolean> {
    const profile: Record<string, string | number | boolean> = {
      totalValues: data.length,
      uniqueValues: new Set(data).size,
      nullValues: data.filter(v => v === null || v === undefined || v === '').length,
      avgLength: data.reduce((sum, v) => sum + (v?.length || 0), 0) / data.length,
      columnType
    };
    
    return profile;
  }

  /**
   * Extract data features for ML analysis
   */
  private extractDataFeatures(data: string[]): Record<string, string | number | boolean> {
    const features: Record<string, string | number | boolean> = {
      sampleSize: data.length,
      hasNulls: data.some(v => v === null || v === undefined || v === ''),
      avgLength: data.reduce((sum, v) => sum + (v?.length || 0), 0) / data.length,
      maxLength: Math.max(...data.map(v => v?.length || 0)),
      minLength: Math.min(...data.map(v => v?.length || 0))
    };
    
    return features;
  }

  /**
   * Get sample values from data
   */
  private getSampleValues(data: string[], count: number): string[] {
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, data.length));
  }

  /**
   * Analyze table context
   */
  private analyzeTableContext(tableName: string, table: DatabaseTable): Record<string, boolean> {
    return {
      hasPrimaryKey: table.columns?.some((c: DatabaseColumn) => c.isPrimaryKey) || false,
      hasForeignKeys: table.columns?.some((c: DatabaseColumn) => c.isForeignKey) || false,
      isUserTable: tableName.includes('user') || tableName.includes('customer') || tableName.includes('account'),
      isTransactionTable: tableName.includes('order') || tableName.includes('payment') || tableName.includes('transaction'),
      isConfigurationTable: tableName.includes('config') || tableName.includes('setting') || tableName.includes('option')
    };
  }

  /**
   * Analyze column context
   */
  private analyzeColumnContext(columnName: string, table: DatabaseTable): Record<string, boolean> {
    const column = table.columns?.find((c: DatabaseColumn) => c.name === columnName);
    return {
      isPrimaryKey: column?.isPrimaryKey || false,
      isForeignKey: column?.isForeignKey || false,
      isUnique: column?.isUnique || false,
      isNullable: column?.isNullable || true
    };
  }

  /**
   * Generate PII protection rules
   */
  generatePIIRules(detectionResults: PIIDetectionResult[]): Array<{
    id: string;
    name: string;
    description: string;
    type: string;
    severity: string;
    condition: Record<string, unknown>;
    action: Record<string, unknown>;
    confidence: number;
  }> {
    return detectionResults.map(result => ({
      id: `pii-protection-${result.column}-${result.piiType}`,
      name: `PII Protection - ${result.column}`,
      description: `Protect ${result.piiType} data in column ${result.column}`,
      type: 'pii_protection',
      severity: result.riskLevel,
      condition: {
        type: 'column',
        column: result.column,
        table: result.table
      },
      action: {
        type: 'deny',
        message: `Access to ${result.piiType} data in ${result.column} is not allowed`
      },
      confidence: result.confidence
    }));
  }

  /**
   * Remove duplicate detection results
   */
  private deduplicateResults(results: PIIDetectionResult[]): PIIDetectionResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = `${result.table}.${result.column}.${result.piiType}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Initialize regex patterns for PII detection
   */
  private initializePatterns(): void {
    this.patterns.set(PIIType.EMAIL, [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      /email/i,
      /mail/i
    ]);
    
    this.patterns.set(PIIType.PHONE, [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      /phone/i,
      /tel/i,
      /mobile/i
    ]);
    
    this.patterns.set(PIIType.SSN, [
      /\b\d{3}-\d{2}-\d{4}\b/,
      /ssn/i,
      /social/i
    ]);
    
    this.patterns.set(PIIType.CREDIT_CARD, [
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
      /credit/i,
      /card/i,
      /cc/i
    ]);
  }

  /**
   * Initialize semantic patterns
   */
  private initializeSemanticPatterns(): void {
    this.semanticPatterns.set(PIIType.EMAIL, ['email', 'mail', 'e-mail']);
    this.semanticPatterns.set(PIIType.PHONE, ['phone', 'telephone', 'mobile', 'cell']);
    this.semanticPatterns.set(PIIType.NAME, ['name', 'firstname', 'lastname', 'fullname']);
    this.semanticPatterns.set(PIIType.ADDRESS, ['address', 'street', 'city', 'zip']);
  }

  /**
   * Initialize compliance requirements
   */
  private initializeComplianceMap(): void {
    this.complianceMap.set(PIIType.EMAIL, [
      {
        regulation: 'GDPR',
        requirement: 'Personal data protection',
        severity: RiskLevel.MEDIUM,
        description: 'Email addresses are considered personal data under GDPR'
      }
    ]);
    
    this.complianceMap.set(PIIType.SSN, [
      {
        regulation: 'HIPAA',
        requirement: 'Protected health information',
        severity: RiskLevel.HIGH,
        description: 'SSNs are considered PHI under HIPAA'
      }
    ]);
  }
}
