import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getFileContent, getBotFiles } from '@/lib/github';
import type { BotDetail, Session, CronJob, BotFile, DailyLog } from '@/types';

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
  schedule: any; // JSONB
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

    // 1. Fetch sessions from DB
    const sessionsResult = await query<SessionRow>(`
      SELECT session_key, label, kind, chat_type, last_activity, message_count
      FROM semo.bot_sessions
      WHERE bot_id = $1
      ORDER BY last_activity DESC
    `, [botId]);

    const sessions: Session[] = sessionsResult.rows.map(row => ({
      sessionKey: row.session_key,
      label: row.label,
      kind: row.kind,
      chatType: row.chat_type,
      lastActivity: row.last_activity,
      messageCount: row.message_count,
    }));

    // 2. Fetch cron jobs from DB
    const cronResult = await query<CronJobRow>(`
      SELECT job_id, name, schedule, enabled, last_run, next_run, session_target
      FROM semo.bot_cron_jobs
      WHERE bot_id = $1
      ORDER BY next_run NULLS LAST
    `, [botId]);

    const cronJobs: CronJob[] = cronResult.rows.map(row => ({
      jobId: row.job_id,
      name: row.name,
      schedule: row.schedule,
      enabled: row.enabled,
      lastRun: row.last_run || undefined,
      nextRun: row.next_run || undefined,
    }));

    // 3. Fetch config files from GitHub
    const [soul, agents, user] = await Promise.all([
      getFileContent(`semo-system/bot-workspaces/${botId}/SOUL.md`).catch(() => ''),
      getFileContent(`semo-system/bot-workspaces/${botId}/AGENTS.md`).catch(() => ''),
      getFileContent(`semo-system/bot-workspaces/${botId}/USER.md`).catch(() => ''),
    ]);

    // 4. Fetch workspace files (top-level)
    const files: BotFile[] = await getBotFiles(botId)
      .then(gitHubFiles => gitHubFiles.map(f => ({
        path: f.name,
        type: f.type === 'dir' ? 'directory' : 'file' as const,
      })))
      .catch(() => []);

    // 5. Fetch memory files
    const [decisions, team] = await Promise.all([
      getFileContent(`semo-system/bot-workspaces/${botId}/memory/decisions.md`).catch(() => ''),
      getFileContent(`semo-system/bot-workspaces/${botId}/memory/team.md`).catch(() => ''),
    ]);

    // 6. Fetch recent daily logs (last 3 days)
    const today = new Date();
    const dailyLogs: DailyLog[] = [];
    
    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const content = await getFileContent(
        `semo-system/bot-workspaces/${botId}/memory/${dateStr}.md`
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
