/**
 * SSE endpoint — bot_commitments 변경 실시간 push.
 *
 * P2-C (2026-05-28): orchestrator-flow 페이지에서 EventSource 로 consume.
 * - PG LISTEN 'semo_commitment_change' (migration 124)
 * - 또는 폴링 폴백 (migration 미적용 환경)
 *
 * 환경변수:
 *   SEMO_SSE_POLL_INTERVAL_MS — 폴링 폴백 주기 (default 5000)
 *
 * KB: semo decision/pluggable-persistence-implementation-2026-05-28 의 P2-C
 */
import type { NextRequest } from 'next/server';
import type { PoolClient } from 'pg';
import { Pool } from 'pg';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

declare global {
  // eslint-disable-next-line no-var
  var __semoSsePool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__semoSsePool) {
    globalThis.__semoSsePool = process.env.DATABASE_URL
      ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
      : new Pool({
          host: process.env.KB_DB_HOST || '127.0.0.1',
          port: parseInt(process.env.KB_DB_PORT || '5432', 10),
          user: process.env.KB_DB_USER || 'app',
          password: process.env.KB_DB_PASSWORD || '',
          database: process.env.KB_DB_NAME || 'appdb',
          max: 3,
        });
  }
  return globalThis.__semoSsePool;
}

interface CommitmentPayload {
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  id: string;
  bot_id: string;
  status: string;
  runtime_source: string | null;
  source_type: string | null;
}

const POLL_INTERVAL_MS = Number(process.env.SEMO_SSE_POLL_INTERVAL_MS || 5000);

export async function GET(req: NextRequest) {
  const pool = getPool();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let listenClient: PoolClient | null = null;
      let pollHandle: ReturnType<typeof setInterval> | null = null;
      let lastSeenAt: string | null = null;
      // 개선5 (2026-05-28): 폴링 커서 race 방어.
      //   seen_at(=GREATEST(created_at,updated_at))은 유니크하지 않다 (배치 UPDATE 가 같은 ms 공유).
      //   strict `>` 로 커서를 올리면 동일 timestamp 의 형제 row 가 영구 누락된다.
      //   → `>=` 로 조회하되, 경계 timestamp 에서 이미 emit 한 id 집합으로 중복을 제거한다.
      let sentAtBoundary = new Set<string>();
      let closed = false;

      const send = (event: string, data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* controller already closed */
        }
      };

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          /* ignore */
        }
      }, 15_000);

      // 첫 메시지 (지원 검증)
      send('ready', { ts: new Date().toISOString() });

      // 시도 1: PG LISTEN
      try {
        listenClient = await pool.connect();
        await listenClient.query('LISTEN semo_commitment_change');
        listenClient.on('notification', (msg) => {
          if (msg.channel !== 'semo_commitment_change' || !msg.payload) return;
          try {
            const payload = JSON.parse(msg.payload) as CommitmentPayload;
            send('commitment', payload);
          } catch (err) {
            console.warn('[sse] notification parse failed:', (err as Error).message);
          }
        });
        send('mode', { mode: 'listen' });
      } catch (err) {
        // migration 124 미적용 또는 권한 문제 → 폴링 폴백
        console.warn('[sse] LISTEN 실패, 폴링 폴백:', (err as Error).message);
        listenClient = null;
        send('mode', { mode: 'poll', interval_ms: POLL_INTERVAL_MS });

        pollHandle = setInterval(async () => {
          if (closed) return;
          try {
            const params: (string | number)[] = [];
            let sql = `
              SELECT id, bot_id, status, runtime_source, source_type,
                     GREATEST(created_at, updated_at) AS seen_at
                FROM ${DB_SCHEMA}.bot_commitments
            `;
            if (lastSeenAt) {
              // `>=` 로 경계 동일-timestamp row 누락 방지 (중복은 아래 sentAtBoundary 로 제거).
              sql += ` WHERE GREATEST(created_at, updated_at) >= $1`;
              params.push(lastSeenAt);
            }
            sql += ` ORDER BY GREATEST(created_at, updated_at) DESC LIMIT 50`;
            const r = await pool.query<CommitmentPayload & { seen_at: string }>(sql, params);
            const rows = r.rows.reverse(); // 오름차순
            const cursorBefore = lastSeenAt;
            let maxSeen = lastSeenAt;
            for (const row of rows) {
              // 경계 timestamp 에서 이미 보낸 row 면 skip (중복 방지).
              if (cursorBefore && row.seen_at === cursorBefore && sentAtBoundary.has(row.id)) {
                continue;
              }
              send('commitment', {
                op: 'UPSERT',
                id: row.id,
                bot_id: row.bot_id,
                status: row.status,
                runtime_source: row.runtime_source,
                source_type: row.source_type,
              });
              if (!maxSeen || row.seen_at > maxSeen) {
                maxSeen = row.seen_at;
              }
            }
            // 커서/경계집합 갱신 — maxSeen 시점의 id 들을 다음 폴링의 중복필터로 보존.
            if (maxSeen) {
              const nextBoundary = new Set<string>();
              for (const row of rows) {
                if (row.seen_at === maxSeen) nextBoundary.add(row.id);
              }
              // 커서가 안 올라갔으면 (모두 경계에 머무름) 직전 집합도 합산해 누적.
              if (maxSeen === cursorBefore) {
                for (const id of sentAtBoundary) nextBoundary.add(id);
              }
              lastSeenAt = maxSeen;
              sentAtBoundary = nextBoundary;
            }
          } catch (pollErr) {
            console.warn('[sse] poll error:', (pollErr as Error).message);
          }
        }, POLL_INTERVAL_MS);
      }

      // 클라이언트 disconnect
      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(heartbeat);
        if (pollHandle) clearInterval(pollHandle);
        if (listenClient) {
          listenClient.query('UNLISTEN semo_commitment_change').catch(() => {});
          listenClient.release();
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
