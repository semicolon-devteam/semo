import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string; jobId: string }> }
) {
  try {
    const { botId, jobId } = await params;
    const body = await req.json();
    const { name, schedule, enabled, sessionTarget } = body;

    const result = await query(`
      UPDATE semo.bot_cron_jobs
      SET name = $1, schedule = $2, enabled = $3, session_target = $4
      WHERE bot_id = $5 AND job_id = $6
    `, [name, JSON.stringify(schedule), enabled, sessionTarget ?? 'main', botId, jobId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Cron job not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating cron job:', error);
    return NextResponse.json({ error: 'Failed to update cron job' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string; jobId: string }> }
) {
  try {
    const { botId, jobId } = await params;

    const result = await query(`
      DELETE FROM semo.bot_cron_jobs
      WHERE bot_id = $1 AND job_id = $2
    `, [botId, jobId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Cron job not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting cron job:', error);
    return NextResponse.json({ error: 'Failed to delete cron job' }, { status: 500 });
  }
}
