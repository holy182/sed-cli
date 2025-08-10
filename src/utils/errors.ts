/**
 * Secure Error Handling System for SED
 * Provides structured error handling with proper sanitization
 */

export enum ErrorType {
  AI_FAILURE = 'AI_FAILURE',
  MAPPING_FAILURE = 'MAPPING_FAILURE',
  SQL_SYNTAX_ERROR = 'SQL_SYNTAX_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SEDError {
  type: ErrorType;
  message: string;
  code: string;
  severity: ErrorSeverity;
  details?: Record<string, any>;
  timestamp: Date;
  stage: 'discovery' | 'mapping' | 'query_processing' | 'sql_generation' | 'validation' | 'authentication';
  userId?: string;
  requestId?: string;
}

export class SEDErrorHandler {
  private static sanitizeMessage(message: string): string {
    // Remove sensitive information from error messages
    const sensitivePatterns = [
      /password\s*[:=]\s*['"][^'"]*['"]/gi,
      /api[_-]?key\s*[:=]\s*['"][^'"]*['"]/gi,
      /token\s*[:=]\s*['"][^'"]*['"]/gi,
      /secret\s*[:=]\s*['"][^'"]*['"]/gi,
      /connection[_-]?string\s*[:=]\s*['"][^'"]*['"]/gi,
    ];

    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '$1: [REDACTED]');
    });

    return sanitized;
  }

  /**
   * Create a structured SED error
   */
  static createError(
    type: ErrorType,
    message: string,
    options: {
      code?: string;
      severity?: ErrorSeverity;
      stage?: SEDError['stage'];
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ): SEDError {
    return {
      type,
      message: this.sanitizeMessage(message),
      code: options.code || this.generateErrorCode(type),
      severity: options.severity || this.getSeverityForType(type),
      details: options.details || {},
      timestamp: new Date(),
      stage: options.stage || 'validation'
    };
  }

  /**
   * Generate error code from type
   */
  private static generateErrorCode(type: ErrorType): string {
    const codeMap: Record<ErrorType, string> = {
      [ErrorType.AI_FAILURE]: 'AI_001',
      [ErrorType.MAPPING_FAILURE]: 'MAP_001',
      [ErrorType.SQL_SYNTAX_ERROR]: 'SQL_001',
      [ErrorType.VALIDATION_ERROR]: 'VAL_001',
      [ErrorType.DATABASE_ERROR]: 'DB_001',
      [ErrorType.CONFIGURATION_ERROR]: 'CFG_001',
      [ErrorType.SECURITY_ERROR]: 'SEC_001',
      [ErrorType.NETWORK_ERROR]: 'NET_001',
      [ErrorType.PERMISSION_ERROR]: 'PERM_001'
    };
    return codeMap[type] || 'UNKNOWN_001';
  }

  /**
   * Get default severity for error type
   */
  private static getSeverityForType(type: ErrorType): ErrorSeverity {
    const severityMap: Record<ErrorType, ErrorSeverity> = {
      [ErrorType.AI_FAILURE]: ErrorSeverity.MEDIUM,
      [ErrorType.MAPPING_FAILURE]: ErrorSeverity.HIGH,
      [ErrorType.SQL_SYNTAX_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.VALIDATION_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.DATABASE_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.CONFIGURATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.SECURITY_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.PERMISSION_ERROR]: ErrorSeverity.HIGH
    };
    return severityMap[type] || ErrorSeverity.MEDIUM;
  }

  private static sanitizeDetails(details: any): any {
    if (!details || typeof details !== 'object') {
      return details;
    }

    const sanitized: any = {};
    const sensitiveKeys = ['password', 'apiKey', 'token', 'secret', 'connectionString', 'auth'];

    for (const [key, value] of Object.entries(details)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }



  static logError(error: SEDError, context?: string): void {
    const logMessage = {
      timestamp: error.timestamp.toISOString(),
      type: error.type,
      code: error.code,
      severity: error.severity,
      message: error.message,
      stage: error.stage,
      context,
      details: error.details
    };

    // Log based on severity
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', logMessage);
        break;
      case ErrorSeverity.HIGH:
        console.error('❌ HIGH ERROR:', logMessage);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️ MEDIUM ERROR:', logMessage);
        break;
      case ErrorSeverity.LOW:
        console.log('ℹ️ LOW ERROR:', logMessage);
        break;
    }
  }

  static handleError(error: unknown, context?: string): SEDError {
    if (error instanceof Error) {
      // Determine error type from error message or class
      let type = ErrorType.VALIDATION_ERROR;
      let code = 'UNKNOWN_ERROR';
      let severity = ErrorSeverity.MEDIUM;

      if (error.message.includes('connection') || error.message.includes('database')) {
        type = ErrorType.DATABASE_ERROR;
        code = 'DB_CONNECTION_ERROR';
        severity = ErrorSeverity.HIGH;
      } else if (error.message.includes('API') || error.message.includes('groq')) {
        type = ErrorType.AI_FAILURE;
        code = 'AI_API_ERROR';
        severity = ErrorSeverity.MEDIUM;
      } else if (error.message.includes('SQL') || error.message.includes('syntax')) {
        type = ErrorType.SQL_SYNTAX_ERROR;
        code = 'SQL_SYNTAX_ERROR';
        severity = ErrorSeverity.HIGH;
      } else if (error.message.includes('permission') || error.message.includes('access')) {
        type = ErrorType.PERMISSION_ERROR;
        code = 'PERMISSION_DENIED';
        severity = ErrorSeverity.HIGH;
      }

      const sedError = this.createError(
        type,
        error.message,
        {
          code,
          severity,
          details: { originalError: error.name },
          stage: 'discovery'
        }
      );

      this.logError(sedError, context);
      return sedError;
    }

    // Handle non-Error objects
    const sedError = this.createError(
      ErrorType.VALIDATION_ERROR,
      String(error),
      {
        code: 'UNKNOWN_ERROR_TYPE',
        severity: ErrorSeverity.MEDIUM,
        details: { originalError: typeof error }
      }
    );

    this.logError(sedError, context);
    return sedError;
  }

  static isRetryableError(error: SEDError): boolean {
    const retryableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.DATABASE_ERROR,
      ErrorType.AI_FAILURE
    ];

    const retryableCodes = [
      'DB_CONNECTION_ERROR',
      'AI_API_ERROR',
      'NETWORK_TIMEOUT'
    ];

    return retryableTypes.includes(error.type) || retryableCodes.includes(error.code);
  }

  static getRetryDelay(error: SEDError, attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = parseInt(process.env.RETRY_BASE_DELAY || '1000');
    const maxDelay = parseInt(process.env.RETRY_MAX_DELAY || '30000');
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter
    return delay + jitter;
  }
}

// Convenience functions
export const createError = SEDErrorHandler.createError.bind(SEDErrorHandler);
export const logError = SEDErrorHandler.logError.bind(SEDErrorHandler);
export const handleError = SEDErrorHandler.handleError.bind(SEDErrorHandler);
export const isRetryableError = SEDErrorHandler.isRetryableError.bind(SEDErrorHandler);
export const getRetryDelay = SEDErrorHandler.getRetryDelay.bind(SEDErrorHandler);

// Specific error creation functions
export function createDatabaseError(message: string, details?: any): SEDError {
  return SEDErrorHandler.createError(ErrorType.DATABASE_ERROR, message, {
    stage: 'discovery',
    details
  });
}

export function createValidationError(message: string, details?: any): SEDError {
  return SEDErrorHandler.createError(ErrorType.VALIDATION_ERROR, message, {
    stage: 'validation',
    details
  });
}

export function createConfigurationError(message: string, details?: any): SEDError {
  return SEDErrorHandler.createError(ErrorType.CONFIGURATION_ERROR, message, {
    stage: 'validation',
    details
  });
}

export function createSecurityError(message: string, details?: any): SEDError {
  return SEDErrorHandler.createError(ErrorType.SECURITY_ERROR, message, {
    stage: 'authentication',
    details
  });
}

export function createMappingError(message: string, details?: any): SEDError {
  return SEDErrorHandler.createError(ErrorType.MAPPING_FAILURE, message, {
    stage: 'mapping',
    details
  });
}

// Custom error class for throwing structured errors
export class SEDErrorException extends Error {
  public readonly sedError: SEDError;

  constructor(sedError: SEDError) {
    super(sedError.message);
    this.name = 'SEDErrorException';
    this.sedError = sedError;
  }
} 