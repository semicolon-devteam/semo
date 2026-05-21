import { NextRequest, NextResponse } from 'next/server';
import { listTasks } from '@/lib/tasks-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const limit = Number(searchParams.get('limit') ?? 50);
    const tasks = await listTasks({ status, limit });
    return NextResponse.json({ tasks, generated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Tasks GET error:', error);
    return NextResponse.json({ error: 'task_list_failed', tasks: [] }, { status: 500 });
  }
}
