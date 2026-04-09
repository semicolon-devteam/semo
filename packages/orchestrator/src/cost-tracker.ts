import type { Pool } from 'pg';
import type { BotId } from './bot-config';

export interface CostRecordOpts {
  serviceId?: string;
  model?: string;
  commitmentId?: string;
  dispatchDepth?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  numTurns?: number;
  durationMs?: number;
}

export class CostTracker {
  private pool: Pool;
  private insertFailures = 0;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  record(botId: BotId, costUsd: number, opts?: CostRecordOpts) {
    if (costUsd <= 0) return;
    const o = opts ?? {};
    this.pool
      .query(
        `INSERT INTO semo.bot_cost_log
         (bot_id, cost_usd, service_id, model, commitment_id, dispatch_depth,
          input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
          num_turns, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          botId,
          costUsd,
          o.serviceId || null,
          o.model || null,
          o.commitmentId || null,
          o.dispatchDepth ?? 0,
          o.inputTokens ?? 0,
          o.outputTokens ?? 0,
          o.cacheReadTokens ?? 0,
          o.cacheCreationTokens ?? 0,
          o.numTurns ?? 1,
          o.durationMs ?? null,
        ],
      )
      .catch((err) => {
        this.insertFailures++;
        console.error(`[cost-tracker] INSERT failed (#${this.insertFailures}):`, err.message);
      });
  }

  async getDailySummary(): Promise<
    Record<string, { cost: number; inputTokens: number; outputTokens: number }>
  > {
    const { rows } = await this.pool.query<{
      bot_id: string;
      total: string;
      in_tok: string;
      out_tok: string;
    }>(
      `SELECT bot_id, SUM(cost_usd) AS total,
              SUM(input_tokens) AS in_tok, SUM(output_tokens) AS out_tok
       FROM semo.bot_cost_log
       WHERE created_at >= CURRENT_DATE
       GROUP BY bot_id
       ORDER BY total DESC`,
    );
    const summary: Record<string, { cost: number; inputTokens: number; outputTokens: number }> = {};
    for (const r of rows) {
      summary[r.bot_id] = {
        cost: parseFloat(r.total),
        inputTokens: parseInt(r.in_tok) || 0,
        outputTokens: parseInt(r.out_tok) || 0,
      };
    }
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
    const totalCost = Object.values(summary).reduce((a, b) => a + b.cost, 0);
    const totalIn = Object.values(summary).reduce((a, b) => a + b.inputTokens, 0);
    const totalOut = Object.values(summary).reduce((a, b) => a + b.outputTokens, 0);
    const lines = Object.entries(summary)
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(
        ([bot, s]) =>
          `  ${bot}: $${s.cost.toFixed(4)} (${(s.inputTokens / 1000).toFixed(1)}k in / ${(s.outputTokens / 1000).toFixed(1)}k out)`,
      );
    return `📊 일일 비용 ($${totalCost.toFixed(4)} | ${(totalIn / 1000).toFixed(1)}k in / ${(totalOut / 1000).toFixed(1)}k out)\n${lines.join('\n')}`;
  }
}
