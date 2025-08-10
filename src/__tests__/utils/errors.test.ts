import {
  SEDErrorHandler,
  ErrorType,
  ErrorSeverity,
  createDatabaseError,
  createValidationError,
  createConfigurationError,
  SEDErrorException
} from '../../utils/errors';

describe('SEDErrorHandler', () => {
  describe('createError', () => {
    it('should create a structured error with all fields', () => {
      const error = SEDErrorHandler.createError(
        ErrorType.DATABASE_ERROR,
        'Connection failed',
        {
          code: 'DB_CONN_001',
          severity: ErrorSeverity.HIGH,
          stage: 'discovery',
          details: { host: 'localhost', port: 5432 }
        }
      );

      expect(error.type).toBe(ErrorType.DATABASE_ERROR);
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('DB_CONN_001');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.stage).toBe('discovery');
      expect(error.details).toEqual({ host: 'localhost', port: 5432 });
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should generate default code and severity when not provided', () => {
      const error = SEDErrorHandler.createError(
        ErrorType.VALIDATION_ERROR,
        'Invalid input'
      );

      expect(error.code).toBe('VAL_001');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.stage).toBe('validation');
    });

    it('should sanitize sensitive information from message', () => {
      const error = SEDErrorHandler.createError(
        ErrorType.DATABASE_ERROR,
        'Connection failed with password="secret123" and api_key="key123"'
      );

      expect(error.message).not.toContain('secret123');
      expect(error.message).not.toContain('key123');
      expect(error.message).toContain('[REDACTED]');
    });
  });

  describe('handleError', () => {
    it('should handle standard Error objects', () => {
      const originalError = new Error('Database connection timeout');
      const sedError = SEDErrorHandler.handleError(originalError, 'testContext');

      expect(sedError.type).toBe(ErrorType.DATABASE_ERROR);
      expect(sedError.message).toBe('Database connection timeout');
      expect(sedError.details?.originalError).toBe('Error');
    });

    it('should handle SQL syntax errors', () => {
      const sqlError = new Error('SQL syntax error near "SELECT"');
      const sedError = SEDErrorHandler.handleError(sqlError, 'queryExecution');

      expect(sedError.type).toBe(ErrorType.SQL_SYNTAX_ERROR);
      expect(sedError.code).toBe('SQL_SYNTAX_ERROR');
      expect(sedError.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should handle permission errors', () => {
      const permError = new Error('permission denied to access table users');
      const sedError = SEDErrorHandler.handleError(permError, 'schemaDiscovery');

      expect(sedError.type).toBe(ErrorType.PERMISSION_ERROR);
      expect(sedError.code).toBe('PERMISSION_DENIED');
      expect(sedError.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should handle non-Error objects', () => {
      const sedError = SEDErrorHandler.handleError('String error', 'testContext');

      expect(sedError.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(sedError.message).toBe('String error');
      expect(sedError.code).toBe('UNKNOWN_ERROR_TYPE');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      const networkError = SEDErrorHandler.createError(
        ErrorType.NETWORK_ERROR,
        'Connection timeout'
      );

      const dbError = SEDErrorHandler.createError(
        ErrorType.DATABASE_ERROR,
        'Connection lost',
        { code: 'DB_CONNECTION_ERROR' }
      );

      expect(SEDErrorHandler.isRetryableError(networkError)).toBe(true);
      expect(SEDErrorHandler.isRetryableError(dbError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const validationError = SEDErrorHandler.createError(
        ErrorType.VALIDATION_ERROR,
        'Invalid configuration'
      );

      const securityError = SEDErrorHandler.createError(
        ErrorType.SECURITY_ERROR,
        'Unauthorized access'
      );

      expect(SEDErrorHandler.isRetryableError(validationError)).toBe(false);
      expect(SEDErrorHandler.isRetryableError(securityError)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff with jitter', () => {
      const error = SEDErrorHandler.createError(
        ErrorType.NETWORK_ERROR,
        'Connection timeout'
      );

      const delay1 = SEDErrorHandler.getRetryDelay(error, 1);
      const delay2 = SEDErrorHandler.getRetryDelay(error, 2);
      const delay3 = SEDErrorHandler.getRetryDelay(error, 3);

      expect(delay1).toBeGreaterThan(1000);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay3).toBeLessThan(50000); // Should have some reasonable upper bound
    });
  });
});

describe('Convenience error functions', () => {
  it('should create database errors', () => {
    const error = createDatabaseError('Connection failed', { host: 'localhost' });

    expect(error.type).toBe(ErrorType.DATABASE_ERROR);
    expect(error.stage).toBe('discovery');
    expect(error.details).toEqual({ host: 'localhost' });
  });

  it('should create validation errors', () => {
    const error = createValidationError('Invalid input', { field: 'email' });

    expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
    expect(error.stage).toBe('validation');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('should create configuration errors', () => {
    const error = createConfigurationError('Missing database config');

    expect(error.type).toBe(ErrorType.CONFIGURATION_ERROR);
    expect(error.stage).toBe('validation');
  });
});

describe('SEDErrorException', () => {
  it('should create throwable error with SED error details', () => {
    const sedError = createDatabaseError('Connection failed');
    const exception = new SEDErrorException(sedError);

    expect(exception).toBeInstanceOf(Error);
    expect(exception.name).toBe('SEDErrorException');
    expect(exception.message).toBe('Connection failed');
    expect(exception.sedError).toBe(sedError);
  });
});
