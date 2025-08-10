import { DatabaseSchema } from '../types/DatabaseSchema';

export interface DataQualityIssue {
  type: 'duplicate' | 'inconsistent_naming' | 'missing_values' | 'typos' | 'non_normalized';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedTables: string[];
  affectedColumns: string[];
  suggestedFix: string;
  confidence: number;
}

export interface DataQualityReport {
  issues: DataQualityIssue[];
  overallScore: number;
  recommendations: string[];
  autoFixes: string[];
}

export class DataQualityProcessor {
  constructor() {
    // Initialize data quality processor
  }

  /**
   * Analyze data quality of the database schema
   */
  async analyzeDataQuality(schema: DatabaseSchema): Promise<DataQualityReport> {
    const issues: DataQualityIssue[] = [];

    // Detect various quality issues
    const duplicateIssues = await this.detectDuplicatePatterns(schema);
    const namingIssues = await this.detectNamingInconsistencies(schema);
    const missingValueIssues = await this.detectMissingValuePatterns(schema);
    const typoIssues = await this.detectTypoPatterns(schema);
    const normalizationIssues = await this.detectNonNormalizedStructures(schema);

    // Combine all issues
    issues.push(...duplicateIssues);
    issues.push(...namingIssues);
    issues.push(...missingValueIssues);
    issues.push(...typoIssues);
    issues.push(...normalizationIssues);

    // Calculate overall score
    const overallScore = this.calculateQualityScore(issues);

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues);

    // Generate auto-fixes
    const autoFixes = this.generateAutoFixes(issues);

    return {
      issues,
      overallScore,
      recommendations,
      autoFixes
    };
  }

  /**
   * Detect duplicate patterns in schema
   */
  private async detectDuplicatePatterns(schema: DatabaseSchema): Promise<DataQualityIssue[]> {
    const issues: DataQualityIssue[] = [];
    
    // Check for duplicate table names
    const tableNames = schema.tables.map(table => table.name.toLowerCase());
    const duplicateTables = tableNames.filter((name, index) => tableNames.indexOf(name) !== index);
    
    if (duplicateTables.length > 0) {
      issues.push({
        type: 'duplicate',
        severity: 'high',
        description: `Duplicate table names found: ${duplicateTables.join(', ')}`,
        affectedTables: [...new Set(duplicateTables)],
        affectedColumns: [],
        suggestedFix: 'Rename duplicate tables to have unique names',
        confidence: 95
      });
    }

    // Check for duplicate column names within tables
    for (const table of schema.tables) {
      const columnNames = table.columns.map(col => col.name.toLowerCase());
      const duplicateColumns = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
      
      if (duplicateColumns.length > 0) {
        issues.push({
          type: 'duplicate',
          severity: 'medium',
          description: `Duplicate column names in table ${table.name}: ${duplicateColumns.join(', ')}`,
          affectedTables: [table.name],
          affectedColumns: [...new Set(duplicateColumns)],
          suggestedFix: 'Rename duplicate columns to have unique names',
          confidence: 90
        });
      }
    }

    return issues;
  }

  /**
   * Detect naming inconsistencies
   */
  private async detectNamingInconsistencies(schema: DatabaseSchema): Promise<DataQualityIssue[]> {
    const issues: DataQualityIssue[] = [];
    
    const namingPatterns = this.analyzeNamingPatterns(schema);
    
    // Check for inconsistent naming conventions
    if (namingPatterns.inconsistent.length > 0) {
      issues.push({
        type: 'inconsistent_naming',
        severity: 'medium',
        description: `Inconsistent naming patterns detected: ${namingPatterns.inconsistent.join(', ')}`,
        affectedTables: namingPatterns.affectedTables,
        affectedColumns: namingPatterns.affectedColumns,
        suggestedFix: 'Standardize naming conventions across the schema',
        confidence: 80
      });
    }

    return issues;
  }

  /**
   * Detect missing value patterns
   */
  private async detectMissingValuePatterns(schema: DatabaseSchema): Promise<DataQualityIssue[]> {
    const issues: DataQualityIssue[] = [];
    
    for (const table of schema.tables) {
      // Check for columns that might indicate missing data patterns
      const nullableColumns = table.columns.filter(col => 
        col.name.toLowerCase().includes('deleted') ||
        col.name.toLowerCase().includes('archived') ||
        col.name.toLowerCase().includes('status')
      );
      
      if (nullableColumns.length > 0) {
        issues.push({
          type: 'missing_values',
          severity: 'low',
          description: `Potential missing value patterns in table ${table.name}`,
          affectedTables: [table.name],
          affectedColumns: nullableColumns.map(col => col.name),
          suggestedFix: 'Review data completeness and consider default values',
          confidence: 60
        });
      }
    }

    return issues;
  }

  /**
   * Detect typo patterns in column names
   */
  private async detectTypoPatterns(schema: DatabaseSchema): Promise<DataQualityIssue[]> {
    // Temporarily disabled - would require AI integration
    return [];
  }

  /**
   * Detect non-normalized structures
   */
  private async detectNonNormalizedStructures(schema: DatabaseSchema): Promise<DataQualityIssue[]> {
    const issues: DataQualityIssue[] = [];
    
    for (const table of schema.tables) {
      // Check for wide tables (too many columns)
      if (table.columns.length > 20) {
        issues.push({
          type: 'non_normalized',
          severity: 'medium',
          description: `Table has ${table.columns.length} columns, consider normalization`,
          affectedTables: [table.name],
          affectedColumns: [],
          suggestedFix: 'Consider splitting into multiple related tables',
          confidence: 75
        });
      }
      
      // Check for columns that might contain multiple values
      const multiValueColumns = table.columns.filter(col => 
        col.name.toLowerCase().includes('list') ||
        col.name.toLowerCase().includes('array') ||
        col.name.toLowerCase().includes('multiple')
      );
      
      if (multiValueColumns.length > 0) {
        issues.push({
          type: 'non_normalized',
          severity: 'high',
          description: `Columns that might contain multiple values: ${multiValueColumns.map(col => col.name).join(', ')}`,
          affectedTables: [table.name],
          affectedColumns: multiValueColumns.map(col => col.name),
          suggestedFix: 'Consider creating separate tables for multi-value data',
          confidence: 85
        });
      }
    }
    
    return issues;
  }

  /**
   * Find similar column names
   */
  private findSimilarColumnNames(columns: any[]): string[] {
    const similarGroups: string[][] = [];
    
    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        const similarity = this.calculateStringSimilarity(
          columns[i].name.toLowerCase(),
          columns[j].name.toLowerCase()
        );
        
        if (similarity > 0.8) {
          similarGroups.push([columns[i].name, columns[j].name]);
        }
      }
    }
    
    return similarGroups.flat();
  }

  /**
   * Analyze naming patterns in the schema
   */
  private analyzeNamingPatterns(schema: DatabaseSchema): any {
    const patterns = {
      snake_case: 0,
      camelCase: 0,
      PascalCase: 0,
      lowercase: 0,
      inconsistent: [] as string[],
      affectedTables: [] as string[],
      affectedColumns: [] as string[]
    };

    for (const table of schema.tables) {
      const tablePattern = this.detectNamingPattern(table.name);
      patterns[tablePattern as keyof typeof patterns]++;
      
      for (const column of table.columns) {
        const columnPattern = this.detectNamingPattern(column.name);
        patterns[columnPattern as keyof typeof patterns]++;
      }
    }

    return patterns;
  }

  /**
   * Detect naming pattern of a string
   */
  private detectNamingPattern(name: string): string {
    if (name.includes('_')) return 'snake_case';
    if (name.match(/^[a-z][a-zA-Z]*$/)) return 'camelCase';
    if (name.match(/^[A-Z][a-zA-Z]*$/)) return 'PascalCase';
    return 'lowercase';
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate quality score based on issues
   */
  private calculateQualityScore(issues: DataQualityIssue[]): number {
    if (issues.length === 0) return 100;

    const severityWeights = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0
    };

    const totalWeight = issues.reduce((sum, issue) => {
      return sum + severityWeights[issue.severity];
    }, 0);

    const maxPossibleWeight = issues.length * severityWeights.critical;
    const score = Math.max(0, 100 - (totalWeight / maxPossibleWeight) * 100);

    return Math.round(score);
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: DataQualityIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.type === 'duplicate')) {
      recommendations.push('Review and fix duplicate table/column names');
    }

    if (issues.some(issue => issue.type === 'inconsistent_naming')) {
      recommendations.push('Standardize naming conventions across the schema');
    }

    if (issues.some(issue => issue.type === 'non_normalized')) {
      recommendations.push('Consider normalizing wide tables and multi-value columns');
    }

    if (issues.some(issue => issue.type === 'missing_values')) {
      recommendations.push('Review data completeness and add appropriate constraints');
    }

    return recommendations;
  }

  /**
   * Generate auto-fixes for issues
   */
  private generateAutoFixes(issues: DataQualityIssue[]): string[] {
    const autoFixes: string[] = [];

    for (const issue of issues) {
      if (issue.suggestedFix) {
        autoFixes.push(`${issue.affectedTables.join(', ')}: ${issue.suggestedFix}`);
      }
    }

    return autoFixes;
  }
} 