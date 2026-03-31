import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;

  try {
    // 일별 쿼리 수 (최근 90일) — Activity Heatmap용
    const heatmap = await query(
      `SELECT created_at::date AS day, COUNT(*) AS count
       FROM semo.bot_query_logs
       WHERE bot_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '90 days'
       GROUP BY created_at::date
       ORDER BY day`,
      [botId]
    );

    // 시간대별 분포 (최근 30일) — 24시간 히스토그램
    const hourly = await query(
      `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*) AS count
       FROM semo.bot_query_logs
       WHERE bot_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [botId]
    );

    // 최근 세션 활동 타임라인
    const sessions = await query(
      `SELECT session_key, label, kind, chat_type, last_activity, message_count
       FROM semo.bot_sessions
       WHERE bot_id = $1
       ORDER BY last_activity DESC NULLS LAST
       LIMIT 20`,
      [botId]
    );

    // 위임 관계 (보낸/받은)
    const delegationsOut = await query(
      `SELECT to_bot_id, delegation_type, domains, method
       FROM semo.bot_delegation
       WHERE from_bot_id = $1 AND is_active = true`,
      [botId]
    );
    const delegationsIn = await query(
      `SELECT from_bot_id, delegation_type, domains, method
       FROM semo.bot_delegation
       WHERE to_bot_id = $1 AND is_active = true`,
      [botId]
    );

    return NextResponse.json({
      heatmap: heatmap.rows,
      hourly: hourly.rows,
      sessions: sessions.rows,
      delegations: {
        outgoing: delegationsOut.rows,
        incoming: delegationsIn.rows,
      },
    });
  } catch (error) {
    console.error('Bot activity API error:', error);
    return NextResponse.json(
      { heatmap: [], hourly: [], sessions: [], delegations: { outgoing: [], incoming: [] } },
      { status: 500 }
    );
  }
}
