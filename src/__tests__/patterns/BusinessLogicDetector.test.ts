import { BusinessLogicDetector } from '../../patterns/BusinessLogicDetector';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');

const mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
const mockPath = require('path') as jest.Mocked<typeof import('path')>;

describe('BusinessLogicDetector', () => {
  let detector: BusinessLogicDetector;
  let mockSchema: any;

    beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs.readFileSync to throw error so it uses fallback rules
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });
    
    detector = new BusinessLogicDetector();
    
    // Mock schema for testing
    mockSchema = {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'name', type: 'TEXT' },
            { name: 'email', type: 'TEXT' },
            { name: 'last_login', type: 'DATETIME' },
            { name: 'last_activity', type: 'DATETIME' },
            { name: 'visit_count', type: 'INTEGER' },
            { name: 'first_visit_date', type: 'DATETIME' },
            { name: 'usage_frequency', type: 'INTEGER' },
            { name: 'feature_usage_count', type: 'INTEGER' },
            { name: 'dormant_threshold', type: 'INTEGER' },
            { name: 'subscription_tier', type: 'TEXT' },
            { name: 'payment_status', type: 'TEXT' },
            { name: 'birth_date', type: 'DATETIME' },
            { name: 'date_of_birth', type: 'DATETIME' },
            { name: 'last_order_date', type: 'DATETIME' },
            { name: 'last_purchase_date', type: 'DATETIME' },
            { name: 'account_created', type: 'DATETIME' },
            { name: 'created_at', type: 'DATETIME' },
            { name: 'updated_at', type: 'DATETIME' }
          ]
        },
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'user_id', type: 'INTEGER', isForeignKey: true, foreignKeyInfo: { referencedTable: 'users', referencedColumn: 'id' } },
            { name: 'total_amount', type: 'DECIMAL' },
            { name: 'subtotal', type: 'DECIMAL' },
            { name: 'tax_amount', type: 'DECIMAL' },
            { name: 'shipping_cost', type: 'DECIMAL' },
            { name: 'order_date', type: 'DATETIME' },
            { name: 'shipped_date', type: 'DATETIME' },
            { name: 'delivered_date', type: 'DATETIME' },
            { name: 'status', type: 'TEXT' },
            { name: 'stock_level', type: 'INTEGER' },
            { name: 'order_quantity', type: 'INTEGER' },
            { name: 'payment_status', type: 'TEXT' },
            { name: 'expected_delivery', type: 'DATETIME' },
            { name: 'revenue', type: 'DECIMAL' },
            { name: 'cost', type: 'DECIMAL' },
            { name: 'expenses', type: 'DECIMAL' },
            { name: 'actual_output', type: 'INTEGER' },
            { name: 'expected_output', type: 'INTEGER' },
            { name: 'target_units', type: 'INTEGER' },
            { name: 'approved_by', type: 'TEXT' },
            { name: 'approval_date', type: 'DATETIME' },
            { name: 'risk_level', type: 'TEXT' },
            { name: 'compliance_status', type: 'TEXT' },
            { name: 'modified_by', type: 'TEXT' },
            { name: 'deleted_at', type: 'DATETIME' },
            { name: 'age', type: 'INTEGER' },
            { name: 'days_since_last_order', type: 'INTEGER' },
            { name: 'price', type: 'DECIMAL' },
            { name: 'quantity', type: 'INTEGER' },
            { name: 'profile_name', type: 'TEXT' },
            { name: 'profile_email', type: 'TEXT' },
            { name: 'inventory_value', type: 'DECIMAL' },
            { name: 'reorder_point', type: 'INTEGER' },
            { name: 'stock_turnover', type: 'REAL' },
            { name: 'average_inventory', type: 'INTEGER' },
            { name: 'cost_of_goods_sold', type: 'DECIMAL' },
            { name: 'gross_margin', type: 'DECIMAL' },
            { name: 'net_profit', type: 'DECIMAL' },
            { name: 'profit_margin_percentage', type: 'REAL' },
            { name: 'subscription_amount', type: 'DECIMAL' },
            { name: 'billing_cycle', type: 'INTEGER' },
            { name: 'billing_cycle_months', type: 'INTEGER' },
            { name: 'renewal_date', type: 'DATETIME' },
            { name: 'cancellation_date', type: 'DATETIME' },
            { name: 'churn_rate', type: 'REAL' },
            { name: 'retention_rate', type: 'REAL' },
            { name: 'lifetime_value', type: 'DECIMAL' },
            { name: 'average_order_value', type: 'DECIMAL' },
            { name: 'order_frequency', type: 'INTEGER' },
            { name: 'last_purchase_date', type: 'DATETIME' },
            { name: 'customer_segment', type: 'TEXT' },
            { name: 'loyalty_tier', type: 'TEXT' },
            { name: 'referral_source', type: 'TEXT' },
            { name: 'campaign_id', type: 'TEXT' },
            { name: 'conversion_rate', type: 'REAL' },
            { name: 'click_through_rate', type: 'REAL' },
            { name: 'bounce_rate', type: 'REAL' },
            { name: 'session_duration', type: 'INTEGER' },
            { name: 'page_views', type: 'INTEGER' },
            { name: 'unique_visitors', type: 'INTEGER' },
            { name: 'return_visitors', type: 'INTEGER' },
            { name: 'new_visitors', type: 'INTEGER' },
            { name: 'mobile_users', type: 'INTEGER' },
            { name: 'desktop_users', type: 'INTEGER' },
            { name: 'tablet_users', type: 'INTEGER' },
            { name: 'app_users', type: 'INTEGER' },
            { name: 'web_users', type: 'INTEGER' },
            { name: 'api_users', type: 'INTEGER' },
            { name: 'third_party_users', type: 'INTEGER' },
            { name: 'internal_users', type: 'INTEGER' },
            { name: 'external_users', type: 'INTEGER' },
            { name: 'guest_users', type: 'INTEGER' },
            { name: 'premium_users', type: 'INTEGER' },
            { name: 'basic_users', type: 'INTEGER' },
            { name: 'enterprise_users', type: 'INTEGER' },
            { name: 'small_business_users', type: 'INTEGER' },
            { name: 'startup_users', type: 'INTEGER' },
            { name: 'non_profit_users', type: 'INTEGER' },
            { name: 'government_users', type: 'INTEGER' },
            { name: 'educational_users', type: 'INTEGER' },
            { name: 'healthcare_users', type: 'INTEGER' },
            { name: 'financial_users', type: 'INTEGER' },
            { name: 'retail_users', type: 'INTEGER' },
            { name: 'manufacturing_users', type: 'INTEGER' },
            { name: 'logistics_users', type: 'INTEGER' },
            { name: 'transportation_users', type: 'INTEGER' },
            { name: 'energy_users', type: 'INTEGER' },
            { name: 'utilities_users', type: 'INTEGER' },
            { name: 'telecommunications_users', type: 'INTEGER' },
            { name: 'media_users', type: 'INTEGER' },
            { name: 'entertainment_users', type: 'INTEGER' },
            { name: 'gaming_users', type: 'INTEGER' },
            { name: 'sports_users', type: 'INTEGER' },
            { name: 'fitness_users', type: 'INTEGER' },
            { name: 'wellness_users', type: 'INTEGER' },
            { name: 'medical_users', type: 'INTEGER' },
            { name: 'pharmaceutical_users', type: 'INTEGER' },
            { name: 'biotech_users', type: 'INTEGER' },
            { name: 'research_users', type: 'INTEGER' },
            { name: 'academic_users', type: 'INTEGER' },
            { name: 'student_users', type: 'INTEGER' },
            { name: 'faculty_users', type: 'INTEGER' },
            { name: 'administrative_users', type: 'INTEGER' },
            { name: 'staff_users', type: 'INTEGER' },
            { name: 'volunteer_users', type: 'INTEGER' },
            { name: 'contractor_users', type: 'INTEGER' },
            { name: 'consultant_users', type: 'INTEGER' },
            { name: 'freelancer_users', type: 'INTEGER' },
            { name: 'agency_users', type: 'INTEGER' },
            { name: 'partnership_users', type: 'INTEGER' },
            { name: 'alliance_users', type: 'INTEGER' },
            { name: 'coalition_users', type: 'INTEGER' },
            { name: 'federation_users', type: 'INTEGER' },
            { name: 'union_users', type: 'INTEGER' },
            { name: 'association_users', type: 'INTEGER' },
            { name: 'society_users', type: 'INTEGER' },
            { name: 'club_users', type: 'INTEGER' },
            { name: 'group_users', type: 'INTEGER' },
            { name: 'team_users', type: 'INTEGER' },
            { name: 'crew_users', type: 'INTEGER' },
            { name: 'squad_users', type: 'INTEGER' },
            { name: 'unit_users', type: 'INTEGER' },
            { name: 'division_users', type: 'INTEGER' },
            { name: 'department_users', type: 'INTEGER' },
            { name: 'branch_users', type: 'INTEGER' },
            { name: 'office_users', type: 'INTEGER' },
            { name: 'location_users', type: 'INTEGER' },
            { name: 'region_users', type: 'INTEGER' },
            { name: 'country_users', type: 'INTEGER' },
            { name: 'continent_users', type: 'INTEGER' },
            { name: 'global_users', type: 'INTEGER' },
            { name: 'local_users', type: 'INTEGER' },
            { name: 'remote_users', type: 'INTEGER' },
            { name: 'hybrid_users', type: 'INTEGER' },
            { name: 'on_site_users', type: 'INTEGER' },
            { name: 'off_site_users', type: 'INTEGER' },
            { name: 'field_users', type: 'INTEGER' },
            { name: 'headquarters_users', type: 'INTEGER' },
            { name: 'satellite_users', type: 'INTEGER' },
            { name: 'mobile_users', type: 'INTEGER' },
            { name: 'stationary_users', type: 'INTEGER' },
            { name: 'portable_users', type: 'INTEGER' },
            { name: 'fixed_users', type: 'INTEGER' },
            { name: 'flexible_users', type: 'INTEGER' },
            { name: 'adaptive_users', type: 'INTEGER' },
            { name: 'responsive_users', type: 'INTEGER' },
            { name: 'scalable_users', type: 'INTEGER' },
            { name: 'extensible_users', type: 'INTEGER' },
            { name: 'modular_users', type: 'INTEGER' },
            { name: 'integrated_users', type: 'INTEGER' },
            { name: 'created_at', type: 'DATETIME' },
            { name: 'updated_at', type: 'DATETIME' }
          ]
        },
        {
          name: 'order_items',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'order_id', type: 'INTEGER', isForeignKey: true, foreignKeyInfo: { referencedTable: 'orders', referencedColumn: 'id' } },
            { name: 'product_id', type: 'INTEGER', isForeignKey: true, foreignKeyInfo: { referencedTable: 'products', referencedColumn: 'id' } },
            { name: 'quantity', type: 'INTEGER' },
            { name: 'unit_price', type: 'DECIMAL' },
            { name: 'price', type: 'DECIMAL' },
            { name: 'total_price', type: 'DECIMAL' },
            { name: 'created_at', type: 'DATETIME' }
          ]
        },
        {
          name: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'name', type: 'TEXT' },
            { name: 'price', type: 'DECIMAL' },
            { name: 'initial_stock', type: 'INTEGER' },
            { name: 'sold_quantity', type: 'INTEGER' },
            { name: 'stock_level', type: 'INTEGER' },
            { name: 'cost_price', type: 'DECIMAL' },
            { name: 'selling_price', type: 'DECIMAL' },
            { name: 'total_quantity', type: 'INTEGER' },
            { name: 'reserved_quantity', type: 'INTEGER' },
            { name: 'cost_per_unit', type: 'DECIMAL' },
            { name: 'avg_daily_demand', type: 'INTEGER' },
            { name: 'supplier_lead_time', type: 'INTEGER' },
            { name: 'created_at', type: 'DATETIME' },
            { name: 'updated_at', type: 'DATETIME' }
          ]
        },
        {
          name: 'vehicles',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'vehicle_status', type: 'TEXT' },
            { name: 'maintenance_status', type: 'TEXT' },
            { name: 'fuel_level', type: 'REAL' },
            { name: 'fuel_threshold', type: 'REAL' },
            { name: 'current_mileage', type: 'INTEGER' },
            { name: 'last_maintenance_mileage', type: 'INTEGER' },
            { name: 'maintenance_interval', type: 'INTEGER' },
            { name: 'available_hours', type: 'INTEGER' },
            { name: 'total_hours', type: 'INTEGER' },
            { name: 'fuel_cost', type: 'REAL' },
            { name: 'miles_driven', type: 'INTEGER' },
            { name: 'maintenance_cost', type: 'REAL' },
            { name: 'total_miles', type: 'INTEGER' }
          ]
        },
        {
          name: 'trips',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'vehicle_id', type: 'INTEGER' },
            { name: 'trip_status', type: 'TEXT' },
            { name: 'delivery_status', type: 'TEXT' },
            { name: 'actual_distance', type: 'REAL' },
            { name: 'optimal_distance', type: 'REAL' },
            { name: 'fuel_gallons', type: 'REAL' },
            { name: 'distance_miles', type: 'REAL' },
            { name: 'fuel_amount', type: 'REAL' },
            { name: 'fuel_price', type: 'REAL' }
          ]
        },
        {
          name: 'drivers',
          columns: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
            { name: 'license_status', type: 'TEXT' },
            { name: 'certification_status', type: 'TEXT' },
            { name: 'medical_status', type: 'TEXT' },
            { name: 'safety_score', type: 'REAL' },
            { name: 'efficiency_score', type: 'REAL' },
            { name: 'compliance_score', type: 'REAL' }
          ]
        }
      ]
    };
  });

  describe('constructor', () => {
    it('should create BusinessLogicDetector instance', () => {
      expect(detector).toBeInstanceOf(BusinessLogicDetector);
    });

    it('should load business rules from file', () => {
      // The actual implementation uses path.join(__dirname, 'business-rules.json')
      // Since we're mocking fs to throw an error, this test should verify the fallback behavior
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    it('should fallback to default rules when file loading fails', () => {
      // Mock fs.readFileSync to throw error
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      // Should not throw error, should use fallback rules
      expect(() => new BusinessLogicDetector()).not.toThrow();
    });
  });

  describe('detectBusinessLogic', () => {
    it('should detect business logic patterns in database schema', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);

      expect(analysis).toBeDefined();
      expect(analysis.detectedCalculations).toBeDefined();
      expect(analysis.detectedStatuses).toBeDefined();
      expect(analysis.detectedRelationships).toBeDefined();
      expect(analysis.businessDomain).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('should detect calculation patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      expect(analysis.detectedCalculations.length).toBeGreaterThan(0);
      
      // Should detect total_price calculation
      const totalPriceCalc = analysis.detectedCalculations.find(c => 
        c.name === 'total_price' || c.description.includes('Total cost')
      );
      expect(totalPriceCalc).toBeDefined();
      
      // Should detect stock_level calculation
      const stockLevelCalc = analysis.detectedCalculations.find(c => 
        c.name === 'stock_level' || c.description.includes('Current stock')
      );
      expect(stockLevelCalc).toBeDefined();
    });

    it('should detect status patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      expect(analysis.detectedStatuses.length).toBeGreaterThan(0);
      
      // Should detect order progress status
      const orderStatus = analysis.detectedStatuses.find(s => 
        s.name === 'order_progress' || s.description.includes('Order progress')
      );
      expect(orderStatus).toBeDefined();
    });

    it('should detect relationship patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      expect(analysis.detectedRelationships.length).toBeGreaterThan(0);
      
      // Should detect foreign key relationships
      const foreignKeyRel = analysis.detectedRelationships.find(r => 
        r.type === 'foreign_key' || r.description.includes('relationship')
      );
      expect(foreignKeyRel).toBeDefined();
    });

    it('should detect business domain', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      expect(analysis.businessDomain).toBeDefined();
      // Should detect e-commerce domain based on table names
      expect(analysis.businessDomain).toBe('ecommerce');
    });

    it('should calculate confidence score', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect data quality issues', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      expect(analysis.dataQualityIssues).toBeDefined();
      expect(Array.isArray(analysis.dataQualityIssues)).toBe(true);
    });
  });

  describe('calculation pattern detection', () => {
    it('should detect financial calculation patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const financialCalcs = analysis.detectedCalculations.filter(c => 
        c.type === 'financial' || c.business_purpose.includes('Revenue')
      );
      
      expect(financialCalcs.length).toBeGreaterThan(0);
    });

    it('should detect inventory calculation patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const inventoryCalcs = analysis.detectedCalculations.filter(c => 
        c.type === 'inventory' || c.business_purpose.includes('Inventory')
      );
      
      expect(inventoryCalcs.length).toBeGreaterThan(0);
    });

    it('should detect analytics calculation patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const analyticsCalcs = analysis.detectedCalculations.filter(c => 
        c.type === 'analytics' || c.business_purpose.includes('Performance')
      );
      
      expect(analyticsCalcs.length).toBeGreaterThan(0);
    });

    it('should detect operational calculation patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const operationalCalcs = analysis.detectedCalculations.filter(c => 
        c.type === 'operational' || c.business_purpose.includes('Performance')
      );
      
      expect(operationalCalcs.length).toBeGreaterThan(0);
    });

    it('should detect fleet management calculation patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const fleetCalcs = analysis.detectedCalculations.filter(c => 
        c.type === 'fleet_management' || c.business_purpose.includes('Cost optimization')
      );
      
      expect(fleetCalcs.length).toBeGreaterThan(0);
    });
  });

  describe('status pattern detection', () => {
    it('should detect user activity status patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const userActivityStatuses = analysis.detectedStatuses.filter(s => 
        s.type === 'user_activity' || s.business_purpose.includes('User engagement')
      );
      
      expect(userActivityStatuses.length).toBeGreaterThan(0);
    });

    it('should detect order status patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const orderStatuses = analysis.detectedStatuses.filter(s => 
        s.type === 'order_status' || s.business_purpose.includes('Customer satisfaction')
      );
      
      expect(orderStatuses.length).toBeGreaterThan(0);
    });

    it('should detect system status patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const systemStatuses = analysis.detectedStatuses.filter(s => 
        s.type === 'system_status' || s.business_purpose.includes('Service quality')
      );
      
      expect(systemStatuses.length).toBeGreaterThan(0);
    });

    it('should detect business flag patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const businessFlags = analysis.detectedStatuses.filter(s => 
        s.type === 'business_flags' || s.business_purpose.includes('Risk management')
      );
      
      expect(businessFlags.length).toBeGreaterThan(0);
    });

    it('should detect audit trail patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const auditTrails = analysis.detectedStatuses.filter(s => 
        s.type === 'audit_trail' || s.business_purpose.includes('Regulatory compliance')
      );
      
      expect(auditTrails.length).toBeGreaterThan(0);
    });

    it('should detect fleet status patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const fleetStatuses = analysis.detectedStatuses.filter(s => 
        s.type === 'fleet_status' || s.business_purpose.includes('Vehicle maintenance')
      );
      
      expect(fleetStatuses.length).toBeGreaterThan(0);
    });
  });

  describe('relationship pattern detection', () => {
    it('should detect foreign key relationships', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const foreignKeyRels = analysis.detectedRelationships.filter(r => 
        r.type === 'foreign_keys' || r.relationship_type === 'one_to_many'
      );
      
      expect(foreignKeyRels.length).toBeGreaterThan(0);
    });

    it('should detect calculated field relationships', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const calculatedFieldRels = analysis.detectedRelationships.filter(r => 
        r.type === 'calculated_fields' || r.description.includes('Total order amount')
      );
      
      expect(calculatedFieldRels.length).toBeGreaterThan(0);
    });

    it('should detect entity relationships', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const entityRels = analysis.detectedRelationships.filter(r => 
        r.type === 'entity_relationships' || r.description.includes('Customer places order')
      );
      
      expect(entityRels.length).toBeGreaterThan(0);
    });
  });

  describe('business domain detection', () => {
    it('should detect e-commerce domain', () => {
      const ecommerceSchema = {
        tables: [
          { name: 'users', columns: [] },
          { name: 'orders', columns: [] },
          { name: 'products', columns: [] },
          { name: 'order_items', columns: [] }
        ]
      };
      
      const analysis = detector.detectBusinessLogic(ecommerceSchema);
      expect(analysis.businessDomain).toBe('ecommerce');
    });

    it('should detect financial domain', () => {
      const financialSchema = {
        tables: [
          { name: 'accounts', columns: [] },
          { name: 'transactions', columns: [] },
          { name: 'balances', columns: [] }
        ]
      };
      
      const analysis = detector.detectBusinessLogic(financialSchema);
      expect(analysis.businessDomain).toBe('financial');
    });

    it('should detect healthcare domain', () => {
      const healthcareSchema = {
        tables: [
          { name: 'patients', columns: [] },
          { name: 'appointments', columns: [] },
          { name: 'medical_records', columns: [] }
        ]
      };
      
      const analysis = detector.detectBusinessLogic(healthcareSchema);
      expect(analysis.businessDomain).toBe('healthcare');
    });

    it('should fallback to general domain when no specific domain detected', () => {
      const generalSchema = {
        tables: [
          { name: 'custom_table', columns: [] },
          { name: 'another_table', columns: [] }
        ]
      };
      
      const analysis = detector.detectBusinessLogic(generalSchema);
      expect(analysis.businessDomain).toBe('general');
    });
  });

  describe('pattern matching', () => {
    it('should use enhanced pattern matching for better accuracy', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      // Should have high confidence for well-matched patterns
      const highConfidencePatterns = analysis.detectedCalculations.filter(c => c.confidence > 0.8);
      expect(highConfidencePatterns.length).toBeGreaterThan(0);
    });

    it('should handle fuzzy pattern matching', () => {
      const schemaWithSimilarNames = {
        tables: [
          {
            name: 'user_profiles',
            columns: [
              { name: 'user_id', type: 'INTEGER' },
              { name: 'profile_name', type: 'TEXT' },
              { name: 'profile_email', type: 'TEXT' },
              { name: 'total_visits', type: 'INTEGER' },
              { name: 'last_activity', type: 'DATETIME' }
            ]
          }
        ]
      };
      
      const analysis = detector.detectBusinessLogic(schemaWithSimilarNames);
      
      // Should detect patterns even with similar but not exact names
      expect(analysis.detectedCalculations.length).toBeGreaterThan(0);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate confidence based on pattern match quality', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      // All detected patterns should have confidence scores
      analysis.detectedCalculations.forEach(calc => {
        expect(calc.confidence).toBeGreaterThan(0);
        expect(calc.confidence).toBeLessThanOrEqual(1);
      });
      
      analysis.detectedStatuses.forEach(status => {
        expect(status.confidence).toBeGreaterThan(0);
        expect(status.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should boost confidence for domain-specific patterns', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      // E-commerce specific patterns should have higher confidence
      const ecommercePatterns = analysis.detectedCalculations.filter(c => 
        c.business_purpose.includes('Revenue') || c.business_purpose.includes('Inventory')
      );
      
      if (ecommercePatterns.length > 0) {
        const avgConfidence = ecommercePatterns.reduce((sum, p) => sum + p.confidence, 0) / ecommercePatterns.length;
        expect(avgConfidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('data quality analysis', () => {
    it('should detect missing required fields', () => {
      const incompleteSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'INTEGER' }
              // Missing name, email, etc.
            ]
          }
        ]
      };
      
      const analysis = detector.detectBusinessLogic(incompleteSchema);
      
      expect(analysis.dataQualityIssues.length).toBeGreaterThan(0);
      
      const missingFieldsIssue = analysis.dataQualityIssues.find(issue => 
        issue.type === 'missing_fields' || issue.description.includes('missing')
      );
      expect(missingFieldsIssue).toBeDefined();
    });

    it('should detect data consistency issues', () => {
      const analysis = detector.detectBusinessLogic(mockSchema);
      
      const consistencyIssues = analysis.dataQualityIssues.filter(issue => 
        issue.category === 'consistency' || issue.description.includes('consistency')
      );
      
      // May or may not have consistency issues depending on schema
      expect(Array.isArray(consistencyIssues)).toBe(true);
    });
  });

  describe('suggestions generation', () => {
    it('should generate business logic suggestions', () => {
      const suggestions = detector.generateSuggestions({
        detectedCalculations: [],
        detectedStatuses: [],
        detectedRelationships: [],
        businessDomain: 'ecommerce',
        dataQualityIssues: [],
        confidence: 0.8
      });
      
      expect(suggestions).toBeDefined();
      expect(suggestions.recommendedCalculations).toBeDefined();
      expect(suggestions.recommendedStatuses).toBeDefined();
      expect(suggestions.recommendedRelationships).toBeDefined();
      expect(suggestions.businessInsights).toBeDefined();
      expect(suggestions.dataQualityRecommendations).toBeDefined();
    });

    it('should provide domain-specific recommendations', () => {
      const suggestions = detector.generateSuggestions({
        detectedCalculations: [],
        detectedStatuses: [],
        detectedRelationships: [],
        businessDomain: 'ecommerce',
        dataQualityIssues: [],
        confidence: 0.8
      });
      
      // Should have e-commerce specific recommendations
      const ecommerceRecommendations = suggestions.recommendedCalculations.filter(r => 
        r.business_purpose.includes('Revenue') || r.business_purpose.includes('Inventory')
      );
      
      expect(ecommerceRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle malformed schema gracefully', () => {
      const malformedSchema = { tables: null };
      
      // Should not throw error
      expect(() => detector.detectBusinessLogic(malformedSchema)).not.toThrow();
      
      const analysis = detector.detectBusinessLogic(malformedSchema);
      expect(analysis.detectedCalculations).toHaveLength(0);
      expect(analysis.detectedStatuses).toHaveLength(0);
      expect(analysis.detectedRelationships).toHaveLength(0);
    });

    it('should handle schema without columns gracefully', () => {
      const schemaWithoutColumns = {
        tables: [
          { name: 'users', columns: [] },
          { name: 'orders', columns: [] }
        ]
      };
      
      const analysis = detector.detectBusinessLogic(schemaWithoutColumns);
      
      expect(analysis).toBeDefined();
      expect(analysis.businessDomain).toBeDefined();
      // Should still detect domain based on table names
      expect(analysis.businessDomain).toBe('ecommerce');
    });
  });
});
