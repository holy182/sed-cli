import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as os from 'os';

// Analytics configuration - Opt-in by default (production safe)
// To enable analytics, set SED_ANALYTICS=true or SED_ANALYTICS=1
const ANALYTICS_ENABLED = process.env.SED_ANALYTICS === '1' || process.env.SED_ANALYTICS === 'true';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Generate a unique machine ID (anonymous)
function generateMachineId(): string {
  // Avoid using hostname to reduce identifiability
  const machineInfo = `${os.platform()}-${os.arch()}`;
  return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
}

// Generate a session ID for tracking user sessions
function generateSessionId(): string {
  return crypto.randomBytes(8).toString('hex');
}

// Get additional user context
function getUserContext(): any {
  return {
    platform: os.platform(),
    architecture: os.arch(),
    // omit hostname for privacy
    node_version: process.version,
    session_id: generateSessionId()
  };
}

// Analytics client
let analyticsClient: any = null;

function getAnalyticsClient() {
  if (!analyticsClient && ANALYTICS_ENABLED && SUPABASE_URL && SUPABASE_KEY) {
    try {
      analyticsClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (error) {
      console.warn('Analytics client initialization failed');
      analyticsClient = null;
    }
  }
  return analyticsClient;
}

// Track command usage
export async function trackCommand(command: string, data: any = {}): Promise<void> {
  if (!ANALYTICS_ENABLED) return;
  
  try {
    const client = getAnalyticsClient();
    if (!client) return;

    const userId = generateMachineId();
    const timestamp = new Date().toISOString();
    const userContext = getUserContext();

    // Enhanced data with user context
    const enhancedData = {
      ...data,
      user_context: userContext,
      timestamp: timestamp
    };

    await client.from('sed_analytics').insert({
      user_id: userId,
      command: command,
      data: enhancedData,
      created_at: timestamp,
      version: process.env.npm_package_version || '1.0.30'
    });
  } catch (error) {
    // Silent fail - don't interrupt user experience
    console.debug('Analytics tracking failed:', error);
  }
}

// Track specific events
export async function trackBuild(dbType: string, tableCount: number): Promise<void> {
  await trackCommand('build', {
    database_type: dbType,
    tables_discovered: tableCount
  });
}

export async function trackSearch(query: string, resultCount: number): Promise<void> {
  await trackCommand('search', {
    query_length: query.length,
    results_found: resultCount
  });
}

export async function trackInit(dbType: string): Promise<void> {
  await trackCommand('init', {
    database_type: dbType
  });
}

export async function trackValidate(success: boolean): Promise<void> {
  await trackCommand('validate', {
    success: success
  });
}

export async function trackExport(format: string): Promise<void> {
  await trackCommand('export', {
    format: format
  });
}

// Get analytics summary (for funding purposes)
export async function getAnalyticsSummary(): Promise<any> {
  try {
    const client = getAnalyticsClient();
    if (!client) return null;

    // Get total unique users
    const { data: users } = await client
      .from('sed_analytics')
      .select('user_id')
      .not('user_id', 'is', null);

    const uniqueUsers = new Set(users?.map((u: any) => u.user_id) || []).size;

    // Get command usage
    const { data: commands } = await client
      .from('sed_analytics')
      .select('command, created_at');

    const commandCounts: { [key: string]: number } = {};
    commands?.forEach((cmd: any) => {
      commandCounts[cmd.command] = (commandCounts[cmd.command] || 0) + 1;
    });

    // Get database types
    const { data: dbTypes } = await client
      .from('sed_analytics')
      .select('data')
      .eq('command', 'build');

    const dbTypeCounts: { [key: string]: number } = {};
    dbTypes?.forEach((item: any) => {
      const dbType = item.data?.database_type;
      if (dbType) {
        dbTypeCounts[dbType] = (dbTypeCounts[dbType] || 0) + 1;
      }
    });

    return {
      total_users: uniqueUsers,
      command_usage: commandCounts,
      database_types: dbTypeCounts,
      last_updated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to get analytics summary:', error);
    return null;
  }
}

// Analytics is always enabled for funding purposes
export function isAnalyticsEnabled(): boolean {
  return ANALYTICS_ENABLED;
}