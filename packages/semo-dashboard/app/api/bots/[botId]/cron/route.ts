import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

interface CronJobRow {
  job_id: string;
  name: string;
  schedule: { kind: 'cron' | 'every' | 'at'; [key: string]: unknown };
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  session_target: string;
  payload: Record<string, unknown> | null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const result = await query<CronJobRow>(
      `
      SELECT job_id, name, schedule, enabled, last_run, next_run, session_target, payload
      FROM ${DB_SCHEMA}.bot_cron_jobs
      WHERE bot_id = $1
      ORDER BY next_run NULLS LAST
    `,
      [botId],
    );

    const cronJobs = result.rows.map((row) => ({
      jobId: row.job_id,
      name: row.name,
      schedule: row.schedule,
      enabled: row.enabled,
      lastRun: row.last_run || undefined,
      nextRun: row.next_run || undefined,
      sessionTarget: row.session_target,
      payload: row.payload || undefined,
    }));

    return NextResponse.json(cronJobs);
  } catch (error) {
    console.error('Error fetching cron jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch cron jobs' }, { status: 500 });
  }
}
