export interface SemanticEntity {
  name: string;
  description: string;
  databaseTable: string;
  attributes: SemanticAttribute[];
  relationships: SemanticRelationship[];
  businessRules?: BusinessRule[];
  metadata?: EntityMetadata;
}

export interface SemanticAttribute {
  name: string;
  description: string;
  databaseColumn: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'json';
  isRequired: boolean;
  isPrimaryKey?: boolean;
  businessLogic?: string; // e.g., "format as currency", "calculate age from birthdate"
  metadata?: AttributeMetadata;
}

export interface SemanticRelationship {
  name: string;
  description: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromEntity: string;
  toEntity: string;
  fromAttribute: string;
  toAttribute: string;
  joinCondition?: string; // Custom SQL join condition
  metadata?: RelationshipMetadata;
}

export interface BusinessRule {
  name: string;
  description: string;
  condition: string; // e.g., "amount > 1000"
  action: string; // e.g., "mark as premium customer"
  priority: number;
}

export interface EntityMetadata {
  tags?: string[];
  lineage?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  permissions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  version?: string;
}

export interface AttributeMetadata {
  tags?: string[];
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  format?: string; // e.g., "currency", "percentage", "email"
  validation?: string; // e.g., "email", "phone", "url"
  unit?: string; // e.g., "USD", "kg", "meters"
}

export interface RelationshipMetadata {
  tags?: string[];
  cardinality?: string; // e.g., "1:N", "M:N"
  cascade?: 'none' | 'cascade' | 'restrict';
}

export interface SemanticMapping {
  entities: SemanticEntity[];
  globalRules?: BusinessRule[];
  metadata: {
    version: string;
    createdAt: Date;
    updatedAt: Date;
    description: string;
    tags?: string[];
    owner?: string;
    environment?: 'development' | 'staging' | 'production';
  };
} 