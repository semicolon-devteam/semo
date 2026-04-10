/**
 * POST /api/incubator/heartbeat
 *
 * channel-slack이 60초 간격으로 호출하여 incubator_sessions.last_heartbeat 갱신.
 * 인증 불필요 (publicPaths에 등록) -- channel-slack은 세션 쿠키 없음.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const HEARTBEAT_SECRET = process.env.SEMO_HEARTBEAT_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // shared secret 검증 (스푸핑 방지)
    if (HEARTBEAT_SECRET) {
      const token = request.headers.get('x-heartbeat-token');
      if (token !== HEARTBEAT_SECRET) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { service_id } = body as { service_id?: string };

    if (!service_id || typeof service_id !== 'string' || service_id.trim() === '') {
      return NextResponse.json(
        { error: 'service_id is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    const result = await query(
      `UPDATE semo.incubator_sessions
       SET last_heartbeat = NOW(), updated_at = NOW()
       WHERE service_id = $1 AND status = 'active'`,
      [service_id.trim()],
    );

    return NextResponse.json({
      ok: true,
      updated: result.rowCount ?? 0,
    });
  } catch (error) {
    console.error('[heartbeat] error:', error);
    return NextResponse.json({ error: 'heartbeat update failed' }, { status: 500 });
  }
}
