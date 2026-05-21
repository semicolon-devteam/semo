import { NextResponse } from 'next/server';
import { listAgents } from '@/lib/agents-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const agents = await listAgents();
    return NextResponse.json({ agents, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[/api/agents] list failed:', err);
    return NextResponse.json(
      { error: 'agent_list_failed', message: (err as Error).message },
      { status: 500 },
    );
  }
}
