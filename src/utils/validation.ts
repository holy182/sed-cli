/**
 * Input Validation System for SED
 * Provides comprehensive validation to prevent security vulnerabilities
 */

import { createError, ErrorType, ErrorSeverity } from './errors';

export interface ValidationRule {
  type: 'required' | 'string' | 'number' | 'boolean' | 'email' | 'url' | 'regex' | 'enum' | 'custom';
  value?: any;
  message?: string;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class InputValidator {
  private static readonly SQL_INJECTION_PATTERNS = [
    /\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b/i,
    /\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\s+/i,
    /\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\s*\(/i,
    /\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\s*--/i,
    /\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\s*\/\*/i,
    /\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\s*#/i,
    /\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\s*\/\//i,
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//g,
    /\.\.\\/g,
    /\/\.\./g,
    /\\\.\./g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
  ];

  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  ];

  static validateString(value: any, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'required':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            errors.push(rule.message || 'Value is required');
          }
          break;

        case 'string':
          if (value !== undefined && value !== null && typeof value !== 'string') {
            errors.push(rule.message || 'Value must be a string');
          }
          break;

        case 'regex':
          if (value && rule.value && !rule.value.test(value)) {
            errors.push(rule.message || 'Value does not match required pattern');
          }
          break;

        case 'enum':
          if (value && rule.value && !rule.value.includes(value)) {
            errors.push(rule.message || `Value must be one of: ${rule.value.join(', ')}`);
          }
          break;

        case 'custom':
          if (value && rule.validator && !rule.validator(value)) {
            errors.push(rule.message || 'Value failed custom validation');
          }
          break;
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateDatabaseConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push('Database configuration is required');
      return { isValid: false, errors, warnings };
    }

    // Validate required fields
    if (!config.type) {
      errors.push('Database type is required');
    } else if (!['postgres', 'mysql', 'sqlite', 'snowflake', 'bigquery', 'oracle', 'mongodb'].includes(config.type)) {
      errors.push('Invalid database type');
    }

    // Validate host
    if (config.host) {
      const hostValidation = this.validateString(config.host, [
        { type: 'string' },
        { type: 'regex', value: /^[a-zA-Z0-9.-]+$/, message: 'Invalid host format' }
      ]);
      errors.push(...hostValidation.errors);
    }

    // Validate port
    if (config.port !== undefined) {
      if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
        errors.push('Port must be a number between 1 and 65535');
      }
    }

    // Validate database name (or file path for SQLite)
    if (config.database) {
      const dbValidation = this.validateString(config.database, [
        { type: 'string' }
      ]);
      // For SQLite, allow file paths; for other databases, validate as identifier
      if (config.type !== 'sqlite') {
        const nameValidation = this.validateString(config.database, [
          { type: 'regex', value: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid database name format' }
        ]);
        errors.push(...nameValidation.errors);
      }
      errors.push(...dbValidation.errors);
    }

    // Validate username
    if (config.username) {
      const userValidation = this.validateString(config.username, [
        { type: 'string' },
        { type: 'regex', value: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid username format' }
      ]);
      errors.push(...userValidation.errors);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateTableName(tableName: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!tableName) {
      errors.push('Table name is required');
      return { isValid: false, errors, warnings };
    }

    // Check for SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(tableName)) {
        errors.push('Table name contains potentially dangerous SQL patterns');
        break;
      }
    }

    // Validate table name format
    const nameValidation = this.validateString(tableName, [
      { type: 'string' },
      { type: 'regex', value: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid table name format' }
    ]);
    errors.push(...nameValidation.errors);

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateColumnName(columnName: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!columnName) {
      errors.push('Column name is required');
      return { isValid: false, errors, warnings };
    }

    // Check for SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(columnName)) {
        errors.push('Column name contains potentially dangerous SQL patterns');
        break;
      }
    }

    // Validate column name format
    const nameValidation = this.validateString(columnName, [
      { type: 'string' },
      { type: 'regex', value: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid column name format' }
    ]);
    errors.push(...nameValidation.errors);

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateFilePath(filePath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!filePath) {
      errors.push('File path is required');
      return { isValid: false, errors, warnings };
    }

    // Check for path traversal patterns
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(filePath)) {
        errors.push('File path contains potentially dangerous traversal patterns');
        break;
      }
    }

    // Validate file path format
    const pathValidation = this.validateString(filePath, [
      { type: 'string' },
      // eslint-disable-next-line no-useless-escape
      { type: 'regex', value: /^[a-zA-Z0-9._\/\\-]+$/, message: 'Invalid file path format' }
    ]);
    errors.push(...pathValidation.errors);

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateApiKey(apiKey: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!apiKey) {
      errors.push('API key is required');
      return { isValid: false, errors, warnings };
    }

    // Validate API key format
    const keyValidation = this.validateString(apiKey, [
      { type: 'string' },
      { type: 'regex', value: /^[a-zA-Z0-9._-]+$/, message: 'Invalid API key format' }
    ]);
    errors.push(...keyValidation.errors);

    // Check minimum length
    if (apiKey.length < parseInt(process.env.MIN_API_KEY_LENGTH || '10')) {
      warnings.push('API key seems too short');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateQuery(query: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!query) {
      errors.push('Query is required');
      return { isValid: false, errors, warnings };
    }

    // Check for SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(query)) {
        errors.push('Query contains potentially dangerous SQL patterns');
        break;
      }
    }

    // Check for XSS patterns
    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(query)) {
        errors.push('Query contains potentially dangerous XSS patterns');
        break;
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  static validateAndSanitizeInput(input: any, rules: ValidationRule[]): { value: string; isValid: boolean; errors: string[] } {
    const sanitized = this.sanitizeInput(input);
    const validation = this.validateString(sanitized, rules);

    return {
      value: sanitized,
      isValid: validation.isValid,
      errors: validation.errors
    };
  }
}

// Convenience functions
export const validateDatabaseConfig = InputValidator.validateDatabaseConfig.bind(InputValidator);
export const validateTableName = InputValidator.validateTableName.bind(InputValidator);
export const validateColumnName = InputValidator.validateColumnName.bind(InputValidator);
export const validateFilePath = InputValidator.validateFilePath.bind(InputValidator);
export const validateApiKey = InputValidator.validateApiKey.bind(InputValidator);
export const validateQuery = InputValidator.validateQuery.bind(InputValidator);
export const sanitizeInput = InputValidator.sanitizeInput.bind(InputValidator);
export const validateAndSanitizeInput = InputValidator.validateAndSanitizeInput.bind(InputValidator); 