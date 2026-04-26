/**
 * semo metrics — 봇별 토큰 사용량 추적
 *
 * 커맨드:
 *   semo metrics log-turn  — Stop 훅에서 호출, transcript 마지막 턴 usage를 bot_cost_log에 기록
 *   semo metrics summary   — bot_cost_daily/summary 뷰 기반 집계 조회
 *
 * Stop 훅 stdin JSON: { session_id, transcript_path, cwd, ... }
 * DB 연결 실패 시 exit 0 — 훅이 세션을 블로킹하지 않는다.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import { getPool, closeConnection, isDbConnected } from '../database';

// ─── Pricing (per 1M tokens, API-equivalent) ────────────────────────────────

interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICING: [string, ModelPricing][] = [
  ['claude-opus-4', { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 }],
  ['claude-sonnet-4', { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }],
  ['claude-3-5-sonnet', { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }],
  ['claude-3-7-sonnet', { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }],
  ['claude-haiku-4', { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1.0 }],
  ['claude-3-5-haiku', { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1.0 }],
];

function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheRead: number,
  cacheCreation: number,
): number {
  const entry = PRICING.find(([prefix]) => model.startsWith(prefix));
  if (!entry) {
    process.stderr.write(`[metrics] unknown model pricing: ${model}\n`);
    return 0;
  }
  const p = entry[1];
  return (
    (inputTokens * p.input +
      outputTokens * p.output +
      cacheRead * p.cacheRead +
      cacheCreation * p.cacheWrite) /
    1_000_000
  );
}

// ─── Bot ID detection ───────────────────────────────────────────────────────

const BOT_CWD_PATTERNS = [
  /semo-(?:bot-)?sessions\/([a-zA-Z0-9_-]+)/,
  /\.semo\/sessions\/([a-zA-Z0-9_-]+)/,
  /openclaw-([a-z]+)\/workspace/,
];

function detectBotId(cwd: string): string {
  for (const re of BOT_CWD_PATTERNS) {
    const m = cwd.match(re);
    if (m) return m[1];
  }
  try {
    return `${os.userInfo().username}-local`;
  } catch {
    return 'cli-local';
  }
}

// ─── stdin helper ───────────────────────────────────────────────────────────

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data.trim()));
    setTimeout(() => resolve(data.trim()), 500);
  });
}

interface HookPayload {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
}

async function parseHookPayload(): Promise<HookPayload> {
  try {
    const raw = await readStdin();
    if (!raw) return {};
    return JSON.parse(raw) as HookPayload;
  } catch {
    return {};
  }
}

async function ensureDbOrExit(): Promise<void> {
  const connected = await isDbConnected();
  if (!connected) process.exit(0);
}

// ─── Transcript parsing ─────────────────────────────────────────────────────

interface TurnUsage {
  messageId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheCreation: number;
}

function extractLastTurnUsage(transcriptPath: string): TurnUsage[] {
  const stat = fs.statSync(transcriptPath);
  if (stat.size === 0) return [];

  const CHUNK = 256 * 1024;
  const start = Math.max(0, stat.size - CHUNK);
  const buf = Buffer.alloc(Math.min(stat.size, CHUNK));
  const fd = fs.openSync(transcriptPath, 'r');
  fs.readSync(fd, buf, 0, buf.length, start);
  fs.closeSync(fd);

  const lines = buf
    .toString('utf-8')
    .split('\n')
    .filter((l) => l.trim());

  const seen = new Set<string>();
  const results: TurnUsage[] = [];

  // 역순 스캔: 마지막 user 엔트리까지의 모든 assistant 엔트리를 수집한다.
  // 한 턴에 tool 사용이 여러 번이면 assistant 엔트리가 복수개(각각 다른 message.id)이므로
  // user 경계까지 모두 수집해야 턴 전체 비용을 기록할 수 있다.
  // message.id dedup으로 extended-thinking 중복(같은 msg_id)을 방지한다.
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      continue; // partial line at chunk boundary
    }

    if (obj.type === 'assistant') {
      const msg = obj.message as Record<string, unknown> | undefined;
      if (!msg) continue;
      const msgId = msg.id as string | undefined;
      if (!msgId || seen.has(msgId)) continue;
      seen.add(msgId);

      const usage = msg.usage as Record<string, number> | undefined;
      if (!usage) continue;

      results.push({
        messageId: msgId,
        model: (msg.model as string) || 'unknown',
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheRead: usage.cache_read_input_tokens || 0,
        cacheCreation: usage.cache_creation_input_tokens || 0,
      });
    } else if (obj.type === 'user' && !obj.isMeta) {
      break; // hit the user turn boundary
    }
  }

  return results;
}

// ─── Command registration ───────────────────────────────────────────────────

export function registerMetricsCommands(program: Command): void {
  const metricsCmd = program.command('metrics').description('봇별 토큰 사용량 추적');

  // ── semo metrics log-turn ─────────────────────────────────────────────────
  metricsCmd
    .command('log-turn')
    .description('[훅 전용] Stop 훅 — 마지막 턴 usage를 bot_cost_log에 기록')
    .action(async () => {
      const payload = await parseHookPayload();
      const sessionId = payload.session_id || '';
      const transcriptPath = payload.transcript_path || '';
      const cwd = payload.cwd || '';

      if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        if (!transcriptPath) {
          process.stderr.write('[metrics] log-turn: no transcript_path in hook payload\n');
        }
        process.exit(0);
      }

      await ensureDbOrExit();

      const botId = detectBotId(cwd);
      let usages: TurnUsage[];
      try {
        usages = extractLastTurnUsage(transcriptPath);
      } catch {
        process.exit(0);
        return;
      }

      if (usages.length === 0) {
        await closeConnection();
        process.exit(0);
      }

      const pool = getPool();
      for (const u of usages) {
        const costUsd = computeCostUsd(
          u.model,
          u.inputTokens,
          u.outputTokens,
          u.cacheRead,
          u.cacheCreation,
        );
        try {
          await pool.query(
            `INSERT INTO semo.bot_cost_log
               (bot_id, cost_usd, model, input_tokens, output_tokens,
                cache_read_tokens, cache_creation_tokens, num_turns,
                session_id, message_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)
             ON CONFLICT (session_id, message_id)
               WHERE message_id IS NOT NULL
             DO NOTHING`,
            [
              botId,
              costUsd,
              u.model,
              u.inputTokens,
              u.outputTokens,
              u.cacheRead,
              u.cacheCreation,
              sessionId,
              u.messageId,
            ],
          );
        } catch (err) {
          process.stderr.write(`[metrics] log-turn error: ${err}\n`);
        }
      }

      await closeConnection();
      process.exit(0);
    });

  // ── semo metrics summary ──────────────────────────────────────────────────
  metricsCmd
    .command('summary')
    .description('봇별 토큰 사용량 집계 조회')
    .option('--bot <botId>', '특정 봇만 필터')
    .option('--period <period>', 'daily 또는 monthly', 'daily')
    .option('--days <n>', '일별 조회 일수', '7')
    .action(async (options: { bot?: string; period: string; days: string }) => {
      await ensureDbOrExit();
      const pool = getPool();

      try {
        let result;
        if (options.period === 'monthly') {
          const botFilter = options.bot ? 'WHERE bot_id = $1' : '';
          const params = options.bot ? [options.bot] : [];
          result = await pool.query(
            `SELECT bot_id, month, query_count,
                    total_input_tokens, total_output_tokens,
                    total_cost_usd, avg_latency_ms
             FROM semo.bot_cost_summary ${botFilter}
             ORDER BY month DESC, total_cost_usd DESC
             LIMIT 50`,
            params,
          );
        } else {
          const days = Math.max(1, parseInt(options.days, 10) || 7);
          const botFilter = options.bot ? 'AND bot_id = $2' : '';
          const params: (string | number)[] = [days];
          if (options.bot) params.push(options.bot);
          result = await pool.query(
            `SELECT bot_id, day, query_count,
                    total_input_tokens, total_output_tokens,
                    total_cost_usd
             FROM semo.bot_cost_daily
             WHERE day >= CURRENT_DATE - $1::int ${botFilter}
             ORDER BY day DESC, total_cost_usd DESC`,
            params,
          );
        }

        if (result.rows.length === 0) {
          console.log('데이터 없음');
        } else {
          const header =
            options.period === 'monthly'
              ? 'bot_id        | month      | turns | input_tok | output_tok | cost_usd  | avg_ms'
              : 'bot_id        | day        | turns | input_tok | output_tok | cost_usd';
          const sep = '-'.repeat(header.length);
          console.log(header);
          console.log(sep);
          for (const r of result.rows) {
            const dateStr =
              options.period === 'monthly'
                ? String(r.month).slice(0, 10)
                : String(r.day).slice(0, 10);
            const line = [
              String(r.bot_id).padEnd(13),
              dateStr,
              String(r.query_count).padStart(5),
              String(r.total_input_tokens).padStart(9),
              String(r.total_output_tokens).padStart(10),
              Number(r.total_cost_usd).toFixed(4).padStart(9),
            ];
            if (options.period === 'monthly') {
              line.push(String(r.avg_latency_ms || 0).padStart(6));
            }
            console.log(line.join(' | '));
          }
        }
      } catch (err) {
        process.stderr.write(`[metrics] summary error: ${err}\n`);
      } finally {
        await closeConnection();
      }
    });
}
