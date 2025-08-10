import { BusinessLogicAnalyzer, BusinessLogicAnalysis, BusinessLogicRule, BusinessRuleType, RelationshipType } from '../../business/BusinessLogicAnalyzer';

describe('BusinessLogicAnalyzer', () => {
  let analyzer: BusinessLogicAnalyzer;
  let mockSchema: any;
  let mockSampleData: Record<string, any[]>;

  beforeEach(() => {
    analyzer = new BusinessLogicAnalyzer();
    
    // Mock schema with tables and columns
    mockSchema = {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true, isForeignKey: false, isNullable: false },
            { name: 'name', type: 'TEXT', isPrimaryKey: false, isForeignKey: false, isNullable: false },
            { name: 'email', type: 'TEXT', isPrimaryKey: false, isForeignKey: false, isNullable: false },
            { name: 'created_at', type: 'DATETIME', isPrimaryKey: false, isForeignKey: false, isNullable: false }
          ]
        },
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true, isForeignKey: false, isNullable: false },
            { name: 'user_id', type: 'INTEGER', isPrimaryKey: false, isForeignKey: true, isNullable: false, foreignKeyInfo: { referencedTable: 'users', referencedColumn: 'id' } },
            { name: 'total_amount', type: 'DECIMAL', isPrimaryKey: false, isForeignKey: false, isNullable: false },
            { name: 'status', type: 'TEXT', isPrimaryKey: false, isForeignKey: false, isNullable: false },
            { name: 'created_at', type: 'DATETIME', isPrimaryKey: false, isForeignKey: false, isNullable: false }
          ]
        },
        {
          name: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true, isForeignKey: false },
            { name: 'name', type: 'TEXT', isPrimaryKey: false, isForeignKey: false },
            { name: 'price', type: 'DECIMAL', isPrimaryKey: false, isForeignKey: false },
            { name: 'stock_level', type: 'INTEGER', isPrimaryKey: false, isForeignKey: false }
          ]
        },
        {
          name: 'order_items',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true, isForeignKey: false, isNullable: false },
            { name: 'order_id', type: 'INTEGER', isPrimaryKey: false, isForeignKey: true, isNullable: false, foreignKeyInfo: { referencedTable: 'orders', referencedColumn: 'id' } },
            { name: 'product_id', type: 'INTEGER', isPrimaryKey: false, isForeignKey: true, isNullable: false, foreignKeyInfo: { referencedTable: 'products', referencedColumn: 'id' } },
            { name: 'quantity', type: 'INTEGER', isPrimaryKey: false, isForeignKey: false, isNullable: false },
            { name: 'unit_price', type: 'DECIMAL', isPrimaryKey: false, isForeignKey: false, isNullable: false },
            { name: 'total_price', type: 'DECIMAL', isPrimaryKey: false, isForeignKey: false, isNullable: false, isComputed: true, computedFormula: 'quantity * unit_price' }
          ]
        }
      ]
    };

    // Mock sample data
    mockSampleData = {
      users: [
        { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2024-01-01' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2024-01-02' }
      ],
      orders: [
        { id: 1, user_id: 1, total_amount: 150.00, status: 'completed', created_at: '2024-01-01' },
        { id: 2, user_id: 2, total_amount: 75.50, status: 'pending', created_at: '2024-01-02' }
      ],
      products: [
        { id: 1, name: 'Product A', price: 50.00, stock_level: 100 },
        { id: 2, name: 'Product B', price: 50.00, stock_level: 75 }
      ],
      order_items: [
        { id: 1, order_id: 1, product_id: 1, quantity: 2, unit_price: 50.00, total_price: 100.00 },
        { id: 2, order_id: 1, product_id: 2, quantity: 1, unit_price: 50.00, total_price: 50.00 }
      ]
    };
  });

  describe('constructor', () => {
    it('should create BusinessLogicAnalyzer instance', () => {
      expect(analyzer).toBeInstanceOf(BusinessLogicAnalyzer);
    });

    it('should initialize with default patterns and templates', () => {
      // Access private properties for testing
      const analyzerAny = analyzer as any;
      expect(analyzerAny.domainPatterns).toBeDefined();
      expect(analyzerAny.ruleTemplates).toBeDefined();
    });

    it('should call analyzeRelationships method directly', () => {
      // Test the private method directly
      const analyzerAny = analyzer as any;
      
      // Verify the method exists
      expect(analyzerAny.analyzeRelationships).toBeDefined();
      expect(typeof analyzerAny.analyzeRelationships).toBe('function');
      
      // Verify the mock schema has the expected structure
      expect(mockSchema).toBeDefined();
      expect(mockSchema.tables).toBeDefined();
      expect(Array.isArray(mockSchema.tables)).toBe(true);
      expect(mockSchema.tables.length).toBeGreaterThan(0);
      
      // Check if we have foreign key columns in the mock schema
      const fkColumns = mockSchema.tables.flatMap((t: any) => t.columns).filter((c: any) => c.isForeignKey);
      expect(fkColumns.length).toBeGreaterThan(0);
      
      // Call the method
      const result = analyzerAny.analyzeRelationships(mockSchema);
      
      // Verify the result
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should test console output', () => {
      console.log('SIMPLE TEST: This is a simple console.log test');
      expect(true).toBe(true);
    });

    it('should verify mock schema structure', () => {
      console.log('SCHEMA TEST: mockSchema tables:', mockSchema.tables.length);
      for (const table of mockSchema.tables) {
        console.log('SCHEMA TEST: Table:', table.name);
        for (const column of table.columns) {
          console.log('SCHEMA TEST: Column:', column.name, 'isFK:', column.isForeignKey, 'FKInfo:', column.foreignKeyInfo);
        }
      }
      
      // Check if we have foreign key columns
      const fkColumns = mockSchema.tables.flatMap((t: any) => t.columns).filter((c: any) => c.isForeignKey);
      console.log('SCHEMA TEST: Foreign key columns found:', fkColumns.length);
      fkColumns.forEach((col: any) => console.log('SCHEMA TEST: FK column:', col.name, col.foreignKeyInfo));
      
      expect(mockSchema.tables.length).toBeGreaterThan(0);
      expect(fkColumns.length).toBeGreaterThan(0);
    });

    it('should manually test relationship detection logic', () => {
      const analyzerAny = analyzer as any;
      
      // Test the logic step by step
      const relationships: any[] = [];
      
      for (const table of mockSchema.tables) {
        console.log('MANUAL TEST: Processing table:', table.name);
        for (const column of table.columns) {
          console.log('MANUAL TEST: Processing column:', column.name, 'isFK:', column.isForeignKey, 'FKInfo:', column.foreignKeyInfo);
          
          // Check for explicit foreign key relationships
          if (column.isForeignKey && column.foreignKeyInfo) {
            console.log('MANUAL TEST: Found explicit foreign key in column:', column.name);
            const relationship = analyzerAny.createRelationship(table, column, mockSchema);
            console.log('MANUAL TEST: Created relationship:', relationship);
            if (relationship) {
              relationships.push(relationship);
            }
          }
          // Also check for implicit relationships based on naming patterns
          else if (column.name.toLowerCase().endsWith('_id') && !column.isPrimaryKey) {
            console.log('MANUAL TEST: Found implicit foreign key pattern in column:', column.name);
            // Try to infer the referenced table from the column name
            const referencedTable = column.name.toLowerCase().replace(/_id$/, '');
            if (referencedTable && mockSchema.tables.some((t: any) => t.name.toLowerCase() === referencedTable)) {
              console.log('MANUAL TEST: Found referenced table:', referencedTable);
              const relationship = analyzerAny.createImplicitRelationship(table, column, referencedTable, mockSchema);
              console.log('MANUAL TEST: Created implicit relationship:', relationship);
              if (relationship) {
                relationships.push(relationship);
              }
            }
          }
        }
      }
      
      console.log('MANUAL TEST: Final relationships array:', relationships);
      console.log('MANUAL TEST: Relationships count:', relationships.length);
      
      expect(relationships.length).toBeGreaterThan(0);
    });

    it('should test analyzeBusinessLogic directly', async () => {
      const result = await analyzer.analyzeBusinessLogic(mockSchema, mockSampleData);
      console.log('DIRECT TEST: analyzeBusinessLogic result:', result);
      console.log('DIRECT TEST: result.relationships:', result.relationships);
      console.log('DIRECT TEST: result.relationships length:', result.relationships?.length);
      
      expect(result).toBeDefined();
      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
      expect(result.relationships.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeBusinessLogic', () => {
    it('should analyze business logic from schema and sample data', async () => {
      const analysis = await analyzer.analyzeBusinessLogic(mockSchema, mockSampleData);

      expect(analysis).toBeDefined();
      expect(analysis.rules).toBeDefined();
      expect(analysis.relationships).toBeDefined();
      expect(analysis.metrics).toBeDefined();
      expect(analysis.workflows).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.domain).toBeDefined();
    });

    it('should detect business domain from schema', async () => {
      const analysis = await analyzer.analyzeBusinessLogic(mockSchema);
      
      // Should detect e-commerce domain based on table names
      expect(analysis.domain).toBe('ecommerce');
    });

    it('should analyze relationships between tables', async () => {
      console.log('TEST: Starting should analyze relationships between tables');
      const analysis = await analyzer.analyzeBusinessLogic(mockSchema);
      console.log('TEST: analyzeBusinessLogic returned:', analysis);
      console.log('TEST: analysis.relationships:', analysis.relationships);
      
      expect(analysis.relationships).toBeDefined();
      expect(analysis.relationships.length).toBeGreaterThan(0);
      
      // Should detect foreign key relationships
      const userOrderRelationship = analysis.relationships.find(r => 
        r.fromEntity === 'orders' && r.toEntity === 'users'
      );
      expect(userOrderRelationship).toBeDefined();
      expect(userOrderRelationship?.type).toBe(RelationshipType.ONE_TO_MANY);
    });

    it('should generate business metrics', async () => {
      const analysis = await analyzer.analyzeBusinessLogic(mockSchema, mockSampleData);
      
      expect(analysis.metrics).toBeDefined();
      expect(analysis.metrics.length).toBeGreaterThan(0);
      
      // Should detect revenue-related metrics
      const revenueMetric = analysis.metrics.find(m => 
        m.name.toLowerCase().includes('revenue') || m.name.toLowerCase().includes('total')
      );
      expect(revenueMetric).toBeDefined();
    });

    it('should generate business rules', async () => {
      const analysis = await analyzer.analyzeBusinessLogic(mockSchema);
      
      expect(analysis.rules).toBeDefined();
      expect(analysis.rules.length).toBeGreaterThan(0);
      
      // Should have validation rules
      const validationRules = analysis.rules.filter(r => r.type === BusinessRuleType.VALIDATION);
      expect(validationRules.length).toBeGreaterThan(0);
      
      // Should have calculation rules
      const calculationRules = analysis.rules.filter(r => r.type === BusinessRuleType.CALCULATION);
      expect(calculationRules.length).toBeGreaterThan(0);
    });

    it('should generate workflows', async () => {
      const analysis = await analyzer.analyzeBusinessLogic(mockSchema);
      
      expect(analysis.workflows).toBeDefined();
      expect(analysis.workflows.length).toBeGreaterThan(0);
      
      // Should have order processing workflow
      const orderWorkflow = analysis.workflows.find(w => 
        w.name.toLowerCase().includes('order') || w.description.toLowerCase().includes('order')
      );
      expect(orderWorkflow).toBeDefined();
    });

    it('should calculate confidence score', async () => {
      const analysis = await analyzer.analyzeBusinessLogic(mockSchema);
      
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle empty schema gracefully', async () => {
      const emptySchema = { tables: [] };
      const analysis = await analyzer.analyzeBusinessLogic(emptySchema);
      
      // Even empty schemas get default domain metrics and rules
      expect(analysis.rules.length).toBeGreaterThan(0);
      expect(analysis.relationships).toHaveLength(0);
      expect(analysis.metrics.length).toBeGreaterThan(0);
      expect(analysis.workflows).toHaveLength(0);
      expect(analysis.confidence).toBeCloseTo(0.9, 1);
    });

    it('should handle schema without columns gracefully', async () => {
      const schemaWithoutColumns = {
        tables: [
          { name: 'users', columns: [] },
          { name: 'orders', columns: [] }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(schemaWithoutColumns);
      
      expect(analysis.rules).toBeDefined();
      expect(analysis.relationships).toBeDefined();
      expect(analysis.metrics).toBeDefined();
      expect(analysis.workflows).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle malformed schema gracefully', async () => {
      const malformedSchema = { tables: null };
      
      // Should not throw error
      const analysis = await analyzer.analyzeBusinessLogic(malformedSchema);
      
      expect(analysis).toBeDefined();
      // Even malformed schemas get default domain metrics and rules
      expect(analysis.rules.length).toBeGreaterThan(0);
      expect(analysis.relationships).toHaveLength(0);
    });

    it('should handle schema with invalid table structure', async () => {
      const invalidSchema = {
        tables: [
          { name: 'users' }, // Missing columns
          { columns: [] }     // Missing name
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(invalidSchema);
      
      expect(analysis).toBeDefined();
      // Should still process valid parts
      expect(analysis.domain).toBeDefined();
    });
  });

  describe('business domain detection', () => {
    it('should detect e-commerce domain from order-related tables', async () => {
      const ecommerceSchema = {
        tables: [
          { name: 'products', columns: [] },
          { name: 'orders', columns: [] },
          { name: 'customers', columns: [] }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(ecommerceSchema);
      expect(analysis.domain).toBe('ecommerce');
    });

    it('should detect financial domain from financial tables', async () => {
      const financialSchema = {
        tables: [
          { name: 'accounts', columns: [] },
          { name: 'transactions', columns: [] },
          { name: 'balances', columns: [] }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(financialSchema);
      expect(analysis.domain).toBe('fintech');
    });

    it('should detect healthcare domain from medical tables', async () => {
      const healthcareSchema = {
        tables: [
          { name: 'patients', columns: [] },
          { name: 'appointments', columns: [] },
          { name: 'medical_records', columns: [] }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(healthcareSchema);
      expect(analysis.domain).toBe('healthcare');
    });
  });

  describe('relationship analysis', () => {
    it('should detect one-to-many relationships', async () => {
      const schema = {
        tables: [
          { name: 'users', columns: [{ name: 'id', type: 'INTEGER', isPrimaryKey: true }] },
          { name: 'posts', columns: [{ 
            name: 'user_id', 
            type: 'INTEGER', 
            isPrimaryKey: false, 
            isForeignKey: true,
            foreignKeyInfo: { referencedTable: 'users', referencedColumn: 'id' }
          }] }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(schema);
      const relationship = analysis.relationships.find(r => 
        r.fromEntity === 'posts' && r.toEntity === 'users'
      );
      
      expect(relationship).toBeDefined();
      expect(relationship?.type).toBe(RelationshipType.ONE_TO_MANY);
      expect(relationship?.cardinality).toBe('1:N');
    });

    it('should detect many-to-many relationships through junction tables', async () => {
      const schema = {
        tables: [
          { name: 'users', columns: [{ name: 'id', type: 'INTEGER', isPrimaryKey: true }] },
          { name: 'roles', columns: [{ name: 'id', type: 'INTEGER', isPrimaryKey: true }] },
          { name: 'user_roles', columns: [
            { 
              name: 'user_id', 
              type: 'INTEGER', 
              isPrimaryKey: false, 
              isForeignKey: true,
              foreignKeyInfo: { referencedTable: 'users', referencedColumn: 'id' }
            },
            { 
              name: 'role_id', 
              type: 'INTEGER', 
              isPrimaryKey: false, 
              isForeignKey: true,
              foreignKeyInfo: { referencedTable: 'roles', referencedColumn: 'id' }
            }
          ]}
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(schema);
      const userRoleRelationship = analysis.relationships.find(r => 
        r.fromEntity === 'users' && r.toEntity === 'roles'
      );
      
      expect(userRoleRelationship).toBeDefined();
      expect(userRoleRelationship?.type).toBe(RelationshipType.MANY_TO_MANY);
    });
  });

  describe('business rules generation', () => {
    it('should generate validation rules for required fields', async () => {
      const schema = {
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'INTEGER', isPrimaryKey: true, nullable: false },
              { name: 'email', type: 'TEXT', isPrimaryKey: false, nullable: false },
              { name: 'name', type: 'TEXT', isPrimaryKey: false, nullable: true }
            ]
          }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(schema);
      const validationRules = analysis.rules.filter(r => r.type === BusinessRuleType.VALIDATION);
      
      expect(validationRules.length).toBeGreaterThan(0);
      
      const emailRequiredRule = validationRules.find(r => 
        r.condition.toLowerCase().includes('email') && r.condition.toLowerCase().includes('required')
      );
      expect(emailRequiredRule).toBeDefined();
    });

    it('should generate calculation rules for computed fields', async () => {
      const schema = {
        tables: [
          {
            name: 'order_items',
            columns: [
              { name: 'quantity', type: 'INTEGER' },
              { name: 'unit_price', type: 'DECIMAL' },
              { name: 'total_price', type: 'DECIMAL' }
            ]
          }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(schema);
      const calculationRules = analysis.rules.filter(r => r.type === BusinessRuleType.CALCULATION);
      
      expect(calculationRules.length).toBeGreaterThan(0);
      
      const totalPriceRule = calculationRules.find(r => 
        r.action.toLowerCase().includes('total_price') || r.condition.toLowerCase().includes('total_price')
      );
      expect(totalPriceRule).toBeDefined();
    });
  });

  describe('workflow generation', () => {
    it('should generate order processing workflow', async () => {
      const schema = {
        tables: [
          { name: 'orders', columns: [{ name: 'status', type: 'TEXT' }] },
          { name: 'order_items', columns: [] },
          { name: 'payments', columns: [] }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(schema);
      const orderWorkflow = analysis.workflows.find(w => 
        w.name.toLowerCase().includes('order') || w.description.toLowerCase().includes('order')
      );
      
      expect(orderWorkflow).toBeDefined();
      expect(orderWorkflow?.steps).toBeDefined();
      expect(orderWorkflow?.steps.length).toBeGreaterThan(0);
      expect(orderWorkflow?.triggers).toBeDefined();
      expect(orderWorkflow?.outcomes).toBeDefined();
    });

    it('should generate user registration workflow', async () => {
      const schema = {
        tables: [
          { name: 'users', columns: [{ name: 'status', type: 'TEXT' }] },
          { name: 'user_verifications', columns: [] },
          { name: 'user_profiles', columns: [] }
        ]
      };
      
      const analysis = await analyzer.analyzeBusinessLogic(schema);
      const userWorkflow = analysis.workflows.find(w => 
        w.name.toLowerCase().includes('user') || w.description.toLowerCase().includes('user')
      );
      
      expect(userWorkflow).toBeDefined();
      expect(userWorkflow?.steps).toBeDefined();
    });
  });
});
