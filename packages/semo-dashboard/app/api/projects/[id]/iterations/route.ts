import { NextRequest, NextResponse } from 'next/server';
import {
  listIterations,
  createIteration,
  updateIteration,
  activateIteration,
  completeIteration,
  deleteIteration,
} from '@/lib/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;

    const iterations = await listIterations(id, status);
    return NextResponse.json(iterations);
  } catch (error) {
    console.error('Iterations list error:', error);
    return NextResponse.json({ error: 'Failed to fetch iterations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, goal, status, started_at } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const iteration = await createIteration({
      service_id: id,
      title,
      goal,
      status,
      started_at,
    });
    return NextResponse.json(iteration, { status: 201 });
  } catch (error) {
    console.error('Iteration create error:', error);
    return NextResponse.json({ error: 'Failed to create iteration' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { iteration_id, action, ...data } = body;

    if (!iteration_id) {
      return NextResponse.json({ error: 'iteration_id is required' }, { status: 400 });
    }

    let iteration;
    if (action === 'activate') {
      iteration = await activateIteration(id, iteration_id);
    } else if (action === 'complete') {
      iteration = await completeIteration(id, iteration_id, data.retrospective);
    } else {
      iteration = await updateIteration(id, iteration_id, data);
    }

    if (!iteration) {
      return NextResponse.json({ error: 'Iteration not found' }, { status: 404 });
    }
    return NextResponse.json(iteration);
  } catch (error) {
    console.error('Iteration update error:', error);
    return NextResponse.json({ error: 'Failed to update iteration' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const iterationId = searchParams.get('iteration_id');

    if (!iterationId) {
      return NextResponse.json({ error: 'iteration_id is required' }, { status: 400 });
    }

    const deleted = await deleteIteration(id, iterationId);
    if (!deleted) {
      return NextResponse.json({ error: 'Iteration not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Iteration delete error:', error);
    return NextResponse.json({ error: 'Failed to delete iteration' }, { status: 500 });
  }
}
