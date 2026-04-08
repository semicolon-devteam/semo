import type { BotId } from './bot-config';

interface CostEntry {
  botId: string;
  costUsd: number;
  timestamp: number;
  serviceId?: string;
}

export class CostTracker {
  private entries: CostEntry[] = [];

  record(botId: BotId, costUsd: number, serviceId?: string) {
    this.entries.push({ botId, costUsd, timestamp: Date.now(), serviceId });
  }

  // 봇별 일일 비용 집계
  getDailySummary(): Record<string, number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    const summary: Record<string, number> = {};
    for (const e of this.entries) {
      if (e.timestamp >= todayTs) {
        summary[e.botId] = (summary[e.botId] || 0) + e.costUsd;
      }
    }
    return summary;
  }

  getTotalToday(): number {
    return Object.values(this.getDailySummary()).reduce((a, b) => a + b, 0);
  }

  formatReport(): string {
    const summary = this.getDailySummary();
    const total = this.getTotalToday();
    const lines = Object.entries(summary)
      .sort((a, b) => b[1] - a[1])
      .map(([bot, cost]) => `  ${bot}: $${cost.toFixed(4)}`);
    return `📊 일일 비용 ($${total.toFixed(4)} total)\n${lines.join('\n')}`;
  }
}
