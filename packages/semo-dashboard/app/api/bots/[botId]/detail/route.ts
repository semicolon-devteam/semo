import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { listSessions, listCronJobs } from '@/lib/openclaw';
import type { BotDetail, Session, CronJob, BotFile, DailyLog } from '@/types';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

const WORKSPACES_DIR = path.resolve(process.cwd(), '../../semo-system/bot-workspaces');

async function readLocalFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

// Force dynamic rendering to prevent build-time DB connection
export const dynamic = 'force-dynamic';

interface SessionRow {
  session_key: string;
  label: string;
  kind: 'main' | 'isolated';
  chat_type: string;
  last_activity: string;
  message_count: number;
}

interface CronJobRow {
  job_id: string;
  name: string;
  schedule: CronJob['schedule']; // JSONB
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  session_target: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;

    // 1. Fetch sessions from DB (primary source)
    let sessions: Session[] = [];
    try {
      const sessionsResult = await query<SessionRow>(`
        SELECT session_key, label, kind, chat_type, last_activity, message_count
        FROM semo.bot_sessions
        WHERE bot_id = $1
        ORDER BY last_activity DESC
      `, [botId]);

      sessions = sessionsResult.rows.map((row: SessionRow) => ({
        sessionKey: row.session_key,
        label: row.label,
        kind: row.kind,
        chatType: row.chat_type,
        lastActivity: row.last_activity,
        messageCount: row.message_count,
      }));
    } catch (error) {
      console.warn('DB sessions query failed, trying OpenClaw CLI:', error);
      const openclawSessions = await listSessions(20);
      sessions = openclawSessions.map(s => ({
        sessionKey: s.key,
        label: s.label || s.key,
        kind: s.kind || 'main',
        chatType: s.channel || 'unknown',
        lastActivity: s.lastMessageAt || new Date().toISOString(),
        messageCount: s.messageCount || 0,
      }));
    }

    // 2. Fetch cron jobs from DB (primary source)
    let cronJobs: CronJob[] = [];
    try {
      const cronResult = await query<CronJobRow>(`
        SELECT job_id, name, schedule, enabled, last_run, next_run, session_target
        FROM semo.bot_cron_jobs
        WHERE bot_id = $1
        ORDER BY next_run NULLS LAST
      `, [botId]);

      cronJobs = cronResult.rows.map((row: CronJobRow) => ({
        jobId: row.job_id,
        name: row.name,
        schedule: row.schedule,
        enabled: row.enabled,
        lastRun: row.last_run || undefined,
        nextRun: row.next_run || undefined,
        sessionTarget: row.session_target,
      }));
    } catch (error) {
      console.warn('DB cron query failed, trying OpenClaw CLI:', error);
      const openclawCrons = await listCronJobs();
      cronJobs = openclawCrons.map(c => ({
        jobId: c.id,
        name: c.name || c.id,
        schedule: c.schedule,
        enabled: c.enabled,
        lastRun: c.lastRun,
        nextRun: c.nextRun,
      }));
    }

    // 3. Fetch config files from local filesystem
    const botDir = path.join(WORKSPACES_DIR, botId);
    const [soul, agents, user] = await Promise.all([
      readLocalFile(path.join(botDir, 'SOUL.md')).catch(() => ''),
      readLocalFile(path.join(botDir, 'AGENTS.md')).catch(() => ''),
      readLocalFile(path.join(botDir, 'USER.md')).catch(() => ''),
    ]);

    // 4. Fetch workspace files (top-level)
    let files: BotFile[] = [];
    try {
      const entries = await readdir(botDir, { withFileTypes: true });
      files = entries.map(e => ({
        path: e.name,
        type: e.isDirectory() ? 'directory' : 'file' as const,
      }));
    } catch { /* directory may not exist */ }

    // 5. Fetch memory files
    const memDir = path.join(botDir, 'memory');
    const [decisions, team] = await Promise.all([
      readLocalFile(path.join(memDir, 'decisions.md')).catch(() => ''),
      readLocalFile(path.join(memDir, 'team.md')).catch(() => ''),
    ]);

    // 6. Fetch recent daily logs (last 3 days)
    const today = new Date();
    const dailyLogs: DailyLog[] = [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      const content = await readLocalFile(
        path.join(memDir, `${dateStr}.md`)
      ).catch(() => null);

      if (content) {
        dailyLogs.push({ date: dateStr, content });
      }
    }

    const detail: BotDetail = {
      config: {
        soul,
        agents,
        user,
      },
      files,
      memory: {
        decisions,
        team,
        dailyLogs,
      },
      activity: {
        sessions,
        cronJobs,
      },
    };

    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error fetching bot detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot detail' },
      { status: 500 }
    );
  }
}
