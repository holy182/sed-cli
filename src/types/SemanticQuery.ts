export interface SemanticQuery {
  intent: string;
  entities: string[];
  operations: Operation[];
  filters: Filter[];
  aggregations: Aggregation[];
  sortBy?: SortOption[];
  limit?: number;
}

export interface Operation {
  type: 'select' | 'insert' | 'update' | 'delete';
  target: string;
  fields?: string[];
}

export interface Filter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: any;
}

export interface Aggregation {
  type: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field: string;
  alias?: string;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
} 