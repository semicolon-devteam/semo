/**
 * POST /api/incubator/heartbeat
 *
 * channel-slack이 60초 간격으로 호출하여 incubator_sessions.last_heartbeat 갱신.
 * 인증 불필요 (publicPaths에 등록) -- channel-slack은 세션 쿠키 없음.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

const HEARTBEAT_SECRET = process.env.SEMO_HEARTBEAT_SECRET || '';

if (!HEARTBEAT_SECRET) {
  console.warn(
    '[heartbeat] SEMO_HEARTBEAT_SECRET is not set — heartbeat endpoint is unauthenticated. Set the env var to enable auth.',
  );
}

export async function POST(request: NextRequest) {
  try {
    // shared secret 검증 (스푸핑 방지) — 미설정 시 경고 로그 후 허용 (개발 호환)
    const token = request.headers.get('x-heartbeat-token');
    if (HEARTBEAT_SECRET && token !== HEARTBEAT_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
      `UPDATE ${DB_SCHEMA}.incubator_sessions
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
