import chalk from 'chalk';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export class Logger {
  private static instance: Logger;
  private isVerbose: boolean = false;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setVerbose(verbose: boolean): void {
    this.isVerbose = verbose;
  }

  info(message: string): void {
    console.log(chalk.blue(`[INFO] ${message}`));
  }

  warn(message: string): void {
    console.log(chalk.yellow(`[WARN] ${message}`));
  }

  error(message: string): void {
    console.log(chalk.red(`[ERROR] ${message}`));
  }

  debug(message: string): void {
    if (this.isVerbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  success(message: string): void {
    console.log(chalk.green(`[INFO] ${message}`));
  }

  // Specialized logging methods for common operations
  connected(database: string): void {
    this.info(`Connected to ${database}`);
  }

  disconnected(database: string): void {
    this.info(`Disconnected from ${database}`);
  }

  discoveryStarted(): void {
    this.info('Starting database discovery...');
  }

  schemaDiscovered(tables: number, columns: number): void {
    this.info(`Schema discovered: ${tables} tables, ${columns} columns`);
  }

  creatingMapping(): void {
    this.info('Creating semantic mapping with intelligent business logic detection');
  }

  analyzingPatterns(): void {
    this.info('Analyzing table relationships and patterns...');
  }

  businessRulesFallback(): void {
    this.warn('Business rules not loaded — using fallback patterns');
  }

  mappingGenerated(): void {
    this.success('Semantic mapping generated successfully');
  }

  mappingSaved(path: string): void {
    this.info(`Saved mapping to: ${path}`);
  }

  mappingLoaded(entities: number): void {
    this.info(`Semantic layer loaded with ${entities} entities`);
  }

  enhancingLayer(): void {
    this.info('Enhancing semantic layer with local processing...');
  }

  layerBuilt(): void {
    this.success('Semantic layer built successfully');
  }

  validationPassed(): void {
    this.success('Semantic mapping validation passed');
  }

  noChanges(): void {
    this.info('No changes detected. Semantic layer is up to date!');
  }

  changesDetected(): void {
    this.info('Database changes detected. Updating semantic layer...');
  }

  backupCreated(path: string): void {
    this.info(`Version backup created: ${path}`);
  }

  rolledBack(date: string): void {
    this.success(`Successfully rolled back to ${date}`);
  }

  configurationSaved(path: string): void {
    this.success(`Configuration saved to: ${path}`);
  }

  connectionSuccessful(): void {
    this.success('Database connection successful!');
  }

  exportComplete(path: string): void {
    this.success(`Semantic mapping exported to ${path}`);
  }

  validationComplete(): void {
    this.success('Semantic mapping is valid!');
  }

  searchResults(query: string, count: number): void {
    this.info(`Search results for "${query}": ${count} matches found`);
  }

  performanceMetrics(metrics: {
    schemaDiscoveryTime: number;
    processingTime: number;
    tablesProcessed: number;
    columnsProcessed: number;
  }): void {
    this.info('Performance metrics:');
    this.info(`  Schema discovery: ${metrics.schemaDiscoveryTime}ms`);
    this.info(`  Processing time: ${metrics.processingTime}ms`);
    this.info(`  Tables processed: ${metrics.tablesProcessed}`);
    this.info(`  Columns processed: ${metrics.columnsProcessed}`);
  }
}

// Export singleton instance
export const logger = Logger.getInstance(); 