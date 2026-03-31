import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    const period = searchParams.get('period') || 'monthly'; // monthly | daily

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
      `SELECT bot_id, monthly_budget_usd, alert_threshold_pct, auto_pause FROM semo.bot_budgets`
    );
    const budgetMap: Record<string, { monthly_budget_usd: number; alert_threshold_pct: number; auto_pause: boolean }> = {};
    for (const b of budgets.rows) {
      budgetMap[b.bot_id as string] = {
        monthly_budget_usd: Number(b.monthly_budget_usd),
        alert_threshold_pct: Number(b.alert_threshold_pct),
        auto_pause: b.auto_pause as boolean,
      };
    }

    // 봇 이름/이모지 조인
    const botsResult = await query(
      `SELECT bot_id, name, emoji, status FROM semo.bot_status WHERE status != 'retired' ORDER BY bot_id`
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
