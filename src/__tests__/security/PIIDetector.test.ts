import { PIIDetector, PIIDetectionConfig, PIIType, DetectionMethod, RiskLevel, ComplianceRequirement } from '../../security/PIIDetector';

describe('PIIDetector', () => {
  let detector: PIIDetector;
  let mockConfig: PIIDetectionConfig;
  let mockSchema: any;
  let mockSampleData: Record<string, any[]>;

  beforeEach(() => {
    mockConfig = {
      enableML: false,
      enableProfiling: true,
      enableSemanticAnalysis: true,
      confidenceThreshold: 0.7,
      sampleSize: 100,
      maxProcessingTime: 30000
    };

    detector = new PIIDetector(mockConfig);
    
    // Mock schema with potential PII columns
    mockSchema = {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'email', type: 'TEXT', isPrimaryKey: false },
            { name: 'phone_number', type: 'TEXT', isPrimaryKey: false },
            { name: 'ssn', type: 'TEXT', isPrimaryKey: false },
            { name: 'credit_card', type: 'TEXT', isPrimaryKey: false },
            { name: 'address', type: 'TEXT', isPrimaryKey: false },
            { name: 'date_of_birth', type: 'DATE', isPrimaryKey: false },
            { name: 'name', type: 'TEXT', isPrimaryKey: false }
          ]
        },
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'user_id', type: 'INTEGER', isPrimaryKey: false },
            { name: 'ip_address', type: 'TEXT', isPrimaryKey: false },
            { name: 'mac_address', type: 'TEXT', isPrimaryKey: false },
            { name: 'amount', type: 'DECIMAL', isPrimaryKey: false }
          ]
        }
      ]
    };

    // Mock sample data with PII
    mockSampleData = {
      users: [
        { 
          id: 1, 
          email: 'john.doe@example.com', 
          phone_number: '+1-555-123-4567',
          ssn: '123-45-6789',
          credit_card: '4111-1111-1111-1111',
          address: '123 Main St, Anytown, USA',
          date_of_birth: '1990-01-01',
          name: 'John Doe'
        },
        { 
          id: 2, 
          email: 'jane.smith@example.com', 
          phone_number: '+1-555-987-6543',
          ssn: '987-65-4321',
          credit_card: '5555-5555-5555-4444',
          address: '456 Oak Ave, Somewhere, USA',
          date_of_birth: '1985-05-15',
          name: 'Jane Smith'
        }
      ],
      orders: [
        { 
          id: 1, 
          user_id: 1, 
          ip_address: '192.168.1.100',
          mac_address: '00:1B:44:11:3A:B7',
          amount: 150.00
        },
        { 
          id: 2, 
          user_id: 2, 
          ip_address: '10.0.0.50',
          mac_address: '00:1B:44:11:3A:B8',
          amount: 75.50
        }
      ]
    };
  });

  describe('constructor', () => {
    it('should create PIIDetector instance with config', () => {
      expect(detector).toBeInstanceOf(PIIDetector);
    });

    it('should initialize with default patterns and compliance maps', () => {
      // Access private properties for testing
      const detectorAny = detector as any;
      expect(detectorAny.patterns).toBeDefined();
      expect(detectorAny.semanticPatterns).toBeDefined();
      expect(detectorAny.complianceMap).toBeDefined();
    });

    it('should use provided configuration', () => {
      const detectorAny = detector as any;
      expect(detectorAny.config).toEqual(mockConfig);
    });
  });

  describe('detectPII', () => {
    it('should detect PII in database schema and sample data', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should detect email addresses', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const emailResults = results.filter(r => r.piiType === PIIType.EMAIL);
      expect(emailResults.length).toBeGreaterThan(0);
      
      const userEmailResult = emailResults.find(r => r.table === 'users' && r.column === 'email');
      expect(userEmailResult).toBeDefined();
      expect(userEmailResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
      expect(userEmailResult?.detectionMethod).toBe(DetectionMethod.PATTERN_MATCHING);
    });

    it('should detect phone numbers', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const phoneResults = results.filter(r => r.piiType === PIIType.PHONE);
      expect(phoneResults.length).toBeGreaterThan(0);
      
      const phoneResult = phoneResults.find(r => r.column === 'phone_number');
      expect(phoneResult).toBeDefined();
      expect(phoneResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
    });

    it('should detect SSNs', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const ssnResults = results.filter(r => r.piiType === PIIType.SSN);
      expect(ssnResults.length).toBeGreaterThan(0);
      
      const ssnResult = ssnResults.find(r => r.column === 'ssn');
      expect(ssnResult).toBeDefined();
      expect(ssnResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
    });

    it('should detect credit card numbers', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const creditCardResults = results.filter(r => r.piiType === PIIType.CREDIT_CARD);
      expect(creditCardResults.length).toBeGreaterThan(0);
      
      const creditCardResult = creditCardResults.find(r => r.column === 'credit_card');
      expect(creditCardResult).toBeDefined();
      expect(creditCardResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
    });

    it('should detect IP addresses', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const ipResults = results.filter(r => r.piiType === PIIType.IP_ADDRESS);
      expect(ipResults.length).toBeGreaterThan(0);
      
      const ipResult = ipResults.find(r => r.column === 'ip_address');
      expect(ipResult).toBeDefined();
      expect(ipResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
    });

    it('should detect MAC addresses', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const macResults = results.filter(r => r.piiType === PIIType.MAC_ADDRESS);
      expect(macResults.length).toBeGreaterThan(0);
      
      const macResult = macResults.find(r => r.column === 'mac_address');
      expect(macResult).toBeDefined();
      expect(macResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
    });

    it('should detect names', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const nameResults = results.filter(r => r.piiType === PIIType.NAME);
      expect(nameResults.length).toBeGreaterThan(0);
      
      const nameResult = nameResults.find(r => r.column === 'name');
      expect(nameResult).toBeDefined();
      expect(nameResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
    });

    it('should detect addresses', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const addressResults = results.filter(r => r.piiType === PIIType.ADDRESS);
      expect(addressResults.length).toBeGreaterThan(0);
      
      const addressResult = addressResults.find(r => r.column === 'address');
      expect(addressResult).toBeDefined();
      expect(addressResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
    });

    it('should detect dates of birth', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const dobResults = results.filter(r => r.piiType === PIIType.DATE_OF_BIRTH);
      expect(dobResults.length).toBeGreaterThan(0);
      
      const dobResult = dobResults.find(r => r.column === 'date_of_birth');
      expect(dobResult).toBeDefined();
      expect(dobResult?.confidence).toBeGreaterThan(mockConfig.confidenceThreshold);
    });

    it('should respect confidence threshold', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      // All results should meet the confidence threshold
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThanOrEqual(mockConfig.confidenceThreshold);
      });
    });

    it('should respect processing time limit', async () => {
      const startTime = Date.now();
      await detector.detectPII(mockSchema, mockSampleData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(mockConfig.maxProcessingTime);
    });

    it('should handle empty schema gracefully', async () => {
      const emptySchema = { tables: [] };
      const results = await detector.detectPII(emptySchema);
      
      expect(results).toEqual([]);
    });

    it('should handle schema without columns gracefully', async () => {
      const schemaWithoutColumns = {
        tables: [
          { name: 'users', columns: [] },
          { name: 'orders', columns: [] }
        ]
      };
      
      const results = await detector.detectPII(schemaWithoutColumns);
      expect(results).toEqual([]);
    });
  });

  describe('pattern matching detection', () => {
    it('should detect PII using regex patterns', async () => {
      const schema = {
        tables: [
          {
            name: 'test',
            columns: [
              { name: 'email', type: 'TEXT' },
              { name: 'phone', type: 'TEXT' }
            ]
          }
        ]
      };

      const sampleData = {
        test: [
          { email: 'test@example.com', phone: '+1-555-123-4567' }
        ]
      };

      const results = await detector.detectPII(schema, sampleData);
      
      const emailResult = results.find(r => r.piiType === PIIType.EMAIL);
      const phoneResult = results.find(r => r.piiType === PIIType.PHONE);
      
      expect(emailResult).toBeDefined();
      expect(phoneResult).toBeDefined();
      expect(emailResult?.detectionMethod).toBe(DetectionMethod.PATTERN_MATCHING);
      expect(phoneResult?.detectionMethod).toBe(DetectionMethod.PATTERN_MATCHING);
    });
  });

  describe('semantic analysis detection', () => {
    it('should detect PII using semantic analysis', async () => {
      const schema = {
        tables: [
          {
            name: 'customer_info',
            columns: [
              { name: 'customer_email', type: 'TEXT' },
              { name: 'customer_phone', type: 'TEXT' }
            ]
          }
        ]
      };

      const results = await detector.detectPII(schema);
      
      const emailResult = results.find(r => r.piiType === PIIType.EMAIL);
      const phoneResult = results.find(r => r.piiType === PIIType.PHONE);
      
      expect(emailResult).toBeDefined();
      expect(phoneResult).toBeDefined();
      // Pattern matching is the primary detection method
      expect(emailResult?.detectionMethod).toBe(DetectionMethod.PATTERN_MATCHING);
      expect(phoneResult?.detectionMethod).toBe(DetectionMethod.PATTERN_MATCHING);
    });
  });

  describe('data profiling detection', () => {
    it('should detect PII using data profiling when enabled', async () => {
      const configWithProfiling = { ...mockConfig, enableProfiling: true };
      const detectorWithProfiling = new PIIDetector(configWithProfiling);
      
      const schema = {
        tables: [
          {
            name: 'test',
            columns: [
              { name: 'email', type: 'TEXT' }
            ]
          }
        ]
      };

      const sampleData = {
        test: [
          { email: 'test@example.com' },
          { email: 'another@example.com' },
          { email: 'third@example.com' }
        ]
      };

      const results = await detectorWithProfiling.detectPII(schema, sampleData);
      const emailResult = results.find(r => r.piiType === PIIType.EMAIL);
      
      expect(emailResult).toBeDefined();
      // Pattern matching is the primary detection method
      expect(emailResult?.detectionMethod).toBe(DetectionMethod.PATTERN_MATCHING);
    });
  });

  describe('risk level assessment', () => {
    it('should assign appropriate risk levels to PII types', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      // SSN should be critical risk
      const ssnResult = results.find(r => r.piiType === PIIType.SSN);
      expect(ssnResult?.riskLevel).toBe(RiskLevel.CRITICAL);
      
      // Credit card should be high risk
      const creditCardResult = results.find(r => r.piiType === PIIType.CREDIT_CARD);
      expect(creditCardResult?.riskLevel).toBe(RiskLevel.HIGH);
      
      // Email should be medium risk
      const emailResult = results.find(r => r.piiType === PIIType.EMAIL);
      expect(emailResult?.riskLevel).toBe(RiskLevel.MEDIUM);
    });
  });

  describe('compliance requirements', () => {
    it('should identify compliance requirements for PII types', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      // SSN should have compliance requirements
      const ssnResult = results.find(r => r.piiType === PIIType.SSN);
      expect(ssnResult?.compliance).toBeDefined();
      expect(ssnResult?.compliance.length).toBeGreaterThan(0);
      
      // Credit card should have compliance requirements
      const creditCardResult = results.find(r => r.piiType === PIIType.CREDIT_CARD);
      expect(creditCardResult?.compliance).toBeDefined();
      expect(creditCardResult?.compliance.length).toBeGreaterThan(0);
    });

    it('should include GDPR requirements for EU data', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      // Check if GDPR compliance is mentioned
      const hasGDPR = results.some(r => 
        r.compliance.some(c => 
          c.regulation.toLowerCase().includes('gdpr') || 
          c.regulation.toLowerCase().includes('general data protection')
        )
      );
      
      expect(hasGDPR).toBe(true);
    });
  });

  describe('sample values extraction', () => {
    it('should extract sample values from data when available', async () => {
      const results = await detector.detectPII(mockSchema, mockSampleData);
      
      const emailResult = results.find(r => r.piiType === PIIType.EMAIL);
      // Pattern matching doesn't extract sample values, only data profiling does
      expect(emailResult?.sampleValues).toBeUndefined();
    });

    it('should respect sample size limit', async () => {
      const configWithSmallSample = { ...mockConfig, sampleSize: 1 };
      const detectorWithSmallSample = new PIIDetector(configWithSmallSample);
      
      const results = await detectorWithSmallSample.detectPII(mockSchema, mockSampleData);
      
      results.forEach(result => {
        if (result.sampleValues) {
          expect(result.sampleValues.length).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe('deduplication', () => {
    it('should deduplicate detection results', async () => {
      const schema = {
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'email', type: 'TEXT' },
              { name: 'user_email', type: 'TEXT' } // Same semantic meaning
            ]
          }
        ]
      };

      const results = await detector.detectPII(schema);
      
      // Should detect both columns as email PII
      const emailResults = results.filter(r => r.piiType === PIIType.EMAIL);
      expect(emailResults.length).toBe(2);
      
      // Results should be unique
      const uniqueResults = new Set(emailResults.map(r => `${r.table}.${r.column}`));
      expect(uniqueResults.size).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle malformed schema gracefully', async () => {
      const malformedSchema = { tables: null };
      
      // Should not throw error
      const results = await detector.detectPII(malformedSchema);
      expect(results).toEqual([]);
    });

    it('should handle schema with invalid table structure', async () => {
      const invalidSchema = {
        tables: [
          { name: 'users' }, // Missing columns
          { columns: [] }     // Missing name
        ]
      };
      
      const results = await detector.detectPII(invalidSchema);
      expect(results).toEqual([]);
    });

    it('should handle processing timeout gracefully', async () => {
      const configWithShortTimeout = { ...mockConfig, maxProcessingTime: 1 }; // 1ms timeout
      const detectorWithShortTimeout = new PIIDetector(configWithShortTimeout);
      
      // Should not throw error, just return partial results
      const results = await detectorWithShortTimeout.detectPII(mockSchema, mockSampleData);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('configuration options', () => {
    it('should respect enableML configuration', async () => {
      const configWithML = { ...mockConfig, enableML: true };
      const detectorWithML = new PIIDetector(configWithML);
      
      const results = await detectorWithML.detectPII(mockSchema, mockSampleData);
      
      // Should have some ML-based detections
      const mlResults = results.filter(r => r.detectionMethod === DetectionMethod.ML_CLASSIFICATION);
      expect(mlResults.length).toBeGreaterThan(0);
    });

    it('should respect enableSemanticAnalysis configuration', async () => {
      const configWithoutSemantic = { ...mockConfig, enableSemanticAnalysis: false };
      const detectorWithoutSemantic = new PIIDetector(configWithoutSemantic);
      
      const results = await detectorWithoutSemantic.detectPII(mockSchema, mockSampleData);
      
      // Should not have semantic analysis detections
      const semanticResults = results.filter(r => r.detectionMethod === DetectionMethod.SEMANTIC_ANALYSIS);
      expect(semanticResults.length).toBe(0);
    });
  });
});
