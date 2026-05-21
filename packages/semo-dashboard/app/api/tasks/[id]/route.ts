import { NextResponse } from 'next/server';
import { getTaskTimeline } from '@/lib/tasks-db';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = await getTaskTimeline(id);
    if (!task) return NextResponse.json({ error: 'task_not_found' }, { status: 404 });
    return NextResponse.json({ task, generated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Task detail GET error:', error);
    return NextResponse.json({ error: 'task_detail_failed' }, { status: 500 });
  }
}
