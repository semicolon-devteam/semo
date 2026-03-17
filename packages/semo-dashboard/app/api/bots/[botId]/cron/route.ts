import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface CronJobRow {
  job_id: string;
  name: string;
  schedule: { kind: 'cron' | 'every' | 'at'; [key: string]: unknown };
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  session_target: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const result = await query<CronJobRow>(`
      SELECT job_id, name, schedule, enabled, last_run, next_run, session_target
      FROM semo.bot_cron_jobs
      WHERE bot_id = $1
      ORDER BY next_run NULLS LAST
    `, [botId]);

    const cronJobs = result.rows.map((row) => ({
      jobId: row.job_id,
      name: row.name,
      schedule: row.schedule,
      enabled: row.enabled,
      lastRun: row.last_run || undefined,
      nextRun: row.next_run || undefined,
      sessionTarget: row.session_target,
    }));

    return NextResponse.json(cronJobs);
  } catch (error) {
    console.error('Error fetching cron jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch cron jobs' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const body = await req.json();
    const { jobId, name, schedule, enabled, sessionTarget } = body;

    if (!jobId || !name || !schedule) {
      return NextResponse.json({ error: 'jobId, name, schedule are required' }, { status: 400 });
    }

    await query(`
      INSERT INTO semo.bot_cron_jobs (bot_id, job_id, name, schedule, enabled, session_target)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [botId, jobId, name, JSON.stringify(schedule), enabled ?? true, sessionTarget ?? 'main']);

    return NextResponse.json({ ok: true, jobId }, { status: 201 });
  } catch (error) {
    console.error('Error creating cron job:', error);
    return NextResponse.json({ error: 'Failed to create cron job' }, { status: 500 });
  }
}
