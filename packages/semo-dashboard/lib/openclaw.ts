/**
 * OpenClaw Gateway API Wrapper
 * 
 * Provides methods to access OpenClaw sessions and cron jobs.
 * Uses CLI wrapping as recommended by the API spec.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface OpenClawSession {
  key: string;
  label?: string;
  kind?: 'main' | 'isolated';
  channel?: string;
  lastMessageAt?: string;
  messageCount?: number;
}

export interface OpenClawCronJob {
  id: string;
  name?: string;
  schedule: {
    kind: 'cron' | 'every' | 'at';
    [key: string]: unknown;
  };
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  sessionTarget?: string;
}

/**
 * List OpenClaw sessions
 * @param limit Maximum number of sessions to return
 * @returns Array of sessions
 */
export async function listSessions(limit = 10): Promise<OpenClawSession[]> {
  try {
    const { stdout } = await execAsync(`openclaw sessions list --json --limit ${limit}`);
    const result = JSON.parse(stdout);
    
    // Handle different response formats
    if (Array.isArray(result)) {
      return result;
    }
    if (result.sessions && Array.isArray(result.sessions)) {
      return result.sessions;
    }
    
    return [];
  } catch (error) {
    console.error('Error listing OpenClaw sessions:', error);
    return []; // Graceful fallback
  }
}

/**
 * List OpenClaw cron jobs
 * @returns Array of cron jobs
 */
export async function listCronJobs(): Promise<OpenClawCronJob[]> {
  try {
    const { stdout } = await execAsync('openclaw cron list --json');
    const result = JSON.parse(stdout);
    
    // Handle different response formats
    if (Array.isArray(result)) {
      return result;
    }
    if (result.jobs && Array.isArray(result.jobs)) {
      return result.jobs;
    }
    
    return [];
  } catch (error) {
    console.error('Error listing OpenClaw cron jobs:', error);
    return []; // Graceful fallback
  }
}
