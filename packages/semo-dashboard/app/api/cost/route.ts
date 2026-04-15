import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    const period = searchParams.get('period') || 'monthly'; // monthly | daily
    const groupBy = searchParams.get('groupBy'); // 'project' for project-level view

    // 프로젝트별 집계
    if (groupBy === 'project') {
      const result = await query(`
        SELECT kb.metadata->>'service_id' AS service_id,
               kb.metadata->>'project_name' AS project_name,
               kb.domain AS service_domain,
               COUNT(*) AS query_count,
               COALESCE(SUM(c.input_tokens), 0) AS total_input_tokens,
               COALESCE(SUM(c.output_tokens), 0) AS total_output_tokens,
               ROUND(COALESCE(SUM(c.cost_usd), 0)::numeric, 6) AS total_cost_usd,
               COALESCE(AVG(c.duration_ms), 0)::int AS avg_latency_ms,
               STRING_AGG(DISTINCT c.bot_id, ', ') AS bots_used,
               MIN(c.created_at)::date AS first_activity,
               MAX(c.created_at)::date AS last_activity
        FROM semo.bot_cost_log c
        JOIN semo.knowledge_base kb ON kb.key = 'pipeline' AND kb.sub_key = 'config'
          AND (kb.metadata->>'service_id' = c.service_id
               OR LEFT(kb.metadata->>'service_id', 8) = c.service_id)
        WHERE c.service_id IS NOT NULL
        GROUP BY kb.metadata->>'service_id', kb.metadata->>'project_name', kb.domain
        ORDER BY total_cost_usd DESC
      `);
      return NextResponse.json({ projects: result.rows });
    }

    if (period === 'daily') {
      // 일별 트렌드 (최근 30일)
      const sql = botId
        ? `SELECT * FROM semo.bot_cost_daily WHERE bot_id = $1 AND day >= CURRENT_DATE - INTERVAL '30 days' ORDER BY day`
        : `SELECT * FROM semo.bot_cost_daily WHERE day >= CURRENT_DATE - INTERVAL '30 days' ORDER BY day, bot_id`;
      const params = botId ? [botId] : [];
      const result = await query(sql, params);
      return NextResponse.json(result.rows);
    }

    // 월별 집계
    const sql = botId
      ? `SELECT * FROM semo.bot_cost_summary WHERE bot_id = $1 ORDER BY month DESC LIMIT 12`
      : `SELECT * FROM semo.bot_cost_summary ORDER BY month DESC, bot_id LIMIT 100`;
    const params = botId ? [botId] : [];
    const result = await query(sql, params);

    // 예산 정보 조인
    const budgets = await query(
      `SELECT bot_id, monthly_budget_usd, alert_threshold_pct, auto_pause FROM semo.bot_budgets`,
    );
    const budgetMap: Record<
      string,
      { monthly_budget_usd: number; alert_threshold_pct: number; auto_pause: boolean }
    > = {};
    for (const b of budgets.rows) {
      budgetMap[b.bot_id as string] = {
        monthly_budget_usd: Number(b.monthly_budget_usd),
        alert_threshold_pct: Number(b.alert_threshold_pct),
        auto_pause: b.auto_pause as boolean,
      };
    }

    // 봇 이름/이모지 조인
    const botsResult = await query(
      `SELECT bot_id, name, emoji, status FROM semo.bot_status WHERE status != 'retired' ORDER BY bot_id`,
    );
    const botMap: Record<string, { name: string; emoji: string; status: string }> = {};
    for (const b of botsResult.rows) {
      botMap[b.bot_id as string] = {
        name: (b.name as string) || (b.bot_id as string),
        emoji: (b.emoji as string) || '🤖',
        status: (b.status as string) || 'offline',
      };
    }

    return NextResponse.json({
      costs: result.rows,
      budgets: budgetMap,
      bots: botMap,
    });
  } catch (error) {
    console.error('Cost API error:', error);
    return NextResponse.json({ costs: [], budgets: {}, bots: {} }, { status: 500 });
  }
}
