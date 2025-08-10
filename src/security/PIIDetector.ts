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
  metadata?: Record<string, any>;
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
  async detectPII(schema: any, sampleData?: Record<string, any[]>): Promise<PIIDetectionResult[]> {
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
    column: any, 
    table: any, 
    sampleData?: Record<string, any[]>
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
  private detectByPatterns(columnName: string, tableName: string, column: any): PIIDetectionResult[] {
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
  private detectBySemanticAnalysis(columnName: string, tableName: string, column: any): PIIDetectionResult[] {
    const results: PIIDetectionResult[] = [];

    for (const [piiType, semanticPatterns] of this.semanticPatterns.entries()) {
      const semanticScore = this.calculateSemanticScore(columnName, tableName, semanticPatterns);
      
      if (semanticScore >= this.config.confidenceThreshold) {
        results.push({
          column: column.name,
          table: tableName,
          piiType,
          confidence: semanticScore,
          detectionMethod: DetectionMethod.SEMANTIC_ANALYSIS,
          riskLevel: this.getRiskLevel(piiType),
          compliance: this.complianceMap.get(piiType) || [],
          metadata: {
            semanticPatterns,
            columnType: column.type,
            tableContext: tableName
          }
        });
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
    column: any, 
    sampleData: Record<string, any[]>
  ): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];
    const columnData = sampleData[column.name] || [];

    if (columnData.length === 0) return results;

    // Analyze data characteristics
    const dataProfile = this.analyzeDataProfile(columnData, column.type);
    
    // Check for PII patterns in actual data
    for (const [piiType, patterns] of this.patterns.entries()) {
      const dataMatchScore = this.calculateDataMatchScore(columnData, patterns, piiType);
      
      if (dataMatchScore >= this.config.confidenceThreshold) {
        results.push({
          column: column.name,
          table: tableName,
          piiType,
          confidence: dataMatchScore,
          detectionMethod: DetectionMethod.DATA_PROFILING,
          riskLevel: this.getRiskLevel(piiType),
          compliance: this.complianceMap.get(piiType) || [],
          sampleValues: this.getSampleValues(columnData, 5),
          metadata: {
            dataProfile,
            sampleSize: columnData.length,
            uniqueValues: new Set(columnData).size
          }
        });
      }
    }

    return results;
  }

  /**
   * ML-based PII detection (simplified implementation)
   */
  private async detectByML(
    columnName: string, 
    tableName: string, 
    column: any, 
    sampleData?: Record<string, any[]>
  ): Promise<PIIDetectionResult[]> {
    // This would integrate with a real ML model in production
    // For now, we'll use a simplified heuristic approach
    const results: PIIDetectionResult[] = [];
    
    const mlFeatures = this.extractMLFeatures(columnName, tableName, column, sampleData);
    const mlScore = this.calculateMLScore(mlFeatures);
    
    if (mlScore >= this.config.confidenceThreshold) {
      // Determine most likely PII type based on features
      const predictedType = this.predictPIIType(mlFeatures);
      
      results.push({
        column: column.name,
        table: tableName,
        piiType: predictedType,
        confidence: mlScore,
        detectionMethod: DetectionMethod.ML_CLASSIFICATION,
        riskLevel: this.getRiskLevel(predictedType),
        compliance: this.complianceMap.get(predictedType) || [],
        metadata: {
          mlFeatures,
          predictedType,
          modelVersion: '1.0.0'
        }
      });
    }

    return results;
  }

  /**
   * Context-based PII detection
   */
  private detectByContext(columnName: string, tableName: string, column: any, table: any): PIIDetectionResult[] {
    const results: PIIDetectionResult[] = [];

    // Analyze table context
    const tableContext = this.analyzeTableContext(tableName, table);
    
    // Check for context-specific PII patterns
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
            columnContext: this.analyzeColumnContext(columnName, table)
          }
        });
      }
    }

    return results;
  }

  /**
   * Initialize regex patterns for PII detection
   */
  private initializePatterns(): void {
    // Email patterns
    this.patterns.set(PIIType.EMAIL, [
      /email/i,
      /e-mail/i,
      /mail/i,
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i
    ]);

    // Phone patterns
    this.patterns.set(PIIType.PHONE, [
      /phone/i,
      /tel/i,
      /mobile/i,
      /cell/i,
      /^(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}$/,
      /^\d{10,11}$/
    ]);

    // SSN patterns
    this.patterns.set(PIIType.SSN, [
      /ssn/i,
      /social/i,
      /security/i,
      /^\d{3}-\d{2}-\d{4}$/,
      /^\d{9}$/
    ]);

    // Credit card patterns
    this.patterns.set(PIIType.CREDIT_CARD, [
      /credit/i,
      /card/i,
      /cc/i,
      /payment/i,
      /^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/,
      /^\d{13,19}$/
    ]);

    // Address patterns
    this.patterns.set(PIIType.ADDRESS, [
      /address/i,
      /street/i,
      /city/i,
      /state/i,
      /zip/i,
      /postal/i,
      /country/i
    ]);

    // Name patterns
    this.patterns.set(PIIType.NAME, [
      /name/i,
      /first/i,
      /last/i,
      /full/i,
      /given/i,
      /surname/i
    ]);

    // Date of birth patterns
    this.patterns.set(PIIType.DATE_OF_BIRTH, [
      /birth/i,
      /dob/i,
      /born/i,
      /age/i
    ]);

    // Driver's license patterns
    this.patterns.set(PIIType.DRIVERS_LICENSE, [
      /license/i,
      /dl/i,
      /drivers/i,
      /permit/i
    ]);

    // Passport patterns
    this.patterns.set(PIIType.PASSPORT, [
      /passport/i,
      /pass/i
    ]);

    // IP address patterns
    this.patterns.set(PIIType.IP_ADDRESS, [
      /ip/i,
      /address/i,
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
    ]);

    // MAC address patterns
    this.patterns.set(PIIType.MAC_ADDRESS, [
      /mac/i,
      /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
    ]);

    // Vehicle ID patterns
    this.patterns.set(PIIType.VEHICLE_ID, [
      /vin/i,
      /vehicle/i,
      /plate/i,
      /license_plate/i
    ]);

    // Medical ID patterns
    this.patterns.set(PIIType.MEDICAL_ID, [
      /medical/i,
      /patient/i,
      /health/i,
      /record/i
    ]);

    // Financial account patterns
    this.patterns.set(PIIType.FINANCIAL_ACCOUNT, [
      /account/i,
      /bank/i,
      /routing/i,
      /swift/i,
      /iban/i
    ]);
  }

  /**
   * Initialize semantic patterns for context-based detection
   */
  private initializeSemanticPatterns(): void {
    this.semanticPatterns.set(PIIType.EMAIL, ['user', 'contact', 'customer', 'client', 'member']);
    this.semanticPatterns.set(PIIType.PHONE, ['contact', 'customer', 'support', 'emergency']);
    this.semanticPatterns.set(PIIType.SSN, ['employee', 'person', 'individual', 'citizen']);
    this.semanticPatterns.set(PIIType.CREDIT_CARD, ['payment', 'billing', 'transaction', 'purchase']);
    this.semanticPatterns.set(PIIType.ADDRESS, ['shipping', 'billing', 'location', 'delivery']);
    this.semanticPatterns.set(PIIType.NAME, ['person', 'user', 'customer', 'employee']);
    this.semanticPatterns.set(PIIType.DATE_OF_BIRTH, ['person', 'user', 'customer', 'employee']);
    this.semanticPatterns.set(PIIType.DRIVERS_LICENSE, ['driver', 'vehicle', 'transport']);
    this.semanticPatterns.set(PIIType.PASSPORT, ['travel', 'international', 'border']);
    this.semanticPatterns.set(PIIType.IP_ADDRESS, ['network', 'connection', 'session']);
    this.semanticPatterns.set(PIIType.MAC_ADDRESS, ['device', 'hardware', 'network']);
    this.semanticPatterns.set(PIIType.VEHICLE_ID, ['vehicle', 'fleet', 'transport']);
    this.semanticPatterns.set(PIIType.MEDICAL_ID, ['patient', 'health', 'medical']);
    this.semanticPatterns.set(PIIType.FINANCIAL_ACCOUNT, ['bank', 'financial', 'payment']);
  }

  /**
   * Initialize compliance requirements map
   */
  private initializeComplianceMap(): void {
    // GDPR compliance
    this.complianceMap.set(PIIType.EMAIL, [
      {
        regulation: 'GDPR',
        requirement: 'Article 32 - Security of processing',
        severity: RiskLevel.HIGH,
        description: 'Personal data must be protected with appropriate security measures'
      }
    ]);

    this.complianceMap.set(PIIType.SSN, [
      {
        regulation: 'GDPR',
        requirement: 'Article 9 - Special categories of personal data',
        severity: RiskLevel.CRITICAL,
        description: 'National identification numbers require special protection'
      }
    ]);

    // HIPAA compliance
    this.complianceMap.set(PIIType.MEDICAL_ID, [
      {
        regulation: 'HIPAA',
        requirement: '45 CFR 164.312 - Technical safeguards',
        severity: RiskLevel.CRITICAL,
        description: 'Protected health information must be encrypted and secured'
      }
    ]);

    // PCI DSS compliance
    this.complianceMap.set(PIIType.CREDIT_CARD, [
      {
        regulation: 'PCI DSS',
        requirement: 'Requirement 3 - Protect stored cardholder data',
        severity: RiskLevel.CRITICAL,
        description: 'Cardholder data must be encrypted and protected'
      }
    ]);
  }

  /**
   * Calculate pattern matching confidence
   */
  private calculatePatternConfidence(columnName: string, pattern: RegExp, piiType: PIIType): number {
    let confidence = 0.5; // Base confidence

    // Exact match boosts confidence
    if (pattern.test(columnName)) {
      confidence += 0.3;
    }

    // Pattern complexity affects confidence
    if (pattern.source.length > 20) {
      confidence += 0.1;
    }

    // Column name length affects confidence
    if (columnName.length > 10) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate semantic analysis confidence
   */
  private calculateSemanticScore(columnName: string, tableName: string, semanticPatterns: string[]): number {
    let score = 0;
    let totalPatterns = semanticPatterns.length;

    for (const pattern of semanticPatterns) {
      if (columnName.includes(pattern) || tableName.includes(pattern)) {
        score += 1;
      }
    }

    return score / totalPatterns;
  }

  /**
   * Analyze data profile for patterns
   */
  private analyzeDataProfile(data: any[], columnType: string): Record<string, any> {
    const profile: Record<string, any> = {
      totalCount: data.length,
      uniqueCount: new Set(data).size,
      nullCount: data.filter(d => d === null || d === undefined).length,
      emptyCount: data.filter(d => d === '' || d === ' ').length,
      avgLength: 0,
      minLength: Infinity,
      maxLength: 0,
      commonPatterns: []
    };

    if (data.length > 0) {
      const lengths = data
        .filter(d => d !== null && d !== undefined)
        .map(d => String(d).length);
      
      profile.avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      profile.minLength = Math.min(...lengths);
      profile.maxLength = Math.max(...lengths);
    }

    return profile;
  }

  /**
   * Calculate data match score
   */
  private calculateDataMatchScore(data: any[], patterns: RegExp[], piiType: PIIType): number {
    let matchCount = 0;
    const sampleSize = Math.min(data.length, this.config.sampleSize);

    for (let i = 0; i < sampleSize; i++) {
      const value = String(data[i]);
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          matchCount++;
          break;
        }
      }
    }

    return matchCount / sampleSize;
  }

  /**
   * Extract ML features for classification
   */
  private extractMLFeatures(
    columnName: string, 
    tableName: string, 
    column: any, 
    sampleData?: Record<string, any[]>
  ): Record<string, any> {
    return {
      columnNameLength: columnName.length,
      tableNameLength: tableName.length,
      columnType: column.type,
      isNullable: column.isNullable,
      hasUnderscores: columnName.includes('_'),
      hasNumbers: /\d/.test(columnName),
      wordCount: columnName.split(/[_\s]/).length,
      commonWords: this.getCommonWords(columnName),
      dataType: column.type,
      ...(sampleData && this.extractDataFeatures(sampleData[column.name] || []))
    };
  }

  /**
   * Calculate ML score (simplified)
   */
  private calculateMLScore(features: Record<string, any>): number {
    let score = 0.3; // Base score for ML detection

    // Column name features
    if (features.columnNameLength > 5) score += 0.1;
    if (features.hasUnderscores) score += 0.1;
    if (features.wordCount > 1) score += 0.1;

    // Data type features
    if (features.dataType === 'varchar' || features.dataType === 'text') score += 0.2;
    if (features.dataType === 'int' || features.dataType === 'bigint') score += 0.1;

    // Data features
    if (features.uniqueRatio > 0.5) score += 0.2;
    if (features.avgLength > 10) score += 0.1;

    // Boost score for common PII patterns
    if (features.commonWords && features.commonWords.length > 0) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Predict PII type based on features
   */
  private predictPIIType(features: Record<string, any>): PIIType {
    // Simplified prediction logic
    if (features.commonWords.includes('email')) return PIIType.EMAIL;
    if (features.commonWords.includes('phone')) return PIIType.PHONE;
    if (features.commonWords.includes('ssn')) return PIIType.SSN;
    if (features.commonWords.includes('credit')) return PIIType.CREDIT_CARD;
    if (features.commonWords.includes('address')) return PIIType.ADDRESS;
    if (features.commonWords.includes('name')) return PIIType.NAME;
    
    return PIIType.EMAIL; // Default
  }

  /**
   * Analyze table context
   */
  private analyzeTableContext(tableName: string, table: any): Record<string, any> {
    return {
      tableName,
      columnCount: table.columns?.length || 0,
      hasPrimaryKey: table.columns?.some((c: any) => c.isPrimaryKey) || false,
      hasForeignKeys: table.columns?.some((c: any) => c.isForeignKey) || false,
      commonWords: this.getCommonWords(tableName)
    };
  }

  /**
   * Analyze column context
   */
  private analyzeColumnContext(columnName: string, table: any): Record<string, any> {
    return {
      columnName,
      isPrimaryKey: table.columns?.find((c: any) => c.name === columnName)?.isPrimaryKey || false,
      isForeignKey: table.columns?.find((c: any) => c.name === columnName)?.isForeignKey || false,
      isUnique: table.columns?.find((c: any) => c.name === columnName)?.isUnique || false,
      isNullable: table.columns?.find((c: any) => c.name === columnName)?.isNullable || true
    };
  }

  /**
   * Calculate context score
   */
  private calculateContextScore(columnName: string, tableContext: Record<string, any>, piiType: PIIType): number {
    let score = 0.3; // Base score

    // Table context scoring
    if (tableContext.commonWords.some((word: string) => 
      ['user', 'customer', 'person', 'employee'].includes(word)
    )) {
      score += 0.2;
    }

    // Column context scoring
    if (columnName.includes('id') && !columnName.includes('user_id')) {
      score -= 0.1; // Likely not PII if it's a generic ID
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  /**
   * Get common words from text
   */
  private getCommonWords(text: string): string[] {
    return text.toLowerCase()
      .split(/[_\s]/)
      .filter(word => word.length > 2)
      .slice(0, 5);
  }

  /**
   * Extract data features for ML
   */
  private extractDataFeatures(data: any[]): Record<string, any> {
    if (data.length === 0) return {};

    const profile = this.analyzeDataProfile(data, 'unknown');
    return {
      uniqueRatio: profile.uniqueCount / profile.totalCount,
      avgLength: profile.avgLength,
      minLength: profile.minLength,
      maxLength: profile.maxLength
    };
  }

  /**
   * Get sample values for analysis
   */
  private getSampleValues(data: any[], count: number): string[] {
    return data
      .filter(d => d !== null && d !== undefined)
      .slice(0, count)
      .map(d => String(d));
  }

  /**
   * Get risk level for PII type
   */
  private getRiskLevel(piiType: PIIType): RiskLevel {
    const riskMap: Record<PIIType, RiskLevel> = {
      [PIIType.SSN]: RiskLevel.CRITICAL,
      [PIIType.CREDIT_CARD]: RiskLevel.HIGH,
      [PIIType.MEDICAL_ID]: RiskLevel.CRITICAL,
      [PIIType.DRIVERS_LICENSE]: RiskLevel.HIGH,
      [PIIType.PASSPORT]: RiskLevel.HIGH,
      [PIIType.FINANCIAL_ACCOUNT]: RiskLevel.HIGH,
      [PIIType.EMAIL]: RiskLevel.MEDIUM,
      [PIIType.PHONE]: RiskLevel.MEDIUM,
      [PIIType.ADDRESS]: RiskLevel.MEDIUM,
      [PIIType.NAME]: RiskLevel.MEDIUM,
      [PIIType.DATE_OF_BIRTH]: RiskLevel.MEDIUM,
      [PIIType.IP_ADDRESS]: RiskLevel.LOW,
      [PIIType.MAC_ADDRESS]: RiskLevel.LOW,
      [PIIType.VEHICLE_ID]: RiskLevel.LOW,
      [PIIType.BIOMETRIC]: RiskLevel.CRITICAL,
      [PIIType.LOCATION]: RiskLevel.MEDIUM,
      [PIIType.BEHAVIORAL]: RiskLevel.LOW
    };

    return riskMap[piiType] || RiskLevel.MEDIUM;
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
   * Generate PII protection rules from detection results
   */
  generatePIIRules(detectionResults: PIIDetectionResult[]): any[] {
    return detectionResults
      .filter(result => result.confidence >= this.config.confidenceThreshold)
      .map(result => ({
        id: `pii-protection-${result.table}-${result.column}`,
        name: `PII Protection - ${result.piiType.toUpperCase()}`,
        description: `Protect ${result.piiType} data in ${result.table}.${result.column}`,
        type: 'pii_protection',
        severity: result.riskLevel === RiskLevel.CRITICAL ? 'block' : 'warning',
        scope: 'column',
        trigger: 'before_query',
        enabled: true,
        priority: result.riskLevel === RiskLevel.CRITICAL ? 1000 : 800,
        condition: {
          type: 'pattern',
          pattern: `.*${result.column}.*`
        },
        action: {
          type: result.riskLevel === RiskLevel.CRITICAL ? 'deny' : 'modify',
          message: `Access to ${result.piiType} data is restricted`,
          code: result.riskLevel === RiskLevel.CRITICAL ? 
            null : 
            `SELECT * FROM {originalQuery} WHERE ${result.column} IS NULL`
        },
        tags: ['auto-generated', 'pii', 'security'],
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'sed-pii-detector',
        metadata: {
          piiType: result.piiType,
          confidence: result.confidence,
          detectionMethod: result.detectionMethod,
          compliance: result.compliance
        }
      }));
  }
}
