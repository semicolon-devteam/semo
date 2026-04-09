import type { Pool } from 'pg';
import type { BotId } from './bot-config';

export class CostTracker {
  private pool: Pool;
  private insertFailures = 0;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  record(
    botId: BotId,
    costUsd: number,
    serviceId?: string,
    model?: string,
    commitmentId?: string,
    dispatchDepth?: number,
  ) {
    if (costUsd <= 0) return; // 0 또는 음수는 무시 (리펀드 케이스 없음)
    this.pool
      .query(
        `INSERT INTO semo.bot_cost_log (bot_id, cost_usd, service_id, model, commitment_id, dispatch_depth) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          botId,
          costUsd,
          serviceId || null,
          model || null,
          commitmentId || null,
          dispatchDepth ?? 0,
        ],
      )
      .catch((err) => {
        this.insertFailures++;
        console.error(`[cost-tracker] INSERT failed (#${this.insertFailures}):`, err.message);
      });
  }

  async getDailySummary(): Promise<Record<string, number>> {
    const { rows } = await this.pool.query<{ bot_id: string; total: string }>(
      `SELECT bot_id, SUM(cost_usd) AS total
       FROM semo.bot_cost_log
       WHERE created_at >= CURRENT_DATE
       GROUP BY bot_id
       ORDER BY total DESC`,
    );
    const summary: Record<string, number> = {};
    for (const r of rows) summary[r.bot_id] = parseFloat(r.total);
    return summary;
  }

  async getTotalToday(): Promise<number> {
    const { rows } = await this.pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total
       FROM semo.bot_cost_log
       WHERE created_at >= CURRENT_DATE`,
    );
    return parseFloat(rows[0].total);
  }

  async formatReport(): Promise<string> {
    const summary = await this.getDailySummary();
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    const lines = Object.entries(summary)
      .sort((a, b) => b[1] - a[1])
      .map(([bot, cost]) => `  ${bot}: $${cost.toFixed(4)}`);
    return `📊 일일 비용 ($${total.toFixed(4)} total)\n${lines.join('\n')}`;
  }
}
