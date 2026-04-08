import { NextRequest, NextResponse } from 'next/server';
import { createResearchTask, listResearchTasks, updateResearchTask } from '@/lib/gfp';
import { dispatchResearch } from '@/lib/gfp-bot';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tasks = await listResearchTasks(id);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('GFP research list error:', error);
    return NextResponse.json({ error: 'Failed to list research tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { task_type, reference_urls, input_prompt } = body;

    if (!task_type || !input_prompt) {
      return NextResponse.json(
        { error: 'task_type and input_prompt are required' },
        { status: 400 },
      );
    }

    const task = await createResearchTask({
      service_id: id,
      task_type,
      reference_urls: reference_urls ?? [],
      input_prompt,
    });

    // Dispatch to GrowthClaw
    dispatchResearch(task.task_id, 'growthclaw', input_prompt).catch((err) =>
      console.error('GrowthClaw dispatch failed:', err),
    );

    await updateResearchTask(task.task_id, { status: 'dispatched' });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('GFP research create error:', error);
    return NextResponse.json({ error: 'Failed to create research task' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_id, status, result } = body;

    if (!task_id) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
    }

    const task = await updateResearchTask(task_id, { status, result });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    console.error('GFP research update error:', error);
    return NextResponse.json({ error: 'Failed to update research task' }, { status: 500 });
  }
}
