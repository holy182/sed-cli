export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
  description?: string;
}

export interface Table {
  name: string;
  columns: Column[];
  description?: string;
  rowCount?: number;
  relationships?: Relationship[];
}

export interface Relationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface DatabaseSchema {
  tables: Table[];
  relationships: Relationship[];
  metadata: {
    databaseName: string;
    discoveredAt: Date;
    totalTables: number;
    totalColumns: number;
  };
} 