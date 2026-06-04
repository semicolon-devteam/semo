import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { listSessions, listCronJobs } from '@/lib/openclaw';
import { list as kbList, getItem as kbGetItem } from '@/lib/kb';
import type { BotDetail, Session, CronJob, BotFile, DailyLog } from '@/types';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

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
  payload: Record<string, unknown> | null;
}

interface WorkspaceFileRow {
  file_path: string;
  content: string;
  file_size: number;
}

/**
 * Read a bot workspace file from DB
 */
async function readFileFromDB(botId: string, filePath: string): Promise<string> {
  const result = await query<WorkspaceFileRow>(
    `SELECT content FROM ${DB_SCHEMA}.bot_workspace_files WHERE bot_id = $1 AND file_path = $2`,
    [botId, filePath],
  );
  if (result.rows.length === 0) return '';
  return result.rows[0].content;
}

/**
 * KB bot-config file type mapping
 */
const CONFIG_FILE_KB_MAP: Record<string, string> = {
  'SOUL.md': 'soul',
  'AGENTS.md': 'agents',
  'USER.md': 'user',
  'IDENTITY.md': 'identity',
  'RULES.md': 'rules',
  'TOOLS.md': 'tools',
  'HEARTBEAT.md': 'heartbeat',
};

/**
 * Read a bot config file: KB first, then bot_workspace_files fallback
 */
async function readConfigFile(botId: string, fileName: string): Promise<string> {
  const kbType = CONFIG_FILE_KB_MAP[fileName];
  if (kbType) {
    try {
      const entry = await kbGetItem('bot-config', `${botId}/${kbType}`);
      if (entry?.content) return entry.content;
    } catch {
      /* KB unavailable, fallback */
    }
  }
  return readFileFromDB(botId, fileName);
}

export async function GET(req: Request, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;

    // 1. Fetch sessions from DB (primary source)
    let sessions: Session[] = [];
    try {
      const sessionsResult = await query<SessionRow>(
        `
        SELECT session_key, label, kind, chat_type, last_activity, message_count
        FROM ${DB_SCHEMA}.bot_sessions
        WHERE bot_id = $1
        ORDER BY last_activity DESC
      `,
        [botId],
      );

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
      sessions = openclawSessions.map((s) => ({
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
      const cronResult = await query<CronJobRow>(
        `
        SELECT job_id, name, schedule, enabled, last_run, next_run, session_target, payload
        FROM ${DB_SCHEMA}.bot_cron_jobs
        WHERE bot_id = $1
        ORDER BY next_run NULLS LAST
      `,
        [botId],
      );

      cronJobs = cronResult.rows.map((row: CronJobRow) => ({
        jobId: row.job_id,
        name: row.name,
        schedule: row.schedule,
        enabled: row.enabled,
        lastRun: row.last_run || undefined,
        nextRun: row.next_run || undefined,
        sessionTarget: row.session_target,
        payload: row.payload || undefined,
      }));
    } catch (error) {
      console.warn('DB cron query failed, trying OpenClaw CLI:', error);
      const openclawCrons = await listCronJobs();
      cronJobs = openclawCrons.map((c) => ({
        jobId: c.id,
        name: c.name || c.id,
        schedule: c.schedule,
        enabled: c.enabled,
        lastRun: c.lastRun,
        nextRun: c.nextRun,
      }));
    }

    // 3. Fetch config files (KB first, bot_workspace_files fallback)
    const [soul, agents, user] = await Promise.all([
      readConfigFile(botId, 'SOUL.md'),
      readConfigFile(botId, 'AGENTS.md'),
      readConfigFile(botId, 'USER.md'),
    ]);

    // 4. Fetch workspace files list from DB
    let files: BotFile[] = [];
    try {
      const filesResult = await query<{ file_path: string; file_size: number }>(
        `SELECT DISTINCT split_part(file_path, '/', 1) AS file_path,
                MAX(file_size) AS file_size
         FROM ${DB_SCHEMA}.bot_workspace_files
         WHERE bot_id = $1
         GROUP BY split_part(file_path, '/', 1)
         ORDER BY file_path`,
        [botId],
      );

      // Determine if top-level entry is a directory (has sub-paths) or file
      const allPaths = await query<{ file_path: string }>(
        `SELECT file_path FROM ${DB_SCHEMA}.bot_workspace_files WHERE bot_id = $1`,
        [botId],
      );
      const pathSet = new Set(allPaths.rows.map((r) => r.file_path));

      files = filesResult.rows.map((row) => {
        const isDir = allPaths.rows.some(
          (r) => r.file_path.startsWith(row.file_path + '/') && r.file_path !== row.file_path,
        );
        return {
          path: row.file_path,
          type: (isDir ? 'directory' : 'file') as 'directory' | 'file',
        };
      });
    } catch {
      /* DB may not have workspace files yet */
    }

    // 5. Fetch KB entries (team SoT — replaces local memory files)
    let kbEntries: { domain: string; key: string; content: string }[] = [];
    try {
      const KB_DOMAINS = ['decision', 'team', 'process', 'bot-config', 'spec'];
      const allEntries = await Promise.all(KB_DOMAINS.map((d) => kbList(d)));
      kbEntries = allEntries.flat().map((e) => ({
        domain: e.domain,
        key: e.key,
        content: e.content,
      }));
    } catch {
      /* KB may not be available */
    }

    // 6. Fetch recent daily logs (last 3 days) from DB
    const today = new Date();
    const dailyLogs: DailyLog[] = [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      const content = await readFileFromDB(botId, `memory/${dateStr}.md`);
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
        kbEntries,
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
    return NextResponse.json({ error: 'Failed to fetch bot detail' }, { status: 500 });
  }
}
