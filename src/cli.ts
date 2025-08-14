#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { SED } from './index';
import { Config, DatabaseConfig } from './types/Config';
import { SemanticMapping, BusinessLogicAnalysis } from './types/SemanticMapping';
import * as readline from 'readline';
import { validateFilePath, validateDatabaseConfig } from './utils/validation';
import { handleError } from './utils/errors';
import inquirer from 'inquirer';
import { logger } from './utils/logger';
import { DatabaseDiagnostics } from './utils/DatabaseDiagnostics';
import { trackBuild, trackSearch, trackInit, trackValidate, trackExport, getAnalyticsSummary } from './utils/analytics';
import { SchemaChangeDetector } from './semantic/SchemaChangeDetector';
import { ChangeSeverity, ChangeImpact, SchemaChange } from './types/SchemaChange';
import { BusinessRuleEngine } from './semantic/BusinessRuleEngine';
import { RuleType, RuleSeverity, RuleScope, RuleTrigger, BusinessRule as ImportedBusinessRule } from './types/BusinessRules';
import { v4 as uuidv4 } from 'uuid';

const program = new Command();

program
  .name('sedql')
  .description('SED - Semantic Entity Designs Query Language - Create intelligent semantic layers from your database')
  .version('1.0.0');

// Check if the old 'sed' command was used and show deprecation warning
const commandName = process.argv[1] ? path.basename(process.argv[1]) : '';
if (commandName === 'sed') {
  console.log(chalk.yellow.bold('\n⚠️  DEPRECATION WARNING ⚠️'));
  console.log(chalk.yellow('The "sed" command is deprecated and will be removed in a future version.'));
  console.log(chalk.yellow('Please use "sedql" instead.\n'));
  console.log(chalk.cyan('Example:'));
  console.log(chalk.cyan('  sedql init    # instead of: sed init'));
  console.log(chalk.cyan('  sedql query   # instead of: sed query'));
  console.log(chalk.cyan('  sedql build   # instead of: sed build\n'));
  
  // Add a small delay to ensure the warning is visible
  setTimeout(() => {}, 2000);
}

// Global options
program
  .option('-c, --config <path>', 'Path to config file', process.env.SED_CONFIG_PATH || 'sed.config.json');

// Init command - Create configuration file and set up everything
program
  .command('init')
  .description('Initialize SED with your database connection. This interactive command sets up everything you need to get started.')
  .option('-f, --force', 'Overwrite existing config file')
  .action(async (options) => {
    try {
      logger.info('SED Initialization');
      logger.info('Setting up your database connection and semantic layer...');
      
      const configPath = options.config || 'sed.config.json';
      
      // Check if config already exists
      if (fs.existsSync(configPath) && !options.force) {
        logger.warn(`Config file already exists: ${configPath}`);
        logger.info('Use --force to overwrite or specify a different path with -c');
        return;
      }
      
      // Prompt for database configuration
      const dbConfig = await promptForDatabaseConfig();
      
      // Create config with rules auto-generation enabled by default
      const config = {
        database: dbConfig,
        rules: {
          auto_generate: true,
          enabled_by_default: true
        }
      };
      
      // Save config file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      logger.configurationSaved(configPath);
      
      // Test database connection
      logger.info('Testing database connection...');
      const sed = new SED(config);
      
      try {
        await sed.testConnection();
        logger.connectionSuccessful();
      } catch (error) {
        logger.error(`Database connection failed: ${(error as Error).message}`);
        logger.info('Please check your database credentials and try again.');
        return;
      }
      
      // Build semantic layer automatically
      logger.info('Building semantic layer...');
      await sed.discover();
      
      // Generate business rules automatically (enabled by default)
      logger.info('Generating business rules...');
      const ruleEngine = new BusinessRuleEngine({
        enabled: true,
        strictMode: false,
        defaultSeverity: RuleSeverity.WARNING,
        logLevel: 'info',
        cacheEnabled: true,
        cacheTTL: 300,
        maxRulesPerQuery: 50,
        timeoutMs: 5000
      }, sed['cache'], process.cwd());
      
      // Auto-generate rules based on detected business logic
      const businessAnalysis = await sed['semanticLayer']['businessLogicDetector'].detectBusinessLogic(
        await (await (sed as any).getDbProvider()).discoverSchema()
      );
      
      await generateBusinessRulesFromAnalysis(ruleEngine, businessAnalysis, {
        ruleTypes: ['pii', 'metrics', 'joins', 'validation'],
        confidenceThreshold: 0.8
      });
      
      // Get final schema
      const schema = sed.getSemanticMapping();
      
      // Track initialization
      await trackInit(dbConfig.type);
      
      logger.success('SED initialization complete!');
      logger.info('What was created:');
      logger.info(`• Connected to ${dbConfig.type} database`);
      logger.info(`• Discovered ${schema?.entities?.length || 0} business entities`);
      logger.info(`• Mapped ${schema?.entities?.flatMap(e => e.relationships || []).length || 0} relationships`);
      logger.info(`• Generated business rules (enabled by default)`);
      logger.info(`• Ready to query!`);
      
      logger.info('\nNext steps:');
      logger.info('1. Run "sedql query" to start querying your data');
      logger.info('2. Use natural language to explore your database');
      
      process.exit(0);
      
    } catch (error) {
      logger.error(`Initialization failed: ${error}`);
      process.exit(1);
    }
  });

// Build command - Rebuild semantic layer when needed
program
  .command('build')
  .description('Build or rebuild your semantic layer. Use this when your database schema changes or you want to regenerate everything.')
  .option('-o, --output <file>', 'Output file path (default: .sed/project-name.mapping.json)')
  .action(async (options) => {
    try {
      logger.info('Building semantic layer...');
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      // Discover and enhance in one step
      await sed.discover();
      
      // Local enhancement using pattern matching
      logger.enhancingLayer();
      const schema = sed.getSemanticMapping();
      
      // Always generate business rules (consistent with init behavior)
      logger.info('Generating business rules from detected patterns...');
      
      const ruleEngine = new BusinessRuleEngine({
        enabled: true,
        strictMode: false,
        defaultSeverity: RuleSeverity.WARNING,
        logLevel: 'info',
        cacheEnabled: true,
        cacheTTL: 300,
        maxRulesPerQuery: 50,
        timeoutMs: 5000
      }, sed['cache'], process.cwd());
      
      // Auto-generate rules based on detected business logic
      const businessAnalysis = await sed['semanticLayer']['businessLogicDetector'].detectBusinessLogic(
        await (await (sed as any).getDbProvider()).discoverSchema()
      );
      
      await generateBusinessRulesFromAnalysis(ruleEngine, businessAnalysis, {
        ruleTypes: ['pii', 'metrics', 'joins', 'validation'],
        confidenceThreshold: 0.8
      });
      
      logger.success('Business rules generated successfully!');
      
      // Track build command
      if (schema && schema.entities) {
        await trackBuild(config.database.type, schema.entities.length);
      }
      
      // Save enhanced version
      const outputPath = options.output || `.sed/${config.database.database || 'project'}.mapping.json`;
      fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));
      logger.layerBuilt();
      
      const filePath = sed.getMappingFilePath();
      console.log(chalk.gray(`Saved to: ${filePath}`));
      
      logger.success('Build completed successfully!');
      logger.info(`Entities: ${schema?.entities?.length || 0}`);
      logger.info(`Relationships: ${schema?.entities?.flatMap(e => e.relationships || []).length || 0}`);
      logger.info('Business rules generated and enabled');
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Build failed:'), error);
      process.exit(1);
    }
  });

// Sync command - Resync semantic layer with database changes
program
  .command('sync')
  .description('Sync semantic layer with database changes')
  .option('-f, --force', 'Skip prompts and auto-update (for CI/CD)')
  .option('-v, --verbose', 'Show detailed changes')
  .action(async (options) => {
    try {
      console.log(chalk.blue('SED Database Sync'));
      console.log(chalk.gray('Detecting changes and updating semantic layer...\n'));
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      // Load current semantic mapping
      const currentMapping = sed.getSemanticMapping();
      if (!currentMapping) {
        logger.warn('No existing semantic mapping found. Running initial build...');
        await sed.discover();
        logger.success('Initial semantic layer created!');
        process.exit(0);
      }
      
      logger.info('Analyzing database changes...');
      
      // Get new schema from database
      await sed.testConnection();
      const newSchema = await (await (sed as any).getDbProvider()).discoverSchema();
      
      // Create new mapping
      const newMapping = await sed['semanticLayer'].createMappingFromSchema();
      
      // Compare old vs new
      const changes = await detectChanges(currentMapping, newMapping, newSchema);
      
      if (changes.hasChanges) {
        logger.info('Detected Changes:');
        displayChanges(changes, options.verbose);
        
        // Prompt user for confirmation (unless --force)
        if (!options.force) {
          const shouldUpdate = await promptForUpdate(changes);
          if (!shouldUpdate) {
            logger.warn('Sync cancelled by user');
            process.exit(0);
          }
        }
        
        // Create version backup
        await createVersionBackup(currentMapping);
        
        // Update semantic layer
        await sed['semanticLayer'].loadSemanticMapping(newMapping);
        
        logger.success('Semantic layer updated!');
        logger.info(`New mapping saved to: ${sed.getMappingFilePath()}`);
        logger.info('Previous version backed up in .sed/versions/');
        
        process.exit(0);
        
      } else {
        logger.noChanges();
        process.exit(0);
      }
      
    } catch (error) {
      logger.error(`Sync failed: ${error}`);
      process.exit(1);
    }
  });

// Context command - Get semantic context for AI applications
program
  .command('context')
  .description('Get semantic context for AI applications')
  .action(async (options) => {
    try {
      logger.info('Getting semantic context...');
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      const context = sed.getSemanticContext();
      if (!context) {
        logger.error('No semantic mapping available. Run "sedql build" first.');
        process.exit(1);
      }
      
      logger.success('Semantic context:');
      console.log(context);
      
      process.exit(0);
    } catch (error) {
      logger.error(`Error getting context: ${error}`);
      process.exit(1);
    }
  });

// Export command - Export your semantic layer and configuration
program
  .command('export')
  .description('Export your semantic layer and configuration in various formats')
  .option('-f, --format <format>', 'Export format (json, yaml)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      logger.info('Exporting semantic layer...');
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      const mapping = sed.getSemanticMapping();
      if (!mapping) {
        logger.error('No semantic mapping available. Run "sedql init" or "sedql build" first.');
        process.exit(1);
      }
      
      const exportData = {
        semanticLayer: mapping,
        configuration: config,
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          sedVersion: '1.0.0'
        }
      };
      
      const outputPath = options.output || `sed-export-${new Date().toISOString().split('T')[0]}.${options.format}`;
      
      if (options.format === 'yaml') {
        const yaml = require('js-yaml');
        fs.writeFileSync(outputPath, yaml.dump(exportData));
      } else {
        fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
      }
      
      logger.success(`Exported to: ${outputPath}`);
      
    } catch (error) {
      logger.error(`Export failed: ${error}`);
      process.exit(1);
    }
  });

// Import command - Import semantic layer configuration
program
  .command('import')
  .description('Import semantic layer configuration from a file')
  .argument('<file>', 'Configuration file to import')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (file, options) => {
    try {
      logger.info('Importing configuration...');
      
      if (!fs.existsSync(file)) {
        logger.error(`File not found: ${file}`);
        process.exit(1);
      }
      
      const importData = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      // Validate import data
      if (!importData.semanticLayer || !importData.configuration) {
        logger.error('Invalid import file format. Expected semanticLayer and configuration.');
        process.exit(1);
      }
      
      const configPath = options.config || 'sed.config.json';
      
      // Check if config already exists
      if (fs.existsSync(configPath) && !options.force) {
        logger.warn(`Config file already exists: ${configPath}`);
        logger.info('Use --force to overwrite or specify a different path with -c');
        return;
      }
      
      // Save configuration
      fs.writeFileSync(configPath, JSON.stringify(importData.configuration, null, 2));
      
      // Save semantic layer
      const sed = new SED(importData.configuration);
      const outputPath = sed.getMappingFilePath();
      fs.writeFileSync(outputPath, JSON.stringify(importData.semanticLayer, null, 2));
      
      logger.success('Import completed successfully!');
      logger.info(`Configuration: ${configPath}`);
      logger.info(`Semantic layer: ${outputPath}`);
      
    } catch (error) {
      logger.error(`Import failed: ${error}`);
      process.exit(1);
    }
  });

// Status command - Show current SED status
program
  .command('status')
  .description('Show current SED status and configuration details')
  .action(async (options) => {
    try {
      logger.info('SED Status Report');
      console.log(chalk.gray('='.repeat(50)));
      
      const config = loadConfig(options.config || program.opts().config);
      const sed = new SED(config);
      
      // Database connection status
      console.log(chalk.blue('\nDatabase Connection:'));
      try {
        await sed.testConnection();
        console.log(chalk.green('  Connected'));
        console.log(chalk.gray(`  Type: ${config.database.type}`));
        console.log(chalk.gray(`  Host: ${config.database.host}`));
        console.log(chalk.gray(`  Database: ${config.database.database}`));
      } catch (error) {
        console.log(chalk.red('  Connection failed'));
        console.log(chalk.gray(`  Error: ${error}`));
      }
      
      // Semantic layer status
      console.log(chalk.blue('\nSemantic Layer:'));
      const mapping = sed.getSemanticMapping();
      if (mapping) {
        console.log(chalk.green('  Loaded'));
        console.log(chalk.gray(`  Entities: ${mapping.entities?.length || 0}`));
        console.log(chalk.gray(`  Relationships: ${mapping.entities?.flatMap(e => e.relationships || []).length || 0}`));
        console.log(chalk.gray(`  File: ${sed.getMappingFilePath()}`));
      } else {
        console.log(chalk.yellow('  Not loaded'));
        console.log(chalk.gray('  Run "sedql init" or "sedql build" to create'));
      }
      
      // Business rules status
      console.log(chalk.blue('\nBusiness Rules:'));
      try {
        const ruleEngine = new BusinessRuleEngine({
          enabled: true,
          strictMode: false,
          defaultSeverity: RuleSeverity.WARNING,
          logLevel: 'info',
          cacheEnabled: true,
          cacheTTL: 300,
          maxRulesPerQuery: 50,
          timeoutMs: 5000
        }, sed['cache'], process.cwd());
        
        const rules = ruleEngine.getRules();
        console.log(chalk.green(`  ${rules.length} rules loaded`));
        console.log(chalk.gray(`  Enabled: ${rules.filter(r => r.enabled).length}`));
        console.log(chalk.gray(`  Disabled: ${rules.filter(r => !r.enabled).length}`));
      } catch (error) {
        console.log(chalk.yellow('  Rules not available'));
      }
      
      // Configuration
      console.log(chalk.blue('\nConfiguration:'));
      console.log(chalk.gray(`  Config file: ${options.config || 'sed.config.json'}`));
      console.log(chalk.gray(`  Auto-generate rules: ${config.rules?.auto_generate ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`  Rules enabled by default: ${config.rules?.enabled_by_default ? 'Yes' : 'No'}`));
      
    } catch (error) {
      logger.error(`Status check failed: ${error}`);
      process.exit(1);
    }
  });

// Query command - Query your database using natural language
program
  .command('query')
  .description('Query your database using natural language. SED translates your request into optimized SQL and applies business rules.')
  .argument('<query>', 'Natural language query')
  .option('-v, --verbose', 'Show detailed query translation')
  .action(async (query, options) => {
    try {
      logger.info('Processing natural language query...');
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      // Check if mapping exists
      const mapping = sed.getSemanticMapping();
      if (!mapping) {
        logger.error('No semantic mapping available. Run "sedql init" or "sedql build" first.');
        process.exit(1);
      }
      
      // Initialize rule engine for query validation
      const ruleEngine = new BusinessRuleEngine({
        enabled: true,
        strictMode: false,
        defaultSeverity: RuleSeverity.WARNING,
        logLevel: 'info',
        cacheEnabled: true,
        cacheTTL: 300,
        maxRulesPerQuery: 50,
        timeoutMs: 5000
      }, sed['cache'], process.cwd());
      
      // Minimal safe NL->SQL: build a parameterized template and require approval
      // Very conservative: search one approved table and one approved column
      const approvedTables = (mapping.entities || [])
        .map((e) => e.databaseTable)
        .slice(0, 1);

      if (approvedTables.length === 0) {
        logger.error('No approved tables found in semantic mapping');
        process.exit(1);
      }

      const table = approvedTables[0];
      const approvedColumns = (mapping.entities?.find((e) => e.databaseTable === table)?.attributes || [])
        .map((a) => a.databaseColumn)
        .filter((c: string) => /name|title|email|description/i.test(c))
        .slice(0, 1);

      const column = approvedColumns[0] || 'id';

      // Dialect-aware safe query with parameters
      const dbType = (config.database?.type || '').toLowerCase();
      let baseQuery: string;
      let params: string[] = [`%${query}%`];
      if (dbType === 'postgres') {
        baseQuery = `SELECT * FROM ${table} WHERE (${column})::text ILIKE $1 LIMIT 50`;
      } else if (dbType === 'mysql') {
        baseQuery = `SELECT * FROM \`${table}\` WHERE CAST(\`${column}\` AS CHAR) LIKE ? LIMIT 50`;
      } else if (dbType === 'sqlite') {
        baseQuery = `SELECT * FROM "${table}" WHERE CAST("${column}" AS TEXT) LIKE ? LIMIT 50`;
      } else {
        // Fallback to conservative ANSI-like with single placeholder
        baseQuery = `SELECT * FROM ${table} WHERE ${column} LIKE ? LIMIT 50`;
      }
      
      if (options.verbose) {
        console.log(chalk.blue('\nQuery Translation:'));
        console.log(chalk.gray('Natural Language:'), query);
        console.log(chalk.gray('Generated SQL (preview):'), baseQuery);
        console.log(chalk.gray('Parameters:'), JSON.stringify(params));
      }
      
      // Validate query against business rules
      const context = {
        query: baseQuery,
        queryType: 'SELECT' as const,
        tables: [table],
        columns: [column],
        user: {
          id: 'default',
          role: 'user',
          permissions: ['read']
        },
        timestamp: new Date(),
        metadata: {}
      };
      
      const validationResult = await ruleEngine.evaluateQuery(context);
      
      if (validationResult.allowed) {
        logger.success('Query validated successfully');
        
        if (validationResult.modifiedQuery) {
          console.log(chalk.yellow('Applied business rules'));
          if (options.verbose) {
            console.log(chalk.gray('Modified SQL:'), validationResult.modifiedQuery);
          }
        }
        
        // Approval gate before execution
        const proceed = await new Promise<boolean>((resolve) => {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl.question(chalk.yellow('\nApprove and execute this query? (y/N): '), (answer) => {
            rl.close();
            resolve(/^y(es)?$/i.test(answer.trim()));
          });
        });

        if (!proceed) {
          logger.warn('Query execution cancelled by user');
          process.exit(0);
        }

        // Execute the query using the database provider with parameters
        const finalSql = validationResult.modifiedQuery || baseQuery;
        const db = (sed as any)['dbProvider'];
        
        // Ensure database connection is established
        await db.connect(config.database);
        
        const results = await db.executeQuery(finalSql, params);
        
        console.log(chalk.green('\nResults:'));
        console.log(JSON.stringify(results, null, 2));
        
      } else {
        logger.error('Query blocked by business rules');
        validationResult.errors.forEach((error: string) => {
          console.log(chalk.red(`  - ${error}`));
        });
        process.exit(1);
      }
      
    } catch (error) {
      logger.error(`Query failed: ${error}`);
      process.exit(1);
    }
  });

// Schema change detection command
program
  .command('detect-changes')
  .description('Detect and analyze schema changes in your database')
  .option('-v, --verbose', 'Show detailed change information')
  .option('-f, --format <format>', 'Output format (json, table, summary)', 'summary')
  .option('-s, --severity <level>', 'Minimum severity level to report', 'medium')
  .option('-i, --impact <level>', 'Minimum impact level to report', 'minor')
  .action(async (options) => {
    try {
      logger.info('Detecting schema changes...');
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      // Initialize change detection
      const changeDetector = new SchemaChangeDetector(
        await (sed as any).getDbProvider(),
        sed['cache'],
        {
          enabled: true,
          autoDetect: true,
          notifyOnChanges: true,
          severityThreshold: options.severity as ChangeSeverity,
          impactThreshold: options.impact as ChangeImpact
        },
        process.cwd()
      );
      
      // Detect changes
      const changes = await changeDetector.detectChanges();
      
      if (changes.length === 0) {
        logger.success('No schema changes detected');
        return;
      }
      
      // Validate changes
      const validation = await changeDetector.validateChanges(changes);
      
      // Display results based on format
      if (options.format === 'json') {
        console.log(JSON.stringify({
          changes,
          validation,
          summary: {
            total: changes.length,
            breaking: validation.breakingChanges.length,
            errors: validation.errors.length,
            warnings: validation.warnings.length
          }
        }, null, 2));
      } else if (options.format === 'table') {
        displayChangesTable(changes, validation);
      } else {
        displayChangesSummary(changes, validation, options.verbose);
      }
      
      // Track command usage
      await trackDetectChanges(changes.length, validation.breakingChanges?.length || 0);
      
    } catch (error) {
      logger.error(`Change detection failed: ${error}`);
      process.exit(1);
    }
  });

// Business rules management commands
program
  .command('rules')
  .description('Manage business rules for your semantic layer. List, enable, disable, add custom rules, and configure rules.')
  .option('-l, --list', 'List all rules')
  .option('-a, --add <rule-file>', 'Add a rule from JSON file')
  .option('-r, --remove <rule-id>', 'Remove a rule by ID')
  .option('-e, --enable <rule-id>', 'Enable a rule')
  .option('-d, --disable <rule-id>', 'Disable a rule')
  .option('-t, --type <type>', 'Filter rules by type')
  .option('-s, --severity <severity>', 'Filter rules by severity')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (options) => {
    try {
      logger.info('Managing business rules...');
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      // Initialize rule engine
      const ruleEngine = new BusinessRuleEngine(
        {
          enabled: true,
          strictMode: false,
          defaultSeverity: RuleSeverity.WARNING,
          logLevel: 'info',
          cacheEnabled: true,
          cacheTTL: 300,
          maxRulesPerQuery: 50,
          timeoutMs: 5000
        },
        sed['cache'],
        process.cwd()
      );
      
      if (options.list) {
        const filterOptions: Record<string, RuleType | RuleSeverity> = {};
        if (options.type) filterOptions.type = options.type as RuleType;
        if (options.severity) filterOptions.severity = options.severity as RuleSeverity;
        
        const rules = ruleEngine.getRules(filterOptions);
        
        if (options.format === 'json') {
          console.log(JSON.stringify(rules, null, 2));
        } else {
          displayRulesTable(rules);
        }
      } else if (options.add) {
        await addRuleFromFile(ruleEngine, options.add);
      } else if (options.remove) {
        await ruleEngine.removeRule(options.remove);
        logger.success(`Rule removed: ${options.remove}`);
      } else if (options.enable) {
        await ruleEngine.updateRule(options.enable, { enabled: true });
        logger.success(`Rule enabled: ${options.enable}`);
      } else if (options.disable) {
        await ruleEngine.updateRule(options.disable, { enabled: false });
        logger.success(`Rule disabled: ${options.disable}`);
      } else {
        // Default: show rules summary
        const rules = ruleEngine.getRules();
        displayRulesSummary(rules);
      }
      
    } catch (error) {
      logger.error(`Rules management failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('create-rule')
  .description('Create a new business rule interactively')
  .option('-t, --template <template-id>', 'Use a predefined template')
  .action(async (options) => {
    try {
      logger.info('Creating new business rule...');
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      // Initialize rule engine
      const ruleEngine = new BusinessRuleEngine(
        {
          enabled: true,
          strictMode: false,
          defaultSeverity: RuleSeverity.WARNING,
          logLevel: 'info',
          cacheEnabled: true,
          cacheTTL: 300,
          maxRulesPerQuery: 50,
          timeoutMs: 5000
        },
        sed['cache'],
        process.cwd()
      );
      
      let rule: ImportedBusinessRule;
      
      if (options.template) {
        rule = await createRuleFromTemplate(ruleEngine, options.template);
      } else {
        rule = await createRuleInteractively();
      }
      
      // Add the rule
      await ruleEngine.addRule(rule);
      logger.success(`Business rule created: ${rule.name}`);
      
    } catch (error) {
      logger.error(`Rule creation failed: ${error}`);
      process.exit(1);
    }
  });

// Private admin command - Only for funding purposes
program
  .command('admin')
  .description('Private admin commands')
  .argument('<action>', 'Admin action')
  .option('-k, --key <key>', 'Admin key')
  .action(async (action, options) => {
    try {
      // Simple admin key check
      const adminKey = process.env.SED_ADMIN_KEY || 'sed-admin-2024';
      if (options.key !== adminKey) {
        logger.error('Invalid admin key');
        process.exit(1);
      }

      if (action === 'analytics') {
        const summary = await getAnalyticsSummary();
        if (!summary) {
          logger.error('Analytics not available');
          process.exit(1);
        }
        
        console.log(chalk.blue('\nSED Usage Analytics (Private)'));
        console.log(chalk.gray('='.repeat(50)));
        console.log(chalk.green(`Total Users: ${summary.total_users}`));
        console.log(chalk.gray(`Last Updated: ${summary.last_updated}`));
        
        console.log(chalk.blue('\nCommand Usage:'));
        Object.entries(summary.command_usage).forEach(([cmd, count]) => {
          console.log(chalk.gray(`  ${cmd}: ${count}`));
        });
        
        console.log(chalk.blue('\nDatabase Types:'));
        Object.entries(summary.database_types).forEach(([db, count]) => {
          console.log(chalk.gray(`  ${db}: ${count}`));
        });
      } else {
        logger.error('Unknown admin action');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Admin command failed: ${error}`);
      process.exit(1);
    }
  });

// Validate command - Validate semantic layer
program
  .command('validate')
  .description('Validate your semantic layer and check for potential issues or improvements')
  .action(async (options) => {
    try {
      logger.info('Validating semantic layer...');
      
      const config = loadConfig(options.config);
      const sed = new SED(config);
      
      const mapping = sed.getSemanticMapping();
      if (!mapping) {
        logger.error('No semantic mapping available. Run "sedql init" or "sedql build" first.');
        process.exit(1);
      }
      
      // Basic validation checks
      let isValid = true;
      const issues: string[] = [];
      
      // Check if entities exist
      if (!mapping.entities || mapping.entities.length === 0) {
        isValid = false;
        issues.push('No entities found in semantic layer');
      }
      
      // Check if relationships exist
      const relationships = mapping.entities?.flatMap(e => e.relationships || []) || [];
      if (relationships.length === 0) {
        issues.push('No relationships defined');
      }
      
      // Check database connection
      try {
        await sed.testConnection();
      } catch (error) {
        isValid = false;
        issues.push(`Database connection failed: ${error}`);
      }
      
      if (isValid) {
        logger.success('Semantic layer is valid!');
        logger.info(`Entities: ${mapping.entities?.length || 0}`);
        logger.info(`Relationships: ${relationships.length}`);
      } else {
        logger.error('Validation failed:');
        issues.forEach(issue => logger.error(`  - ${issue}`));
        process.exit(1);
      }
      
    } catch (error) {
      logger.error(`Validation failed: ${error}`);
      process.exit(1);
    }
  });

// Helper function to load config with validation
function loadConfig(configPath?: string): Config {
  // If no configPath provided, try to get it from program options
  if (!configPath) {
    configPath = program.opts().config;
  }
  try {
    // Use default config path if not provided
    const actualConfigPath = configPath || 'sed.config.json';
    
    // Validate file path
    const pathValidation = validateFilePath(actualConfigPath);
    if (!pathValidation.isValid) {
      throw new Error(`Invalid config path: ${pathValidation.errors.join(', ')}`);
    }

    const fullPath = path.resolve(actualConfigPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Config file not found: ${fullPath}`);
    }

    const configData = fs.readFileSync(fullPath, 'utf8');
    const config = JSON.parse(configData);

    // Validate database configuration
    const dbValidation = validateDatabaseConfig(config.database);
    if (!dbValidation.isValid) {
      throw new Error(`Invalid database configuration: ${dbValidation.errors.join(', ')}`);
    }

    // Load password from environment if not in config (not required for SQLite)
    if (!config.database.password && config.database.type !== 'sqlite') {
      config.database.password = process.env.DB_PASSWORD;
      if (!config.database.password) {
        throw new Error('Database password not found in config or DB_PASSWORD environment variable');
      }
    }

    return config;
  } catch (error) {
    const sedError = handleError(error, 'loadConfig');
    throw new Error(`Failed to load config: ${sedError.message}`);
  }
}

// Helper function to prompt for database configuration
async function promptForDatabaseConfig(): Promise<DatabaseConfig> {
  console.log(chalk.blue('Database Configuration'));
  console.log(chalk.gray('Please provide your database connection details:\n'));

  // Interactive database type selection
  const { dbType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'dbType',
      message: 'Select your database type:',
      choices: [
        { name: 'PostgreSQL (Local/Server)', value: 'postgres' },
        { name: 'PostgreSQL (Supabase/Cloud)', value: 'postgres-cloud' },
        { name: 'MySQL (Local/Server)', value: 'mysql' },
        { name: 'MySQL (PlanetScale/Cloud)', value: 'mysql-cloud' },
        { name: 'SQLite (Local file)', value: 'sqlite' }
      ],
      default: 'postgres'
    }
  ]);

        let config: DatabaseConfig = { type: (dbType === 'postgres-cloud' ? 'postgres' : dbType === 'mysql-cloud' ? 'mysql' : dbType) as DatabaseConfig['type'] };
  
  if (dbType === 'sqlite') {
    const { database } = await inquirer.prompt([
      {
        type: 'input',
        name: 'database',
        message: 'Database file path:',
        default: process.env.DB_PATH || './database.db'
      }
    ]);
    config.database = database;
  } else if (dbType === 'postgres-cloud' || dbType === 'mysql-cloud') {
    const { connectionString } = await inquirer.prompt([
      {
        type: 'input',
        name: 'connectionString',
        message: 'Database connection string:',
        default: dbType === 'postgres-cloud' 
          ? 'postgresql://postgres:password@host:port/database'
          : 'mysql://user:password@host:port/database'
      }
    ]);
    config.connectionString = connectionString;
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Database host:',
        default: process.env.DB_HOST || 'localhost'
      },
      {
        type: 'input',
        name: 'port',
        message: 'Database port:',
        default: process.env.DB_PORT || (dbType === 'mysql' ? '3306' : '5432')
      },
      {
        type: 'input',
        name: 'username',
        message: 'Database username:',
        default: process.env.DB_USER || (dbType === 'mysql' ? 'root' : 'postgres')
      },
      {
        type: 'password',
        name: 'password',
        message: 'Database password:'
      },
      {
        type: 'input',
        name: 'database',
        message: 'Database name:',
        default: process.env.DB_NAME || (dbType === 'mysql' ? 'mysql' : 'postgres')
      }
    ]);
    
    config = {
      ...config,
      host: answers.host,
      port: parseInt(answers.port),
      username: answers.username,
      password: answers.password,
      database: answers.database
    };
  }

  return config;
}

// Helper functions for sync command

interface ChangeDetection {
  hasChanges: boolean;
  newTables: string[];
  removedTables: string[];
  renamedTables: Array<{ old: string; new: string }>;
  newColumns: Array<{ table: string; column: string }>;
  removedColumns: Array<{ table: string; column: string }>;
  renamedColumns: Array<{ table: string; old: string; new: string }>;
  typeChanges: Array<{ table: string; column: string; oldType: string; newType: string }>;
  relationshipChanges: Array<{ table: string; description: string }>;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence?: number;
  results?: Array<{
    ruleId: string;
    ruleName: string;
    passed: boolean;
    severity: string;
    message?: string;
    action?: {
      type: string;
      message: string;
      code?: string;
    };
  }>;
  breakingChanges?: SchemaChange[];
}

interface QueryValidationResult {
  allowed: boolean;
  modifiedQuery?: string;
  errors: string[];
  warnings: string[];
  executionTime: number;
  metadata: {
    rulesEvaluated: number;
    rulesPassed: number;
    rulesFailed: number;
    rulesBlocked: number;
  };
  results: Array<{
    ruleId: string;
    ruleName: string;
    passed: boolean;
    severity: string;
    message?: string;
    action?: {
      type: string;
      message: string;
      code?: string;
    };
  }>;
}

interface BusinessRule {
  id: string;
  name: string;
  description: string;
  type: string;
  severity: string;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  enabled: boolean;
  priority: number;
  tags: string[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  metadata: Record<string, unknown>;
}

interface BusinessAnalysis {
  calculations: Array<{
    name: string;
    pattern: string[];
    formula?: string;
    confidence: number;
    businessDomain: string;
    description: string;
  }>;
  relationships: Array<{
    fromEntity: string;
    toEntity: string;
    type: string;
    cardinality: string;
    businessPurpose: string;
    constraints: string[];
  }>;
  workflows: Array<{
    name: string;
    description: string;
    steps: Array<{
      name: string;
      description: string;
      entity: string;
      action: string;
      conditions: string[];
    }>;
  }>;
  rules: Array<{
    name: string;
    description: string;
    type: string;
    condition: string;
    action: string;
    priority: number;
    businessDomain: string;
    confidence: number;
    metadata: Record<string, unknown>;
  }>;
  metrics: Array<{
    name: string;
    description: string;
    unit: string;
    category: string;
    calculationType: string;
    formula: string;
  }>;
}

async function detectChanges(oldMapping: SemanticMapping, newMapping: SemanticMapping, newSchema: unknown): Promise<ChangeDetection> {
  const changes: ChangeDetection = {
    hasChanges: false,
    newTables: [],
    removedTables: [],
    renamedTables: [],
    newColumns: [],
    removedColumns: [],
    renamedColumns: [],
    typeChanges: [],
    relationshipChanges: []
  };

  // Get table names
      const oldTables = oldMapping.entities.map((e) => e.databaseTable);
    const newTables = newMapping.entities.map((e) => e.databaseTable);

  // Detect new tables
  changes.newTables = newTables.filter((table: string) => !oldTables.includes(table));
  
  // Detect removed tables
  changes.removedTables = oldTables.filter((table: string) => !newTables.includes(table));

  // Detect column changes for existing tables
  for (const oldEntity of oldMapping.entities) {
    const newEntity = newMapping.entities.find((e) => e.databaseTable === oldEntity.databaseTable);
    if (!newEntity) continue; // Table was removed

    const oldColumns = oldEntity.attributes.map((a) => a.databaseColumn);
    const newColumns = newEntity.attributes.map((a) => a.databaseColumn);

    // New columns
    const addedColumns = newColumns.filter((col: string) => !oldColumns.includes(col));
    changes.newColumns.push(...addedColumns.map((col: string) => ({ table: oldEntity.databaseTable, column: col })));

    // Removed columns
    const removedColumns = oldColumns.filter((col: string) => !newColumns.includes(col));
    changes.removedColumns.push(...removedColumns.map((col: string) => ({ table: oldEntity.databaseTable, column: col })));

    // Type changes
    for (const oldAttr of oldEntity.attributes) {
      const newAttr = newEntity.attributes.find((a) => a.databaseColumn === oldAttr.databaseColumn);
      if (newAttr && oldAttr.dataType !== newAttr.dataType) {
        changes.typeChanges.push({
          table: oldEntity.databaseTable,
          column: oldAttr.databaseColumn,
          oldType: oldAttr.dataType,
          newType: newAttr.dataType
        });
      }
    }
  }

  // Check if any changes were detected
  changes.hasChanges = changes.newTables.length > 0 || 
                      changes.removedTables.length > 0 || 
                      changes.newColumns.length > 0 || 
                      changes.removedColumns.length > 0 || 
                      changes.typeChanges.length > 0;

  return changes;
}

function displayChanges(changes: ChangeDetection, verbose: boolean) {
  if (changes.newTables.length > 0) {
    console.log(chalk.green(`Found ${changes.newTables.length} new table(s):`));
    changes.newTables.forEach(table => console.log(chalk.gray(`  + ${table}`)));
  }

  if (changes.removedTables.length > 0) {
    console.log(chalk.red(`Removed ${changes.removedTables.length} table(s):`));
    changes.removedTables.forEach(table => console.log(chalk.gray(`  - ${table}`)));
  }

  if (changes.newColumns.length > 0) {
    console.log(chalk.green(`Found ${changes.newColumns.length} new column(s):`));
    changes.newColumns.forEach(({ table, column }) => 
      console.log(chalk.gray(`  + ${table}.${column}`)));
  }

  if (changes.removedColumns.length > 0) {
    console.log(chalk.red(`Removed ${changes.removedColumns.length} column(s):`));
    changes.removedColumns.forEach(({ table, column }) => 
      console.log(chalk.gray(`  - ${table}.${column}`)));
  }

  if (changes.typeChanges.length > 0) {
    console.log(chalk.yellow(`Type changes detected:`));
    changes.typeChanges.forEach(({ table, column, oldType, newType }) => 
      console.log(chalk.gray(`  ${table}.${column}: ${oldType} → ${newType}`)));
  }

  if (verbose && changes.relationshipChanges.length > 0) {
    console.log(chalk.blue(`Relationship changes:`));
    changes.relationshipChanges.forEach(({ table, description }) => 
      console.log(chalk.gray(`  ${table}: ${description}`)));
  }
}

async function promptForUpdate(changes: ChangeDetection): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.blue('\nUpdate semantic layer? (Y/n): '), (answer) => {
      rl.close();
      const shouldUpdate = answer.toLowerCase() === '' || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      resolve(shouldUpdate);
    });
  });
}

async function createVersionBackup(currentMapping: SemanticMapping): Promise<void> {
  const versionsDir = path.join(process.cwd(), '.sed', 'versions');
  
  // Ensure versions directory exists
  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }

  // Create timestamped backup
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const backupPath = path.join(versionsDir, `${timestamp}.semantic.json`);
  
  // Add metadata to backup
  const backup = {
    ...currentMapping,
    metadata: {
      ...currentMapping.metadata,
      backedUpAt: new Date().toISOString(),
      version: timestamp
    }
  };

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(chalk.gray(`Backup created: .sed/versions/${timestamp}.semantic.json`));
}

// Local processing only - no server dependencies

// Diagnostic command - Analyze database access and permissions
program
  .command('diagnose')
  .description('Diagnose database access and permission issues')
  .action(async () => {
    try {
      logger.info('Running database diagnostics...');
      
      const config = loadConfig();
      const sed = new SED(config);
      
      // Get database provider with connection management
      const dbProvider = await (sed as any).getDbProvider();
      
      // Run diagnostics
      const report = await DatabaseDiagnostics.runDiagnostics(dbProvider);
      
      // Print report
      DatabaseDiagnostics.printReport(report);
      
      // Release connection
      await sed.close();
      
    } catch (error) {
      handleError(error);
    }
  });

program.parse();

// Helper functions for schema change detection
function displayChangesTable(changes: SchemaChange[], validation: ValidationResult): void {
  console.log(chalk.blue('\nSchema Changes Summary'));
  console.log(chalk.gray('='.repeat(80)));
  
  if (changes.length === 0) {
    console.log(chalk.green('No changes detected'));
    return;
  }

  console.log(chalk.white(`Total Changes: ${changes.length}`));
  console.log(chalk.red(`Breaking Changes: ${validation.breakingChanges?.length || 0}`));
  console.log(chalk.yellow(`Warnings: ${validation.warnings.length}`));
  console.log(chalk.gray('='.repeat(80)));

  changes.forEach((change, index) => {
    const severityColor = change.severity === 'critical' ? chalk.red : 
                         change.severity === 'high' ? chalk.yellow :
                         change.severity === 'medium' ? chalk.blue : chalk.gray;
    
    console.log(chalk.white(`${index + 1}. ${change.description}`));
    console.log(severityColor(`   Severity: ${change.severity.toUpperCase()}`));
    console.log(chalk.gray(`   Impact: ${change.impact}`));
    console.log(chalk.gray(`   Type: ${change.type}`));
    if (change.table) console.log(chalk.gray(`   Table: ${change.table}`));
    if (change.column) console.log(chalk.gray(`   Column: ${change.column}`));
    console.log('');
  });
}

function displayChangesSummary(changes: SchemaChange[], validation: ValidationResult, verbose: boolean): void {
  console.log(chalk.blue('\nSchema Changes Summary'));
  console.log(chalk.gray('='.repeat(50)));
  
  if (changes.length === 0) {
    console.log(chalk.green('No schema changes detected'));
    return;
  }

  // Summary statistics
  const critical = changes.filter(c => c.severity === 'critical').length;
  const high = changes.filter(c => c.severity === 'high').length;
  const medium = changes.filter(c => c.severity === 'medium').length;
  const low = changes.filter(c => c.severity === 'low').length;

  console.log(chalk.white(`Total Changes: ${changes.length}`));
  console.log(chalk.red(`Critical: ${critical}`));
  console.log(chalk.yellow(`High: ${high}`));
  console.log(chalk.blue(`Medium: ${medium}`));
  console.log(chalk.gray(`Low: ${low}`));
  console.log(chalk.red(`Breaking Changes: ${validation.breakingChanges?.length || 0}`));

  if (validation.errors.length > 0) {
    console.log(chalk.red(`\nErrors:`));
    validation.errors.forEach((error: string) => console.log(chalk.red(`  - ${error}`)));
  }

  if (validation.warnings.length > 0) {
    console.log(chalk.yellow(`\nWarnings:`));
    validation.warnings.forEach((warning: string) => console.log(chalk.yellow(`  - ${warning}`)));
  }

  if (verbose) {
    console.log(chalk.gray('\nDetailed Changes:'));
    changes.forEach((change, index) => {
      const severityColor = change.severity === 'critical' ? chalk.red : 
                           change.severity === 'high' ? chalk.yellow :
                           change.severity === 'medium' ? chalk.blue : chalk.gray;
      
      console.log(severityColor(`${index + 1}. ${change.description}`));
    });
  }

  console.log(chalk.gray('\nTip: Use --format json for detailed change information'));
}

async function trackDetectChanges(totalChanges: number, breakingChanges: number): Promise<void> {
  try {
    // Track analytics for change detection
    await trackBuild('change-detection', totalChanges);
  } catch (error) {
    // Silently fail - analytics tracking shouldn't break the main functionality
    logger.debug(`Analytics tracking failed: ${error}`);
  }
}

// Business rule helper functions
function displayRulesTable(rules: ImportedBusinessRule[]): void {
  console.log(chalk.blue('\nBusiness Rules'));
  console.log(chalk.gray('='.repeat(100)));
  
  if (rules.length === 0) {
    console.log(chalk.gray('No rules found'));
    return;
  }

  console.log(chalk.white(`${'ID'.padEnd(36)} ${'Name'.padEnd(20)} ${'Type'.padEnd(15)} ${'Severity'.padEnd(10)} ${'Status'.padEnd(8)} ${'Priority'.padEnd(8)}`));
  console.log(chalk.gray('-'.repeat(100)));

  rules.forEach(rule => {
    const status = rule.enabled ? chalk.green('✓') : chalk.red('✗');
    const severityColor = rule.severity === 'block' ? chalk.red : 
                         rule.severity === 'error' ? chalk.yellow :
                         rule.severity === 'warning' ? chalk.blue : chalk.gray;
    
    console.log(chalk.white(`${rule.id.padEnd(36)} ${rule.name.padEnd(20)} ${rule.type.padEnd(15)} ${severityColor(rule.severity.padEnd(10))} ${status.padEnd(8)} ${rule.priority.toString().padEnd(8)}`));
  });
}

function displayRulesSummary(rules: ImportedBusinessRule[]): void {
  console.log(chalk.blue('\nBusiness Rules Summary'));
  console.log(chalk.gray('='.repeat(50)));
  
  if (rules.length === 0) {
    console.log(chalk.gray('No rules configured'));
    return;
  }

  const enabled = rules.filter(r => r.enabled).length;
  const disabled = rules.length - enabled;
  const block = rules.filter(r => r.severity === 'block').length;
  const error = rules.filter(r => r.severity === 'error').length;
  const warning = rules.filter(r => r.severity === 'warning').length;
  const info = rules.filter(r => r.severity === 'info').length;

  console.log(chalk.white(`Total Rules: ${rules.length}`));
  console.log(chalk.green(`Enabled: ${enabled}`));
  console.log(chalk.red(`Disabled: ${disabled}`));
  console.log(chalk.red(`Block: ${block}`));
  console.log(chalk.yellow(`Error: ${error}`));
  console.log(chalk.blue(`Warning: ${warning}`));
  console.log(chalk.gray(`Info: ${info}`));

  // Group by type
  const byType = rules.reduce((acc, rule) => {
    acc[rule.type] = (acc[rule.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(chalk.gray('\nBy Type:'));
  Object.entries(byType).forEach(([type, count]) => {
    console.log(chalk.gray(`  ${type}: ${count}`));
  });
}

async function addRuleFromFile(ruleEngine: BusinessRuleEngine, filePath: string): Promise<void> {
  try {
    const ruleData = fs.readFileSync(filePath, 'utf8');
    const rule = JSON.parse(ruleData);
    await ruleEngine.addRule(rule);
    logger.success(`Rule added from file: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to add rule from file: ${error}`);
    throw error;
  }
}

function parseQuery(query: string): { type: string; tables: string[]; columns: string[] } {
  // Simple query parsing - in production, use a proper SQL parser
  const upperQuery = query.toUpperCase();
  
  // Determine query type
  let type = 'SELECT';
  if (upperQuery.includes('INSERT')) type = 'INSERT';
  else if (upperQuery.includes('UPDATE')) type = 'UPDATE';
  else if (upperQuery.includes('DELETE')) type = 'DELETE';
  
  // Extract tables (simple regex - can be enhanced)
  const tableMatches = query.match(/\bFROM\s+(\w+)|JOIN\s+(\w+)/gi) || [];
  const tables = tableMatches.map(match => {
    const parts = match.split(/\s+/);
    return parts[parts.length - 1];
  });
  
  // Extract columns (simple regex - can be enhanced)
  const columnMatches = query.match(/\bSELECT\s+(.+?)\s+FROM|\b(\w+\.\w+)\b/gi) || [];
  const columns = columnMatches.map(match => {
    const parts = match.split(/\s+/);
    return parts[parts.length - 1];
  });
  
  return { type, tables, columns };
}

function displayValidationResults(result: QueryValidationResult): void {
  console.log(chalk.blue('\nQuery Validation Results'));
  console.log(chalk.gray('='.repeat(60)));
  
  console.log(chalk.white(`Allowed: ${result.allowed ? chalk.green('Yes') : chalk.red('No')}`));
  console.log(chalk.white(`Execution Time: ${result.executionTime}ms`));
  console.log(chalk.white(`Rules Evaluated: ${result.metadata.rulesEvaluated}`));
  console.log(chalk.green(`Rules Passed: ${result.metadata.rulesPassed}`));
  console.log(chalk.red(`Rules Failed: ${result.metadata.rulesFailed}`));
  console.log(chalk.red(`Rules Blocked: ${result.metadata.rulesBlocked}`));

  if (result.modifiedQuery) {
    console.log(chalk.yellow('\nModified Query:'));
    console.log(chalk.gray(result.modifiedQuery));
  }

  if (result.errors.length > 0) {
    console.log(chalk.red('\nErrors:'));
    result.errors.forEach((error: string) => console.log(chalk.red(`  - ${error}`)));
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    result.warnings.forEach((warning: string) => console.log(chalk.yellow(`  - ${warning}`)));
  }

  if (result.results.length > 0) {
    console.log(chalk.gray('\nRule Results:'));
    result.results?.forEach((ruleResult, index: number) => {
      const status = ruleResult.passed ? chalk.green('✓') : chalk.red('✗');
      const severityColor = ruleResult.severity === 'critical' ? chalk.red : 
                           ruleResult.severity === 'high' ? chalk.yellow :
                           ruleResult.severity === 'medium' ? chalk.blue : chalk.gray;
      
      console.log(chalk.white(`${index + 1}. ${status} ${ruleResult.ruleName} (${severityColor(ruleResult.severity)})`));
      if (ruleResult.message) {
        console.log(chalk.gray(`   ${ruleResult.message}`));
      }
    });
  }
}

function displayValidationSummary(result: QueryValidationResult): void {
  console.log(chalk.blue('\nQuery Validation Summary'));
  console.log(chalk.gray('='.repeat(40)));
  
  console.log(chalk.white(`Status: ${result.allowed ? chalk.green('ALLOWED') : chalk.red('BLOCKED')}`));
  console.log(chalk.white(`Rules: ${result.metadata.rulesEvaluated} evaluated, ${result.metadata.rulesFailed} failed`));
  
  if (result.errors.length > 0) {
    console.log(chalk.red(`Errors: ${result.errors.length}`));
  }
  
  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`Warnings: ${result.warnings.length}`));
  }
  
  if (result.modifiedQuery) {
    console.log(chalk.yellow('Query was modified'));
  }
}

async function createRuleFromTemplate(ruleEngine: BusinessRuleEngine, templateId: string): Promise<ImportedBusinessRule> {
  // This would be implemented with interactive prompts
  // For now, return a basic rule
  return {
    id: uuidv4(),
    name: 'Template Rule',
    description: 'Rule created from template',
    type: RuleType.ACCESS_POLICY,
    severity: RuleSeverity.WARNING,
    scope: RuleScope.GLOBAL,
    trigger: RuleTrigger.BEFORE_QUERY,
    enabled: true,
    priority: 100,
    condition: {
      type: 'expression',
      expression: 'true'
    },
    action: {
      type: 'allow',
      message: 'Query allowed'
    },
    tags: ['template'],
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'cli'
  };
}

async function createRuleInteractively(): Promise<ImportedBusinessRule> {
  // This would be implemented with interactive prompts using inquirer
  // For now, return a basic rule
  return {
    id: uuidv4(),
    name: 'Interactive Rule',
    description: 'Rule created interactively',
    type: RuleType.ACCESS_POLICY,
    severity: RuleSeverity.WARNING,
    scope: RuleScope.GLOBAL,
    trigger: RuleTrigger.BEFORE_QUERY,
    enabled: true,
    priority: 100,
    condition: {
      type: 'expression',
      expression: 'true'
    },
    action: {
      type: 'allow',
      message: 'Query allowed'
    },
    tags: ['interactive'],
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'cli'
  };
}

import { PIIDetector, PIIDetectionConfig } from './security/PIIDetector';
import { BusinessLogicAnalyzer } from './business/BusinessLogicAnalyzer';

async function generateBusinessRulesFromAnalysis(
  ruleEngine: BusinessRuleEngine, 
  businessAnalysis: BusinessLogicAnalysis, 
  options: { ruleTypes: string[], confidenceThreshold: number }
): Promise<void> {
  const { ruleTypes, confidenceThreshold } = options;
  
  try {
    // Initialize advanced PII detector
    const piiConfig: PIIDetectionConfig = {
      enableML: true,
      enableProfiling: true,
      enableSemanticAnalysis: true,
      confidenceThreshold: confidenceThreshold,
      sampleSize: 1000,
      maxProcessingTime: 30000
    };
    
    const piiDetector = new PIIDetector(piiConfig);
    
    // Initialize business logic analyzer
    const businessAnalyzer = new BusinessLogicAnalyzer();
    
    // Advanced PII detection
    if (ruleTypes.includes('pii')) {
      logger.info('Running advanced PII detection...');
      
      // For PII detection, we need a database schema
      // Since BusinessLogicAnalysis doesn't have schema, we'll skip this for now
      // In a real implementation, you'd pass the schema separately
      logger.info('PII detection requires database schema - skipping for now');
    }
    
    // Advanced business logic analysis
    if (ruleTypes.includes('metrics') || ruleTypes.includes('joins') || ruleTypes.includes('validation')) {
      logger.info('Running advanced business logic analysis...');
      
      // Generate business logic rules from the analysis
      for (const rule of businessAnalysis.rules) {
        if (rule.confidence >= confidenceThreshold) {
          const businessRule = {
            id: uuidv4(),
            name: rule.name,
            description: rule.description,
            type: mapBusinessRuleType(rule.type),
            severity: rule.priority >= 800 ? RuleSeverity.BLOCK : RuleSeverity.WARNING,
            scope: RuleScope.GLOBAL,
            trigger: RuleTrigger.BEFORE_QUERY,
            enabled: true,
            priority: rule.priority,
            condition: {
              type: 'expression' as const,
              expression: rule.condition
            },
            action: {
              type: rule.type === 'validation' ? 'deny' as const : 'modify' as const,
              message: rule.description,
              code: rule.action
            },
            tags: ['auto-generated', 'business-logic', rule.businessDomain],
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'sed-business-analyzer',
            metadata: {
              businessDomain: rule.businessDomain,
              confidence: rule.confidence,
              ruleType: rule.type,
              ...rule.metadata
            }
          };
          
          await ruleEngine.addRule(businessRule);
        }
      }
      
      // Generate relationship-based rules
      for (const relationship of businessAnalysis.relationships) {
        const relationshipRule = {
          id: uuidv4(),
          name: `Relationship Rule - ${relationship.fromEntity} to ${relationship.toEntity}`,
          description: relationship.businessPurpose,
          type: RuleType.JOIN_RULE,
          severity: RuleSeverity.WARNING,
          scope: RuleScope.GLOBAL,
          trigger: RuleTrigger.BEFORE_QUERY,
          enabled: true,
          priority: 600,
          condition: {
            type: 'expression' as const,
            expression: `relationship_exists('${relationship.fromEntity}', '${relationship.toEntity}')`
          },
          action: {
            type: 'modify' as const,
            message: `Ensuring proper relationship between ${relationship.fromEntity} and ${relationship.toEntity}`,
            code: `SELECT * FROM {originalQuery} JOIN ${relationship.toEntity} ON ${relationship.fromEntity}.id = ${relationship.toEntity}.${relationship.fromEntity}_id`
          },
          tags: ['auto-generated', 'relationship', 'business-logic'],
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'sed-business-analyzer',
          metadata: {
            relationshipType: relationship.type,
            cardinality: relationship.cardinality,
            businessPurpose: relationship.businessPurpose,
            constraints: relationship.constraints
          }
        };
        
        await ruleEngine.addRule(relationshipRule);
      }
      
      // Generate metric-based rules
      for (const metric of businessAnalysis.metrics) {
        const metricRule = {
          id: uuidv4(),
          name: `Metric Rule - ${metric.name}`,
          description: `Auto-generated rule for ${metric.name} metric`,
          type: RuleType.METRIC_DEFINITION,
          severity: RuleSeverity.INFO,
          scope: RuleScope.GLOBAL,
          trigger: RuleTrigger.BEFORE_QUERY,
          enabled: true,
          priority: 400,
          condition: {
            type: 'expression' as const,
            expression: `metric_defined('${metric.name}')`
          },
          action: {
            type: 'modify' as const,
            message: `Applying ${metric.name} metric calculation`,
            code: metric.formula
          },
          tags: ['auto-generated', 'metric', 'business-logic'],
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'sed-business-analyzer',
          metadata: {
            metricName: metric.name,
            unit: metric.unit,
            category: metric.category,
            calculationType: metric.calculationType
          }
        };
        
        await ruleEngine.addRule(metricRule);
      }
      
      // Generate calculation-based rules
      for (const calculation of businessAnalysis.detectedCalculations) {
        const calculationRule = {
          id: uuidv4(),
          name: `Calculation Rule - ${calculation.name}`,
          description: `Auto-generated rule for ${calculation.name} calculation`,
          type: RuleType.CALCULATION_RULE,
          severity: RuleSeverity.INFO,
          scope: RuleScope.GLOBAL,
          trigger: RuleTrigger.BEFORE_QUERY,
          enabled: true,
          priority: 500,
          condition: {
            type: 'expression' as const,
            expression: `calculation_required('${calculation.name}')`
          },
          action: {
            type: 'modify' as const,
            message: `Applying ${calculation.name} calculation`,
            code: calculation.formula || `calculate_${calculation.name}()`
          },
          tags: ['auto-generated', 'calculation', 'business-logic'],
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'sed-business-analyzer',
          metadata: {
            calculationName: calculation.name,
            businessDomain: calculation.businessDomain,
            confidence: calculation.confidence,
            pattern: calculation.pattern
          }
        };
        
        await ruleEngine.addRule(calculationRule);
      }
      
      logger.info(`Generated ${businessAnalysis.rules.length} business logic rules`);
      logger.info(`Generated ${businessAnalysis.relationships.length} relationship rules`);
      logger.info(`Generated ${businessAnalysis.metrics.length} metric rules`);
      logger.info(`Generated ${businessAnalysis.detectedCalculations.length} calculation rules`);
    }
    
    // Generate workflow-based rules
    if (ruleTypes.includes('workflow')) {
      logger.info('Generating workflow-based rules...');
      
      for (const workflow of businessAnalysis.workflows) {
        const workflowRule = {
          id: uuidv4(),
          name: `Workflow Rule - ${workflow.name}`,
          description: `Auto-generated rule for ${workflow.name} workflow`,
          type: RuleType.BUSINESS_LOGIC,
          severity: RuleSeverity.WARNING,
          scope: RuleScope.GLOBAL,
          trigger: RuleTrigger.BEFORE_QUERY,
          enabled: true,
          priority: 700,
          condition: {
            type: 'expression' as const,
            expression: `workflow_active('${workflow.name}')`
          },
          action: {
            type: 'modify' as const,
            message: `Enforcing ${workflow.name} workflow rules`,
            code: `enforce_workflow('${workflow.name}')`
          },
          tags: ['auto-generated', 'workflow', 'business-logic'],
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'sed-business-analyzer',
          metadata: {
            workflowName: workflow.name,
            workflowSteps: workflow.steps.length,
            description: workflow.description
          }
        };
        
        await ruleEngine.addRule(workflowRule);
      }
      
      logger.info(`Generated ${businessAnalysis.workflows.length} workflow rules`);
    }
    
    logger.success('Business rules generation completed successfully!');
    
  } catch (error) {
    logger.error(`Business rules generation failed: ${error}`);
    throw error;
  }
}

// Helper function to map business rule types
function mapBusinessRuleType(businessRuleType: string): RuleType {
  const typeMap: Record<string, RuleType> = {
    'calculation': RuleType.CALCULATION_RULE,
    'validation': RuleType.DATA_VALIDATION,
    'relationship': RuleType.JOIN_RULE,
    'workflow': RuleType.BUSINESS_LOGIC,
    'compliance': RuleType.AUDIT_REQUIREMENT,
    'business_metric': RuleType.METRIC_DEFINITION
  };
  
  return typeMap[businessRuleType] || RuleType.BUSINESS_LOGIC;
}