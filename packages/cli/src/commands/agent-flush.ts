/**
 * semo agent-* — 로컬 Claude Code 훅 통합
 *
 * Claude Code의 Task 도구(subagent spawn)와 세션 lifecycle을
 * bot_commitments / bot_sessions 테이블에 기록한다.
 *
 * 커맨드:
 *   semo agent-claim       — PreToolUse(Task) 훅에서 commitment claim
 *   semo agent-flush       — SubagentStop 훅에서 claim된 commitments done 처리
 *   semo session-register  — SessionStart 훅에서 bot_sessions 행 생성
 *   semo session-terminate — SessionEnd 훅에서 bot_sessions terminated + 잔여 정리
 *
 * 모든 커맨드는 stdin으로 Claude Code hook JSON을 받고,
 * parent session_id별 사이드카 파일에 commitment id 목록을 추적한다.
 * DB 연결 실패 시 exit 0 — 훅이 세션을 블로킹하지 않는다.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getPool, closeConnection, isDbConnected } from '../database';
import { recordCommitmentFailure, recordCommitmentSuccess } from '../commitment-escalation';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

// ─── Sidecar helpers ─────────────────────────────────────────────────────────

interface SidecarEntry {
  id: string;
  bot_id: string;
  ts: number;
}

function sidecarPath(parentSessionId: string): string {
  // session_id는 UUID라 파일명에 안전
  return path.join(os.tmpdir(), `semo-claw-${parentSessionId}.jsonl`);
}

function appendSidecar(parentSessionId: string, entry: SidecarEntry): void {
  try {
    fs.appendFileSync(sidecarPath(parentSessionId), JSON.stringify(entry) + '\n');
  } catch {
    /* ignore — sidecar is best-effort */
  }
}

function readSidecar(parentSessionId: string): SidecarEntry[] {
  try {
    const raw = fs.readFileSync(sidecarPath(parentSessionId), 'utf8');
    return raw
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as SidecarEntry);
  } catch {
    return [];
  }
}

function truncateSidecar(parentSessionId: string): void {
  try {
    fs.unlinkSync(sidecarPath(parentSessionId));
  } catch {
    /* ignore */
  }
}

// ─── stdin helpers ───────────────────────────────────────────────────────────

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
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: {
    subagent_type?: string;
    description?: string;
    prompt?: string;
  };
  reason?: string;
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

function localSessionKey(parentSessionId: string): string {
  return `local-${parentSessionId}`;
}

function localOwner(): string {
  try {
    return `${os.userInfo().username}-local`;
  } catch {
    return 'unknown-local';
  }
}

function generateCommitmentId(botId: string): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `cmt-${botId}-${Date.now()}-${rand}`;
}

async function ensureDbOrExit(): Promise<void> {
  const connected = await isDbConnected();
  if (!connected) {
    process.exit(0);
  }
}

// ─── Command registration ───────────────────────────────────────────────────

export function registerAgentFlushCommands(program: Command): void {
  // ── semo agent-claim ───────────────────────────────────────────────────────
  // PreToolUse(Task) 훅이 호출. Task spawn을 bot_commitments에 기록하고
  // id를 사이드카에 append한다.
  program
    .command('agent-claim')
    .description('[훅 전용] PreToolUse(Task) — subagent spawn commitment 생성')
    .action(async () => {
      const payload = await parseHookPayload();
      const parentSessionId = payload.session_id || '';
      const botId = payload.tool_input?.subagent_type || '';
      const description = payload.tool_input?.description || '';

      // subagent_type이 없으면 Task가 아닌 다른 tool이거나 payload 파싱 실패
      if (!parentSessionId || !botId) {
        process.exit(0);
      }

      await ensureDbOrExit();

      const id = generateCommitmentId(botId);
      const title = (description || '(no description)').slice(0, 200);
      const owner = localOwner();
      const sessionKey = localSessionKey(parentSessionId);
      const pipelineContext = { parent_session_id: parentSessionId, description };

      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO ${DB_SCHEMA}.bot_commitments
             (id, bot_id, status, title, source_type, assigned_session, session_owner, pipeline_context)
           VALUES ($1, $2, 'active', $3, 'claude-code-local', $4, $5, $6)`,
          [id, botId, title, sessionKey, owner, JSON.stringify(pipelineContext)],
        );
        appendSidecar(parentSessionId, { id, bot_id: botId, ts: Date.now() });
      } catch (err) {
        process.stderr.write(`[agent-claim] error: ${err}\n`);
      } finally {
        await closeConnection();
      }
      process.exit(0);
    });

  // ── semo agent-flush ───────────────────────────────────────────────────────
  // SubagentStop 훅이 호출. parent session_id의 사이드카에 기록된 모든
  // commitment을 done으로 마감하고 사이드카를 truncate한다.
  //
  // 구조적 한계: SubagentStop은 subagent의 session_id가 아닌 parent의 것만
  // 전달받으므로, 한 parent 세션에서 병렬로 여러 subagent가 끝날 때는
  // 이 훅이 여러 번 불리면서 매번 사이드카 전체를 싹 마감한다. 따라서
  // 실제 동작은 "parent 세션의 현재까지 claim된 것 일괄 done"이 된다.
  // 병렬 spawn 시 세밀한 개별 추적을 원하면 PostToolUse(Task)로 이관 필요.
  program
    .command('agent-flush')
    .description('[훅 전용] SubagentStop — parent 세션 commitments done 처리')
    .option('--bot <botId>', '(레거시) 특정 봇만 마감 — sidecar 없을 때 fallback')
    .action(async (options) => {
      const payload = await parseHookPayload();
      const parentSessionId = payload.session_id || '';

      await ensureDbOrExit();

      const entries = parentSessionId ? readSidecar(parentSessionId) : [];

      try {
        const pool = getPool();

        if (entries.length > 0) {
          const ids = entries.map((e) => e.id);
          const result = await pool.query(
            `UPDATE ${DB_SCHEMA}.bot_commitments
             SET status = 'done'
             WHERE id = ANY($1::text[]) AND status IN ('pending', 'active')
             RETURNING id, bot_id, title`,
            [ids],
          );
          for (const row of result.rows) {
            process.stderr.write(`[agent-flush] done: ${row.id} (${row.bot_id}) — ${row.title}\n`);
            // C3 PR2: pattern escalation 카운터 reset.
            await recordCommitmentSuccess(row.bot_id, row.title);
          }
          truncateSidecar(parentSessionId);
        } else if (options.bot) {
          // Fallback: --bot 옵션만 주어진 레거시 경로
          // slack-inbox는 slack-router가 outbox 매칭으로 done 처리하고,
          // cron은 데몬이 mark-run으로 직접 마감하므로 둘 다 여기서는 건드리지 않는다
          // — 봇 Stop 훅이 살아있는 외부 작업을 조기 마감하는 것을 방지
          const sessionKey = parentSessionId ? localSessionKey(parentSessionId) : '';
          const result = await pool.query<{ id: string; bot_id: string; title: string }>(
            `UPDATE ${DB_SCHEMA}.bot_commitments
             SET status = 'done'
             WHERE bot_id = $1
               AND status IN ('pending', 'active')
               AND source_type NOT IN ('slack-inbox', 'cron')
               AND ($2 = '' OR assigned_session = $2)
             RETURNING id, bot_id, title`,
            [options.bot, sessionKey],
          );
          for (const row of result.rows) {
            process.stderr.write(`[agent-flush:fallback] done: ${row.id} — ${row.title}\n`);
            // C3 PR2: pattern escalation 카운터 reset.
            await recordCommitmentSuccess(row.bot_id, row.title);
          }
        }
      } catch (err) {
        process.stderr.write(`[agent-flush] error: ${err}\n`);
      } finally {
        await closeConnection();
      }
      process.exit(0);
    });

  // ── semo session-register ──────────────────────────────────────────────────
  // SessionStart 훅이 호출. parent session의 bot_sessions 행을 생성한다.
  // bot_id는 FK 제약(bot_status) 때문에 'semiclaw' 고정. 로컬 세션 구분은
  // environment='claude-code-local'과 session_key 접두어 'local-'로 수행.
  program
    .command('session-register')
    .description('[훅 전용] SessionStart — 로컬 Claude Code 세션 등록')
    .action(async () => {
      const payload = await parseHookPayload();
      const parentSessionId = payload.session_id || '';
      if (!parentSessionId) process.exit(0);

      await ensureDbOrExit();

      const owner = localOwner();
      const sessionKey = localSessionKey(parentSessionId);

      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO ${DB_SCHEMA}.bot_sessions
             (bot_id, session_key, kind, chat_type, owner, environment, status, started_at)
           VALUES ('semiclaw', $1, 'main', 'claude-code', $2, 'claude-code-local', 'active', NOW())
           ON CONFLICT (bot_id, session_key) DO UPDATE
             SET status = 'active', started_at = NOW(), owner = EXCLUDED.owner, environment = 'claude-code-local'`,
          [sessionKey, owner],
        );
      } catch (err) {
        process.stderr.write(`[session-register] error: ${err}\n`);
      } finally {
        await closeConnection();
      }
      process.exit(0);
    });

  // ── semo session-terminate ─────────────────────────────────────────────────
  // SessionEnd 훅이 호출. bot_sessions → terminated. 사이드카 잔여는
  // session-end-orphan 으로 마감 후 파일 제거.
  program
    .command('session-terminate')
    .description('[훅 전용] SessionEnd — 로컬 세션 종료 + 잔여 commitment 정리')
    .action(async () => {
      const payload = await parseHookPayload();
      const parentSessionId = payload.session_id || '';
      if (!parentSessionId) process.exit(0);

      await ensureDbOrExit();

      const sessionKey = localSessionKey(parentSessionId);
      const entries = readSidecar(parentSessionId);

      try {
        const pool = getPool();

        // 1. 잔여 commitment 정리 (session-end-orphan)
        if (entries.length > 0) {
          const ids = entries.map((e) => e.id);
          const orphanResult = await pool.query<{ id: string; bot_id: string; title: string }>(
            `UPDATE ${DB_SCHEMA}.bot_commitments
             SET status = 'failed',
                 metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('fail_reason', 'session-end-orphan')
             WHERE id = ANY($1::text[]) AND status IN ('pending', 'active')
             RETURNING id, bot_id, title`,
            [ids],
          );
          // C3 PR2: orphan reaped failure 도 패턴 카운터에 적재.
          for (const row of orphanResult.rows) {
            await recordCommitmentFailure(row.bot_id, row.title);
          }
          truncateSidecar(parentSessionId);
        }

        // 2. 세션 terminated
        await pool.query(
          `UPDATE ${DB_SCHEMA}.bot_sessions
           SET status = 'terminated', ended_at = NOW()
           WHERE bot_id = 'semiclaw' AND session_key = $1`,
          [sessionKey],
        );
      } catch (err) {
        process.stderr.write(`[session-terminate] error: ${err}\n`);
      } finally {
        await closeConnection();
      }
      process.exit(0);
    });
}
