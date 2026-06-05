import { NextResponse } from 'next/server';
import { getAgentCommitmentQueue } from '@/lib/agents-db';

// Force dynamic rendering to prevent build-time DB connection
export const dynamic = 'force-dynamic';

/**
 * GET /api/bots/[botId]/queue
 * 에이전트의 진행 중 작업 큐(active/stale 커밋먼트, 오래된 것 먼저). spec Phase 5.
 */
export async function GET(req: Request, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;
    const queue = await getAgentCommitmentQueue(botId, { limit });
    return NextResponse.json({ queue });
  } catch (error) {
    console.error('Error fetching agent commitment queue:', error);
    return NextResponse.json({ error: 'Failed to fetch commitment queue' }, { status: 500 });
  }
}
