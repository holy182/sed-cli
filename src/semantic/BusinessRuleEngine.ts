import {
  BusinessRule,
  RuleType,
  RuleSeverity,
  RuleScope,
  RuleTrigger,
  RuleCondition,
  RuleAction,
  RuleEngineConfig,
  RuleExecutionContext,
  RuleExecutionResult,
  RuleEngineResponse,
  RuleTemplate,
  RuleSet,
  AccessPolicyRule,
  MetricDefinitionRule,
  JoinRule,
  DataValidationRule
} from '../types/BusinessRules';
import { CacheManager } from '../cache/CacheManager';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export class BusinessRuleEngine {
  private config: RuleEngineConfig;
  private cache: CacheManager;
  private rules: Map<string, BusinessRule> = new Map();
  private ruleSets: Map<string, RuleSet> = new Map();
  private templates: Map<string, RuleTemplate> = new Map();
  private rulesPath: string;
  private ruleSetsPath: string;
  private templatesPath: string;

  constructor(config: RuleEngineConfig, cache: CacheManager, projectPath: string) {
    this.config = config;
    this.cache = cache;
    this.rulesPath = path.join(projectPath, '.sed', 'rules');
    this.ruleSetsPath = path.join(projectPath, '.sed', 'rulesets');
    this.templatesPath = path.join(projectPath, '.sed', 'templates');
    
    this.ensureDirectories();
    this.loadRules();
    this.loadRuleSets();
    this.loadTemplates();
  }

  /**
   * Evaluate rules against a query context
   */
  async evaluateQuery(context: RuleExecutionContext): Promise<RuleEngineResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug(`Evaluating query: ${context.query.substring(0, 100)}...`);
      
      // Get applicable rules
      const applicableRules = this.getApplicableRules(context);
      
      if (applicableRules.length === 0) {
        return this.createAllowResponse(startTime);
      }

      // Sort rules by priority
      applicableRules.sort((a, b) => b.priority - a.priority);

      const results: RuleExecutionResult[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      let allowed = true;
      let modifiedQuery = context.query;

      // Evaluate each rule
      for (const rule of applicableRules) {
        const ruleStartTime = Date.now();
        
        try {
          const result = await this.evaluateRule(rule, context, modifiedQuery);
          results.push(result);

          if (!result.passed) {
            switch (result.severity) {
              case RuleSeverity.BLOCK:
                allowed = false;
                errors.push(result.message || `Rule '${rule.name}' blocked the query`);
                break;
              case RuleSeverity.ERROR:
                errors.push(result.message || `Rule '${rule.name}' failed`);
                break;
              case RuleSeverity.WARNING:
                warnings.push(result.message || `Rule '${rule.name}' warning`);
                break;
            }
          }

          // Apply rule action if query was modified
          if (result.action?.type === 'modify' && result.action.code) {
            modifiedQuery = this.applyQueryModification(modifiedQuery, result.action);
          }

        } catch (error) {
          logger.error(`Rule evaluation failed for '${rule.name}': ${error}`);
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            passed: false,
            severity: RuleSeverity.ERROR,
            message: `Rule evaluation error: ${error}`,
            executionTime: Date.now() - ruleStartTime
          });
          errors.push(`Rule '${rule.name}' evaluation failed`);
        }
      }

      const executionTime = Date.now() - startTime;
      
      return {
        allowed,
        modifiedQuery: allowed ? modifiedQuery : undefined,
        results,
        warnings,
        errors,
        executionTime,
        metadata: {
          rulesEvaluated: results.length,
          rulesPassed: results.filter(r => r.passed).length,
          rulesFailed: results.filter(r => !r.passed).length,
          rulesBlocked: results.filter(r => r.severity === RuleSeverity.BLOCK).length
        }
      };

    } catch (error) {
      logger.error(`Rule engine evaluation failed: ${error}`);
      return {
        allowed: false,
        results: [],
        warnings: [],
        errors: [`Rule engine error: ${error}`],
        executionTime: Date.now() - startTime,
        metadata: {
          rulesEvaluated: 0,
          rulesPassed: 0,
          rulesFailed: 0,
          rulesBlocked: 0
        }
      };
    }
  }

  /**
   * Add a new business rule
   */
  async addRule(rule: BusinessRule): Promise<void> {
    try {
      // Validate rule
      this.validateRule(rule);
      
      // Check for conflicts
      await this.checkRuleConflicts(rule);
      
      // Add rule
      this.rules.set(rule.id, rule);
      await this.saveRule(rule);
      
      logger.success(`Business rule added: ${rule.name}`);
      
    } catch (error) {
      logger.error(`Failed to add business rule: ${error}`);
      throw new Error(`Failed to add business rule: ${error}`);
    }
  }

  /**
   * Update an existing business rule
   */
  async updateRule(ruleId: string, updates: Partial<BusinessRule>): Promise<void> {
    try {
      const existingRule = this.rules.get(ruleId);
      if (!existingRule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      const updatedRule = { ...existingRule, ...updates, updatedAt: new Date() };
      this.validateRule(updatedRule);
      
      this.rules.set(ruleId, updatedRule);
      await this.saveRule(updatedRule);
      
      logger.success(`Business rule updated: ${updatedRule.name}`);
      
    } catch (error) {
      logger.error(`Failed to update business rule: ${error}`);
      throw new Error(`Failed to update business rule: ${error}`);
    }
  }

  /**
   * Remove a business rule
   */
  async removeRule(ruleId: string): Promise<void> {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      this.rules.delete(ruleId);
      await this.deleteRule(ruleId);
      
      logger.success(`Business rule removed: ${rule.name}`);
      
    } catch (error) {
      logger.error(`Failed to remove business rule: ${error}`);
      throw new Error(`Failed to remove business rule: ${error}`);
    }
  }

  /**
   * Get all rules with optional filtering
   */
  getRules(options: {
    type?: RuleType;
    scope?: RuleScope;
    severity?: RuleSeverity;
    enabled?: boolean;
    tags?: string[];
  } = {}): BusinessRule[] {
    let filteredRules = Array.from(this.rules.values());

    if (options.type) {
      filteredRules = filteredRules.filter(rule => rule.type === options.type);
    }
    if (options.scope) {
      filteredRules = filteredRules.filter(rule => rule.scope === options.scope);
    }
    if (options.severity) {
      filteredRules = filteredRules.filter(rule => rule.severity === options.severity);
    }
    if (options.enabled !== undefined) {
      filteredRules = filteredRules.filter(rule => rule.enabled === options.enabled);
    }
    if (options.tags) {
      filteredRules = filteredRules.filter(rule => 
        options.tags!.some(tag => rule.tags.includes(tag))
      );
    }

    return filteredRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Create a rule from template
   */
  async createRuleFromTemplate(templateId: string, parameters: Record<string, any>): Promise<BusinessRule> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Validate parameters
      this.validateTemplateParameters(template, parameters);

      // Create rule from template
      const rule: BusinessRule = {
        ...template.template,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      } as BusinessRule;

      // Apply parameters
      Object.entries(parameters).forEach(([key, value]) => {
        this.setNestedProperty(rule, key, value);
      });

      // Validate the created rule
      this.validateRule(rule);

      return rule;
      
    } catch (error) {
      logger.error(`Failed to create rule from template: ${error}`);
      throw new Error(`Failed to create rule from template: ${error}`);
    }
  }

  /**
   * Get metric definitions
   */
  getMetricDefinitions(): MetricDefinitionRule[] {
    return this.getRules({ type: RuleType.METRIC_DEFINITION }) as MetricDefinitionRule[];
  }

  /**
   * Get access policies
   */
  getAccessPolicies(): AccessPolicyRule[] {
    return this.getRules({ type: RuleType.ACCESS_POLICY }) as AccessPolicyRule[];
  }

  /**
   * Get join rules
   */
  getJoinRules(): JoinRule[] {
    return this.getRules({ type: RuleType.JOIN_RULE }) as JoinRule[];
  }

  // Private helper methods
  private ensureDirectories(): void {
    const dirs = [this.rulesPath, this.ruleSetsPath, this.templatesPath];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private loadRules(): void {
    try {
      const rulesDir = this.rulesPath;
      if (!fs.existsSync(rulesDir)) return;

      const ruleFiles = fs.readdirSync(rulesDir).filter(file => file.endsWith('.json'));
      
      for (const file of ruleFiles) {
        try {
          const ruleData = fs.readFileSync(path.join(rulesDir, file), 'utf8');
          const rule: BusinessRule = JSON.parse(ruleData);
          this.rules.set(rule.id, rule);
        } catch (error) {
          logger.warn(`Failed to load rule from ${file}: ${error}`);
        }
      }

      logger.info(`Loaded ${this.rules.size} business rules`);
      
    } catch (error) {
      logger.error(`Failed to load business rules: ${error}`);
    }
  }

  private loadRuleSets(): void {
    try {
      const ruleSetsDir = this.ruleSetsPath;
      if (!fs.existsSync(ruleSetsDir)) return;

      const ruleSetFiles = fs.readdirSync(ruleSetsDir).filter(file => file.endsWith('.json'));
      
      for (const file of ruleSetFiles) {
        try {
          const ruleSetData = fs.readFileSync(path.join(ruleSetsDir, file), 'utf8');
          const ruleSet: RuleSet = JSON.parse(ruleSetData);
          this.ruleSets.set(ruleSet.id, ruleSet);
        } catch (error) {
          logger.warn(`Failed to load rule set from ${file}: ${error}`);
        }
      }

      logger.info(`Loaded ${this.ruleSets.size} rule sets`);
      
    } catch (error) {
      logger.error(`Failed to load rule sets: ${error}`);
    }
  }

  private loadTemplates(): void {
    try {
      const templatesDir = this.templatesPath;
      if (!fs.existsSync(templatesDir)) return;

      const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));
      
      for (const file of templateFiles) {
        try {
          const templateData = fs.readFileSync(path.join(templatesDir, file), 'utf8');
          const template: RuleTemplate = JSON.parse(templateData);
          this.templates.set(template.id, template);
        } catch (error) {
          logger.warn(`Failed to load template from ${file}: ${error}`);
        }
      }

      logger.info(`Loaded ${this.templates.size} rule templates`);
      
    } catch (error) {
      logger.error(`Failed to load rule templates: ${error}`);
    }
  }

  private async saveRule(rule: BusinessRule): Promise<void> {
    try {
      const filePath = path.join(this.rulesPath, `${rule.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rule, null, 2));
    } catch (error) {
      logger.error(`Failed to save rule: ${error}`);
      throw new Error(`Failed to save rule: ${error}`);
    }
  }

  private async deleteRule(ruleId: string): Promise<void> {
    try {
      const filePath = path.join(this.rulesPath, `${ruleId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.error(`Failed to delete rule: ${error}`);
      throw new Error(`Failed to delete rule: ${error}`);
    }
  }

  private getApplicableRules(context: RuleExecutionContext): BusinessRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false;
      if (rule.trigger !== RuleTrigger.BEFORE_QUERY) return false;
      
      // Check scope
      switch (rule.scope) {
        case RuleScope.GLOBAL:
          return true;
        case RuleScope.TABLE:
          return context.tables.some(table => 
            rule.condition.expression?.includes(table) || 
            rule.condition.pattern?.includes(table)
          );
        case RuleScope.COLUMN:
          return context.columns.some(column => 
            rule.condition.expression?.includes(column) || 
            rule.condition.pattern?.includes(column)
          );
        default:
          return true;
      }
    });
  }

  private async evaluateRule(
    rule: BusinessRule, 
    context: RuleExecutionContext, 
    currentQuery: string
  ): Promise<RuleExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Evaluate condition
      const conditionResult = await this.evaluateCondition(rule.condition, context, currentQuery);
      
      // Determine if rule should be applied
      const shouldApply = conditionResult;
      
      if (!shouldApply) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          passed: true,
          severity: rule.severity,
          executionTime: Date.now() - startTime
        };
      }

      // Apply rule action
      const actionResult = await this.applyRuleAction(rule.action, context, currentQuery);
      
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        passed: actionResult.success,
        severity: rule.severity,
        message: actionResult.message,
        action: rule.action,
        executionTime: Date.now() - startTime,
        metadata: actionResult.metadata
      };

    } catch (error) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        passed: false,
        severity: RuleSeverity.ERROR,
        message: `Rule evaluation error: ${error}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async evaluateCondition(
    condition: RuleCondition, 
    context: RuleExecutionContext, 
    query: string
  ): Promise<boolean> {
    switch (condition.type) {
      case 'expression':
        return this.evaluateExpression(condition.expression!, context, query);
      case 'pattern':
        return this.evaluatePattern(condition.pattern!, context, query);
      case 'function':
        return this.evaluateFunction(condition.function!, condition.parameters || {}, context);
      case 'composite':
        return this.evaluateCompositeCondition(condition.composite!, context, query);
      default:
        return false;
    }
  }

  private evaluateExpression(expression: string, context: RuleExecutionContext, query: string): boolean {
    // Safe expression evaluator (no arbitrary code execution)
    try {
      const env = this.buildRuleEnv(context);
      const expr = (expression || '').trim();
      return this.evaluateBooleanExpr(expr, env);
    } catch (error) {
      logger.warn(`Expression evaluation failed: ${error}`);
      return false;
    }
  }

  private buildRuleEnv(context: RuleExecutionContext): Record<string, any> {
    const hour = context.timestamp.getHours();
    const weekday = context.timestamp.getDay();
    return {
      queryType: context.queryType,
      tables: context.tables || [],
      columns: context.columns || [],
      user: {
        role: context.user?.role || 'user',
        permissions: context.user?.permissions || []
      },
      hour,
      weekday
    };
  }

  private evaluateBooleanExpr(expr: string, env: Record<string, any>): boolean {
    const trimmed = expr.trim();
    if (trimmed === '') return false;

    // OR
    const orParts = this.splitTopLevel(trimmed, '||');
    if (orParts.length > 1) return orParts.some((p) => this.evaluateBooleanExpr(p, env));

    // AND
    const andParts = this.splitTopLevel(trimmed, '&&');
    if (andParts.length > 1) return andParts.every((p) => this.evaluateBooleanExpr(p, env));

    // Surrounding parentheses
    if (trimmed.startsWith('(') && trimmed.endsWith(')') && this.isBalancedParens(trimmed))
      return this.evaluateBooleanExpr(trimmed.slice(1, -1), env);

    // NOT
    const notMatch = /^(?:!|not\s+)([\s\S]+)$/i.exec(trimmed);
    if (notMatch) return !this.evaluateBooleanExpr(notMatch[1], env);

    return this.evaluateComparison(trimmed, env);
  }
  private evaluateComparison(segment: string, env: Record<string, any>): boolean {
    const ops = [' in ', ' contains ', '>=', '<=', '==', '!=', '>', '<'];
    for (const op of ops) {
      const idx = this.indexOfTopLevel(segment, op);
      if (idx !== -1) {
        const left = segment.slice(0, idx).trim();
        const right = segment.slice(idx + op.length).trim();
        const lVal = this.parseValue(left, env);
        const rVal = this.parseValue(right, env);
        switch (op.trim()) {
          case 'in':
            return Array.isArray(rVal) ? rVal.includes(lVal) : false;
          case 'contains':
            if (Array.isArray(lVal)) return lVal.includes(rVal);
            if (typeof lVal === 'string' && typeof rVal === 'string') return lVal.includes(rVal);
            return false;
          case '==':
            return this.equalsSafe(lVal, rVal);
          case '!=':
            return !this.equalsSafe(lVal, rVal);
          case '>=':
            return Number(lVal) >= Number(rVal);
          case '<=':
            return Number(lVal) <= Number(rVal);
          case '>':
            return Number(lVal) > Number(rVal);
          case '<':
            return Number(lVal) < Number(rVal);
        }
      }
    }
    const low = segment.toLowerCase();
    if (low === 'true') return true;
    if (low === 'false') return false;
    return false;
  }

  private isBalancedParens(s: string): boolean {
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      if (depth < 0) return false;
    }
    return depth === 0;
  }

  private equalsSafe(a: any, b: any): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => this.equalsSafe(v, b[i]));
    }
    return a === b;
  }

  private parseValue(token: string, env: Record<string, any>): any {
    const t = token.trim();
    if (t.startsWith('{') && t.endsWith('}')) {
      return this.resolvePath(env, t.slice(1, -1).trim());
    }
    if (t.startsWith('[') && t.endsWith(']')) {
      const inner = t.slice(1, -1).trim();
      if (inner === '') return [];
      const parts = this.splitTopLevel(inner, ',');
      return parts.map((p) => this.parseValue(p, env));
    }
    if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) return t.slice(1, -1);
    if (t.toLowerCase() === 'true') return true;
    if (t.toLowerCase() === 'false') return false;
    if (/^[+-]?\d+(?:\.\d+)?$/.test(t)) return Number(t);
    return t;
  }

  private resolvePath(obj: any, path: string): any {
    const parts = path.split('.').map((p) => p.trim()).filter(Boolean);
    let cur: any = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  private splitTopLevel(s: string, sep: '||' | '&&' | ',' ): string[] {
    const out: string[] = [];
    let depth = 0, inSingle = false, inDouble = false, last = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (!inSingle && !inDouble) {
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
        else if (depth === 0) {
          if (sep === ',' && c === ',') { out.push(s.slice(last, i)); last = i + 1; }
          else if ((sep === '||' && s.slice(i, i + 2) === '||') || (sep === '&&' && s.slice(i, i + 2) === '&&')) {
            out.push(s.slice(last, i)); last = i + 2; i++;
          }
        }
      }
      if (i === s.length - 1) out.push(s.slice(last));
    }
    return out.map((p) => p.trim()).filter(Boolean);
  }

  private indexOfTopLevel(s: string, op: string): number {
    let depth = 0, inSingle = false, inDouble = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (!inSingle && !inDouble) {
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
        if (depth === 0) {
          if (op === ' in ' || op === ' contains ') {
            if (s.slice(i, i + op.length) === op) return i;
          } else if (op.length === 2) {
            if (s.slice(i, i + 2) === op) return i;
          } else if (op.length === 1) {
            if (s[i] === op) return i;
          }
        }
      }
    }
    return -1;
  }

  private evaluatePattern(pattern: string, context: RuleExecutionContext, query: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(query);
    } catch (error) {
      logger.warn(`Pattern evaluation failed: ${error}`);
      return false;
    }
  }

  private async evaluateFunction(
    functionName: string, 
    parameters: Record<string, any>, 
    context: RuleExecutionContext
  ): Promise<boolean> {
    // Built-in functions
    switch (functionName) {
      case 'hasTable':
        return context.tables.includes(parameters.table);
      case 'hasColumn':
        return context.columns.includes(parameters.column);
      case 'isQueryType':
        return context.queryType === parameters.type;
      case 'hasUserRole':
        return context.user?.role === parameters.role;
      case 'isTimeWindow':
        return this.isInTimeWindow(context.timestamp, parameters.start, parameters.end);
      default:
        logger.warn(`Unknown function: ${functionName}`);
        return false;
    }
  }

  private evaluateCompositeCondition(
    composite: { operator: 'AND' | 'OR' | 'NOT'; conditions: RuleCondition[] },
    context: RuleExecutionContext,
    query: string
  ): boolean {
    const results = composite.conditions.map(condition => 
      this.evaluateCondition(condition, context, query)
    );

    switch (composite.operator) {
      case 'AND':
        return results.every(result => result);
      case 'OR':
        return results.some(result => result);
      case 'NOT':
        return results.length === 1 && !results[0];
      default:
        return false;
    }
  }

  private async applyRuleAction(
    action: RuleAction, 
    context: RuleExecutionContext, 
    query: string
  ): Promise<{ success: boolean; message?: string; metadata?: Record<string, any> }> {
    switch (action.type) {
      case 'allow':
        return { success: true, message: action.message };
      case 'deny':
        return { success: false, message: action.message };
      case 'modify':
        return { success: true, message: action.message, metadata: { modified: true } };
      case 'log':
        logger.info(`Rule log: ${action.message}`);
        return { success: true, message: action.message };
      case 'notify':
        // TODO: Implement notification system
        return { success: true, message: action.message };
      case 'transform':
        return { success: true, message: action.message, metadata: { transformed: true } };
      default:
        return { success: false, message: 'Unknown action type' };
    }
  }

  private applyQueryModification(query: string, action: RuleAction): string {
    if (action.type === 'modify' && action.code) {
      // Simple query modification - can be enhanced with proper SQL parser
      return action.code.replace(/\{originalQuery\}/g, query);
    }
    return query;
  }

  private createAllowResponse(startTime: number): RuleEngineResponse {
    return {
      allowed: true,
      results: [],
      warnings: [],
      errors: [],
      executionTime: Date.now() - startTime,
      metadata: {
        rulesEvaluated: 0,
        rulesPassed: 0,
        rulesFailed: 0,
        rulesBlocked: 0
      }
    };
  }

  private validateRule(rule: BusinessRule): void {
    if (!rule.id || !rule.name || !rule.type) {
      throw new Error('Rule must have id, name, and type');
    }
    
    if (!rule.condition || !rule.action) {
      throw new Error('Rule must have condition and action');
    }
    
    if (rule.priority < 0 || rule.priority > 1000) {
      throw new Error('Rule priority must be between 0 and 1000');
    }
  }

  private async checkRuleConflicts(rule: BusinessRule): Promise<void> {
    if (rule.conflictsWith) {
      for (const conflictingRuleId of rule.conflictsWith) {
        if (this.rules.has(conflictingRuleId)) {
          throw new Error(`Rule conflicts with existing rule: ${conflictingRuleId}`);
        }
      }
    }
  }

  private validateTemplateParameters(template: RuleTemplate, parameters: Record<string, any>): void {
    for (const param of template.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }
    }
  }

  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  private isInTimeWindow(timestamp: Date, start: string, end: string): boolean {
    const time = timestamp.getHours() * 60 + timestamp.getMinutes();
    const startTime = this.parseTimeString(start);
    const endTime = this.parseTimeString(end);
    
    if (startTime <= endTime) {
      return time >= startTime && time <= endTime;
    } else {
      // Crosses midnight
      return time >= startTime || time <= endTime;
    }
  }

  private parseTimeString(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
