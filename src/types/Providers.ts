// Provider-agnostic interfaces for SED

export interface DatabaseProvider {
  name: string;
  version: string;
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  discoverSchema(): Promise<DatabaseSchema>;
  testConnection(): Promise<boolean>;
  executeQuery(query: string, params?: any[]): Promise<any[]>;
  getTableInfo(tableName: string): Promise<TableInfo>;
  getColumnInfo(tableName: string): Promise<ColumnInfo[]>;
}

export interface AIProvider {
  name: string;
  version: string;
  generateEmbeddings(text: string): Promise<number[]>;
  generateCompletion(prompt: string, options?: AIOptions): Promise<string>;
  generateChatCompletion(messages: Message[], options?: AIOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export interface AgentProvider {
  name: string;
  version: string;
  formatContext(context: SemanticContext): string;
  formatQuery(query: SemanticQuery): string;
  parseResponse(response: string): SemanticQuery;
  getCapabilities(): AgentCapabilities;
}

export interface InfrastructureProvider {
  name: string;
  version: string;
  deploy(config: DeployConfig): Promise<DeployResult>;
  scale(config: ScaleConfig): Promise<ScaleResult>;
  monitor(config: MonitorConfig): Promise<MonitorResult>;
}

// Configuration interfaces
export interface DatabaseConfig {
  type: 'postgres' | 'mysql' | 'snowflake' | 'bigquery' | 'oracle' | 'mongodb' | 'sqlite';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  connectionString?: string;
  options?: Record<string, any>;
}

export interface AIConfig {
  provider: 'openai' | 'groq' | 'claude' | 'gemini' | 'anthropic' | 'custom';
  apiKey?: string;
  model?: string;
  endpoint?: string;
  options?: Record<string, any>;
}

export interface AgentConfig {
  provider: 'langchain' | 'autogen' | 'dust' | 'custom';
  framework?: string;
  options?: Record<string, any>;
}

export interface InfrastructureConfig {
  provider: 'docker' | 'kubernetes' | 'terraform' | 'cloudformation' | 'custom';
  environment: 'local' | 'development' | 'staging' | 'production';
  options?: Record<string, any>;
}

// Data structures
export interface DatabaseSchema {
  tables: TableInfo[];
  views: ViewInfo[];
  procedures: ProcedureInfo[];
  functions: FunctionInfo[];
  metadata: SchemaMetadata;
}

export interface TableInfo {
  name: string;
  schema?: string;
  type: 'table' | 'view' | 'materialized_view';
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  metadata: TableMetadata;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyInfo?: ForeignKeyInfo;
  metadata: ColumnMetadata;
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  [key: string]: any;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface SemanticContext {
  entities: EntityInfo[];
  relationships: RelationshipInfo[];
  businessRules: BusinessRule[];
  metadata: ContextMetadata;
}

export interface SemanticQuery {
  intent: string;
  entities: string[];
  filters: FilterCondition[];
  aggregations: AggregationInfo[];
  metadata: QueryMetadata;
}

export interface AgentCapabilities {
  supportsContext: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  maxContextLength: number;
  supportedFormats: string[];
}

export interface DeployConfig {
  environment: string;
  resources: ResourceConfig[];
  secrets: SecretConfig[];
  networking: NetworkConfig;
}

export interface ScaleConfig {
  minInstances: number;
  maxInstances: number;
  targetCPU: number;
  targetMemory: number;
}

export interface MonitorConfig {
  metrics: string[];
  alerts: AlertConfig[];
  logging: LogConfig;
}

// Result interfaces
export interface DeployResult {
  success: boolean;
  url?: string;
  resources: DeployedResource[];
  logs: string[];
}

export interface ScaleResult {
  success: boolean;
  currentInstances: number;
  targetInstances: number;
}

export interface MonitorResult {
  metrics: MetricData[];
  alerts: Alert[];
  health: HealthStatus;
}

// Metadata interfaces
export interface SchemaMetadata {
  databaseName: string;
  schemaVersion: string;
  lastUpdated: Date;
  totalTables: number;
  totalColumns: number;
  schemas?: string[];
}

export interface TableMetadata {
  description?: string;
  rowCount?: number;
  sizeBytes?: number;
  lastModified?: Date;
  tags?: string[];
}

export interface ColumnMetadata {
  description?: string;
  sampleValues?: any[];
  dataProfile?: DataProfile;
  businessRules?: string[];
}

export interface ContextMetadata {
  version: string;
  createdAt: Date;
  updatedAt: Date;
  source: string;
}

export interface QueryMetadata {
  confidence: number;
  processingTime: number;
  tokensUsed: number;
  cost?: number;
}

// Additional interfaces
export interface EntityInfo {
  name: string;
  type: string;
  description: string;
  attributes: AttributeInfo[];
  relationships: RelationshipInfo[];
}

export interface AttributeInfo {
  name: string;
  type: string;
  description: string;
  isRequired: boolean;
  isUnique: boolean;
  validationRules: string[];
}

export interface RelationshipInfo {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  description: string;
  constraints: string[];
}

export interface BusinessRule {
  name: string;
  description: string;
  condition: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like' | 'between';
  value: any;
  logicalOperator?: 'and' | 'or';
}

export interface AggregationInfo {
  field: string;
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
  alias?: string;
}

export interface DataProfile {
  minValue?: any;
  maxValue?: any;
  avgValue?: any;
  nullCount: number;
  uniqueCount: number;
  distribution?: Record<string, number>;
}

export interface ViewInfo {
  name: string;
  definition: string;
  columns: ColumnInfo[];
}

export interface ProcedureInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
}

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  direction: 'in' | 'out' | 'inout';
  defaultValue?: any;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  isUnique: boolean;
}

export interface ConstraintInfo {
  name: string;
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'not_null';
  columns: string[];
  definition?: string;
}

export interface ForeignKeyInfo {
  referencedTable: string;
  referencedColumn: string;
  referencedSchema?: string;
  onDelete?: 'cascade' | 'set_null' | 'restrict' | 'no_action';
  onUpdate?: 'cascade' | 'set_null' | 'restrict' | 'no_action';
}

export interface ResourceConfig {
  type: 'cpu' | 'memory' | 'storage' | 'network';
  amount: string;
  unit: string;
}

export interface SecretConfig {
  name: string;
  type: 'env' | 'file' | 'vault';
  value?: string;
  path?: string;
}

export interface NetworkConfig {
  port: number;
  protocol: 'http' | 'https' | 'tcp';
  ssl?: boolean;
  cors?: CorsConfig;
}

export interface CorsConfig {
  origins: string[];
  methods: string[];
  headers: string[];
}

export interface DeployedResource {
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  url?: string;
}

export interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  labels: Record<string, string>;
}

export interface Alert {
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved?: boolean;
}

export interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  destination: 'console' | 'file' | 'syslog';
  retention: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  lastChecked: Date;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  responseTime: number;
  message?: string;
} 