/**
 * semo action-items — 액션 아이템 CRUD (DB SoT)
 *
 * KB가 아닌 semo.action_items 테이블에 직접 읽기/쓰기.
 * 봇 스킬에서 `semo action-items create/list/update/complete` 로 호출.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { Pool } from 'pg';
import { getPool, closeConnection, isDbConnected } from '../database';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseJsonOption(value: string | undefined, label: string): Record<string, unknown> {
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 는 JSON object 여야 합니다`);
  }
  return parsed as Record<string, unknown>;
}

function normalizeTextOption(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function inferActionActor(): string {
  return (
    process.env.SEMO_BOT_ID ||
    process.env.OPENCLAW_PROFILE ||
    process.env.HERMESS_AGENT_ID ||
    process.env.CODEX_AGENT_ID ||
    process.env.USER ||
    'unknown'
  );
}

function inferActionActorKind(): string {
  if (process.env.OPENCLAW_PROFILE) return 'openclaw';
  if (process.env.HERMESS_AGENT_ID) return 'hermess';
  if (process.env.CODEX_AGENT_ID || process.env.CODEX_HOME) return 'codex';
  if (process.env.CLAUDE_CONFIG_DIR || process.env.CLAUDECODE) return 'claude-code';
  if (process.env.SEMO_BOT_ID) return 'semo-agent';
  return 'local';
}

async function resolveActionItemId(pool: Pool, input: string): Promise<string> {
  if (UUID_RE.test(input)) return input;
  if (!/^[0-9a-f-]+$/i.test(input)) {
    throw new Error(`'${input}' 는 유효한 UUID prefix가 아닙니다 (hex/hyphen만 허용)`);
  }
  const res = await pool.query(
    `SELECT action_item_id FROM semo.action_items WHERE action_item_id::text LIKE $1`,
    [`${input.toLowerCase()}%`],
  );
  if (res.rows.length === 0) {
    throw new Error(`'${input}' 와 일치하는 액션 아이템이 없습니다`);
  }
  if (res.rows.length > 1) {
    throw new Error(
      `'${input}' 가 ${res.rows.length}건과 일치합니다. 더 긴 prefix 또는 전체 UUID 사용`,
    );
  }
  return res.rows[0].action_item_id;
}

// ─── Ouroboros C1 — Ambiguity Ranker (phase 1: deterministic heuristic) ─────
// 디자인: /tmp/ouroboros-sandbox/evidence/c1_results.json (LLM 기반 sandbox 결과 —
// 'default floor 가 빡세서 0/8 통과') 의 후속. LLM 호출 없이 description text 만으로
// goal / constraint / success 3축을 0~1 로 점수화한다. 운영 noise 0 (분석/조회 전용).
//
// LLM 기반 phase 2 는 PR4 outbox/lifecycle 도착 후 별도 트랙. 둘이 공존해도 문제 없도록
// 구조 분리.

interface AmbiguityScore {
  goal: number;
  constraint: number;
  success: number;
  overall: number;
  flags: string[];
}

function scoreActionItem(description: string): AmbiguityScore {
  const desc = description.trim();
  const lower = desc.toLowerCase();
  const len = desc.length;
  const flags: string[] = [];

  // Goal: actionable verb + specific subject
  let goal = 0.5;
  if (/\b(add|create|implement|fix|delete|update|remove|enable|migrate|wire|publish)\b/i.test(desc))
    goal += 0.15;
  if (/(추가|생성|구현|수정|삭제|업데이트|제거|활성화|마이그레이션|배포|작성|등록)/.test(desc))
    goal += 0.15;
  // 구체적 주체 표시 — 파일경로, 패키지, 테이블명 등
  if (/\bpackages?\/|\bsrc\/|\.(ts|tsx|sql|json|md|yml)\b/i.test(desc)) goal += 0.1;
  if (/\bsemo\.\w+|\bbot_\w+|\bmigration\b/i.test(desc)) goal += 0.1;
  if (len < 30) {
    goal -= 0.2;
    flags.push('too-short');
  }
  goal = Math.max(0, Math.min(1, goal));

  // Constraint: scope qualifiers, structured items, bounds
  let constraint = 0.5;
  // 구조화된 리스트 (1) (2) (3) 또는 - 항목들
  const structuredItems =
    (desc.match(/\((\d+)\)/g) || []).length + (desc.match(/(?:^|\n)\s*[-•]\s/g) || []).length;
  if (structuredItems >= 2) constraint += 0.2;
  if (structuredItems >= 4) constraint += 0.1;
  // 시간/리소스 한계
  if (/(\d+(시간|분|일|주|월|h|d|m)\b|\b(deadline|마감|by\s|까지))/i.test(desc)) constraint += 0.1;
  // 외부 참조 — KB / PR / issue / URL / commit
  if (
    /\b(KB:|kb\s+get|kb\s+upsert|PR\s*#?\d+|issue\s*#?\d+|https?:\/\/|commit\s+[0-9a-f]{7})/i.test(
      desc,
    )
  )
    constraint += 0.15;
  // 명시 dependency / blocked by
  if (/blocked|의존|선행|이후|다음|먼저|prerequisite/i.test(desc)) constraint += 0.05;
  if (len < 50 && structuredItems === 0) {
    constraint -= 0.15;
    flags.push('no-scope');
  }
  constraint = Math.max(0, Math.min(1, constraint));

  // Success: measurable outcome / verification path
  let success = 0.45;
  // verification keywords
  if (/(검증|확인|verify|test|smoke|sample|case|건|개|회|번|회수)/i.test(desc)) success += 0.15;
  // numeric thresholds
  if (/\b\d+(\s*(건|개|%|회|배|배수|ms|s|분|시간|일|회수))/.test(desc)) success += 0.15;
  // 명시 PR / merge / publish / close
  if (/(merge|머지|publish|close|resolve|complete|완료|종료|적용)/i.test(desc)) success += 0.1;
  // CI/QG 통과
  if (/\b(CI|QG|quality\s*gate|workflow|pipeline)\b/i.test(desc)) success += 0.1;
  // vague closure verbs — 점수 차감
  if (/(알아보기|검토만|조사만|논의\s*$|라운드\s*$|살펴보기|체크해보기)/i.test(desc)) {
    success -= 0.2;
    flags.push('vague-verb');
  }
  // 단일 단문 + 액션 성공조건 부재
  if (len < 60 && !/[\d건개%]/i.test(desc)) {
    success -= 0.1;
    flags.push('no-measurable');
  }
  success = Math.max(0, Math.min(1, success));

  const overall = 0.4 * goal + 0.3 * constraint + 0.3 * success;
  return { goal, constraint, success, overall, flags };
}

export function registerActionItemsCommands(program: Command): void {
  const cmd = program.command('action-items').description('액션 아이템 관리 (DB SoT)');

  // ── semo action-items create ──
  cmd
    .command('create')
    .description('새 액션 아이템 생성')
    .requiredOption('--owner <domain>', '담당자 도메인 (ontology)')
    .option('--target <domain>', '대상 서비스/프로젝트 도메인')
    .requiredOption('--description <text>', '설명')
    .option('--assignee <name>', '담당자 표시명')
    .option('--deadline <date>', '기한 (YYYY-MM-DD)')
    .option('--priority <level>', '우선순위 (low|normal|high|urgent)', 'normal')
    .option('--source <src>', '출처', 'bot')
    .option('--related-url <url>', '관련 URL')
    .option('--metadata <json>', '추가 메타데이터 (JSON)')
    .action(async (opts) => {
      if (!(await isDbConnected())) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      const pool = getPool();
      try {
        const metadata = parseJsonOption(opts.metadata, '--metadata');
        const res = await pool.query(
          `INSERT INTO semo.action_items
            (owner_domain, target_domain, description, assignee, deadline, priority, source, related_url, metadata)
           VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)
           RETURNING action_item_id, owner_domain, description, status`,
          [
            opts.owner,
            opts.target || null,
            opts.description,
            opts.assignee || null,
            opts.deadline || null,
            opts.priority,
            opts.source,
            opts.relatedUrl || null,
            JSON.stringify(metadata),
          ],
        );
        const item = res.rows[0];
        console.log(chalk.green(`✅ 생성됨: ${item.action_item_id}`));
        console.log(
          `  owner: ${item.owner_domain} | desc: ${item.description} | status: ${item.status}`,
        );
      } catch (err) {
        console.error(chalk.red('생성 실패:'), err instanceof Error ? err.message : err);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo action-items list ──
  cmd
    .command('list')
    .description('액션 아이템 목록 조회')
    .option('--owner <domain>', '담당자 필터')
    .option('--target <domain>', '대상 서비스 필터')
    .option('--status <status>', '상태 필터 (open|completed|cancelled)')
    .option('--limit <n>', '최대 건수', '20')
    .option('--format <fmt>', '출력 형식 (table|json)', 'table')
    .action(async (opts) => {
      if (!(await isDbConnected())) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      const pool = getPool();
      try {
        const conditions: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (opts.owner) {
          conditions.push(`owner_domain = $${idx++}`);
          params.push(opts.owner);
        }
        if (opts.target) {
          conditions.push(`target_domain = $${idx++}`);
          params.push(opts.target);
        }
        if (opts.status) {
          conditions.push(`status = $${idx++}`);
          params.push(opts.status);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(parseInt(opts.limit));

        const res = await pool.query(
          `SELECT action_item_id, owner_domain, target_domain, description, assignee,
                  to_char(deadline, 'YYYY-MM-DD') AS deadline,
                  status, priority, completed_at, metadata,
                  to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS created_at
           FROM semo.action_items ${where}
           ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END, created_at DESC
           LIMIT $${idx}`,
          params,
        );

        if (opts.format === 'json') {
          console.log(JSON.stringify(res.rows, null, 2));
          return;
        }

        if (res.rows.length === 0) {
          console.log(chalk.yellow('액션 아이템 없음'));
          return;
        }

        console.log(chalk.bold(`액션 아이템 (${res.rows.length}건):\n`));
        for (const r of res.rows) {
          const statusIcon = r.status === 'open' ? '⬜' : r.status === 'completed' ? '✅' : '⛔';
          const deadline = r.deadline ? chalk.gray(` ~${r.deadline}`) : '';
          const target = r.target_domain ? chalk.blue(` [${r.target_domain}]`) : '';
          console.log(
            `${statusIcon} ${chalk.dim(r.action_item_id.slice(0, 8))} ${r.description}${deadline}${target}`,
          );
          console.log(
            `   owner: ${r.owner_domain}${r.assignee ? ` | assignee: ${r.assignee}` : ''} | ${r.priority}`,
          );
        }
      } catch (err) {
        console.error(chalk.red('조회 실패:'), err instanceof Error ? err.message : err);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo action-items update ──
  cmd
    .command('update <id>')
    .description('액션 아이템 업데이트')
    .option('--status <status>', '상태 (open|completed|cancelled)')
    .option('--description <text>', '설명')
    .option('--deadline <date>', '기한')
    .option('--priority <level>', '우선순위')
    .option('--assignee <name>', '담당자')
    .option('--metadata <json>', 'metadata JSON object를 기존 metadata에 merge')
    .action(async (id, opts) => {
      if (!(await isDbConnected())) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      const pool = getPool();
      try {
        const sets: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        const VALID_STATUSES = ['open', 'completed', 'cancelled'];
        const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

        if (opts.status) {
          if (!VALID_STATUSES.includes(opts.status)) {
            console.error(
              chalk.red(`잘못된 상태: ${opts.status}. 허용: ${VALID_STATUSES.join(', ')}`),
            );
            process.exit(1);
          }
          sets.push(`status = $${idx++}`);
          params.push(opts.status);
          if (opts.status === 'completed') sets.push('completed_at = NOW()');
          if (opts.status === 'open') sets.push('completed_at = NULL');
        }
        if (opts.description) {
          sets.push(`description = $${idx++}`);
          params.push(opts.description);
        }
        if (opts.deadline) {
          sets.push(`deadline = $${idx++}::date`);
          params.push(opts.deadline);
        }
        if (opts.priority) {
          if (!VALID_PRIORITIES.includes(opts.priority)) {
            console.error(
              chalk.red(`잘못된 우선순위: ${opts.priority}. 허용: ${VALID_PRIORITIES.join(', ')}`),
            );
            process.exit(1);
          }
          sets.push(`priority = $${idx++}`);
          params.push(opts.priority);
        }
        if (opts.assignee) {
          sets.push(`assignee = $${idx++}`);
          params.push(opts.assignee);
        }
        if (opts.metadata) {
          const metadata = parseJsonOption(opts.metadata, '--metadata');
          sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
          params.push(JSON.stringify(metadata));
        }

        if (sets.length === 0) {
          console.error(chalk.yellow('변경할 항목을 지정하세요'));
          process.exit(1);
        }

        const resolvedId = await resolveActionItemId(pool, id);
        params.push(resolvedId);
        const res = await pool.query(
          `UPDATE semo.action_items SET ${sets.join(', ')} WHERE action_item_id = $${idx}
           RETURNING action_item_id, status, description, metadata`,
          params,
        );

        if (res.rows.length === 0) {
          console.error(chalk.red(`아이템 ${id} 없음`));
          process.exit(1);
        }
        console.log(chalk.green(`✅ 업데이트됨: ${res.rows[0].action_item_id}`));
        console.log(`  status: ${res.rows[0].status} | desc: ${res.rows[0].description}`);
      } catch (err) {
        console.error(chalk.red('업데이트 실패:'), err instanceof Error ? err.message : err);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo action-items rank ──
  // Ouroboros C1 — Ambiguity Ranker, phase 1 (deterministic heuristic, no LLM).
  // 평가 축: goal / constraint / success (각 [0,1]) + overall = 0.4*goal + 0.3*constraint + 0.3*success.
  // 디폴트 floor 는 LLM 기반 sandbox 보다 permissive — 운영 noise 회피 + per-tenant 재캘리브레이션 여지.
  // CLI-only 분석 도구 — Slack 알림이나 DB 변경 없음.
  cmd
    .command('rank')
    .description('액션 아이템 ambiguity 점수 (offline heuristic, C1 phase 1)')
    .option('--owner <domain>', '특정 담당자만')
    .option('--target <domain>', '특정 서비스만')
    .option('--status <state>', '상태 필터 (open|completed)', 'open')
    .option('--threshold <n>', 'overall 점수 < threshold 인 항목만 (0~1)', '1')
    .option('--limit <n>', '최대 결과 수', '50')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      if (!(await isDbConnected())) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      const pool = getPool();
      try {
        const params: unknown[] = [];
        const where: string[] = [];
        if (options.status === 'open' || options.status === 'completed') {
          where.push(`status = $${params.length + 1}`);
          params.push(options.status);
        }
        if (options.owner) {
          where.push(`owner_domain = $${params.length + 1}`);
          params.push(options.owner);
        }
        if (options.target) {
          where.push(`target_domain = $${params.length + 1}`);
          params.push(options.target);
        }
        const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 50, 500));
        const threshold = Math.max(0, Math.min(parseFloat(options.threshold) || 1, 1));

        params.push(limit);
        const res = await pool.query<{
          action_item_id: string;
          owner_domain: string;
          target_domain: string | null;
          description: string;
          priority: string;
          deadline: Date | null;
        }>(
          `SELECT action_item_id, owner_domain, target_domain, description, priority, deadline
           FROM semo.action_items
           ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
           ORDER BY created_at DESC
           LIMIT $${params.length}`,
          params,
        );

        const ranked = res.rows
          .map((r) => ({ row: r, score: scoreActionItem(r.description) }))
          .filter((x) => x.score.overall < threshold)
          .sort((a, b) => a.score.overall - b.score.overall);

        if (options.format === 'json') {
          console.log(
            JSON.stringify(
              ranked.map((x) => ({
                action_item_id: x.row.action_item_id,
                owner: x.row.owner_domain,
                target: x.row.target_domain,
                priority: x.row.priority,
                description_preview: x.row.description.slice(0, 80),
                ...x.score,
              })),
              null,
              2,
            ),
          );
        } else {
          console.log(
            chalk.bold(
              `\n🎯 Ambiguity Rank — ${ranked.length}/${res.rows.length} items below threshold ${threshold}\n`,
            ),
          );
          if (ranked.length === 0) {
            console.log(chalk.green('  ✓ no items flagged'));
          } else {
            for (const x of ranked) {
              const id8 = x.row.action_item_id.slice(0, 8);
              const overall = x.score.overall.toFixed(2);
              const g = x.score.goal.toFixed(2);
              const c = x.score.constraint.toFixed(2);
              const s = x.score.success.toFixed(2);
              const flagsStr = x.score.flags.length
                ? chalk.yellow(`  [${x.score.flags.join(', ')}]`)
                : '';
              console.log(
                `  ${chalk.cyan(id8)} ${chalk.gray(x.row.owner_domain.padEnd(12))} ` +
                  `overall=${overall} (g=${g} c=${c} s=${s})${flagsStr}`,
              );
              console.log(`    ${chalk.gray(x.row.description.slice(0, 100))}`);
            }
          }
          console.log();
        }
      } catch (err) {
        console.error(chalk.red('rank 실패:'), err instanceof Error ? err.message : err);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo action-items complete ──
  cmd
    .command('complete <id>')
    .description('액션 아이템 완료 처리')
    .option('--actor <id>', '처리 주체 ID/이름')
    .option(
      '--actor-kind <kind>',
      '처리 주체 종류 (codex|claude-code|openclaw|hermess|semo-agent|human)',
    )
    .option('--model <name>', '사용 모델명')
    .option('--method <text>', '처리 방식 요약')
    .option('--verification <text>', '검증 결과')
    .option('--follow-up <text>', '후속 테스트/확인 요청')
    .option('--notified-channel <channel>', '완료 보고를 보낸 메신저 채널')
    .option('--notification-url <url>', '완료 보고 permalink')
    .option('--metadata <json>', '추가 metadata JSON object')
    .action(async (id, opts) => {
      if (!(await isDbConnected())) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      const pool = getPool();
      try {
        const resolvedId = await resolveActionItemId(pool, id);
        const currentRes = await pool.query(
          `SELECT description, owner_domain, target_domain
           FROM semo.action_items
           WHERE action_item_id = $1`,
          [resolvedId],
        );
        if (currentRes.rows.length === 0) {
          console.error(chalk.red(`아이템 ${id} 없음`));
          process.exit(1);
        }
        const currentItem = currentRes.rows[0];
        const completedAt = new Date().toISOString();
        const extraMetadata = parseJsonOption(opts.metadata, '--metadata');
        const completionEntry = {
          action_item_id: resolvedId,
          action_description: currentItem.description,
          owner_domain: currentItem.owner_domain,
          target_domain: currentItem.target_domain,
          actor: opts.actor || inferActionActor(),
          actor_kind: opts.actorKind || inferActionActorKind(),
          model: normalizeTextOption(opts.model) || null,
          method: normalizeTextOption(opts.method) || null,
          verification: normalizeTextOption(opts.verification) || null,
          follow_up: normalizeTextOption(opts.followUp) || null,
          notified_channel: normalizeTextOption(opts.notifiedChannel) || null,
          notification_url: normalizeTextOption(opts.notificationUrl) || null,
          completed_at: completedAt,
        };
        const metadataPatch = {
          ...extraMetadata,
          completion: completionEntry,
        };
        const res = await pool.query(
          `UPDATE semo.action_items
           SET status = 'completed',
               completed_at = $2::timestamptz,
               metadata = COALESCE(metadata, '{}'::jsonb)
                 || $3::jsonb
                 || jsonb_build_object(
                      'completion_log',
                      COALESCE(metadata->'completion_log', '[]'::jsonb) || jsonb_build_array($4::jsonb)
                    )
           WHERE action_item_id = $1
           RETURNING action_item_id, description, completed_at, metadata`,
          [
            resolvedId,
            completedAt,
            JSON.stringify(metadataPatch),
            JSON.stringify(completionEntry),
          ],
        );
        if (res.rows.length === 0) {
          console.error(chalk.red(`아이템 ${id} 없음`));
          process.exit(1);
        }
        console.log(chalk.green(`✅ 완료: ${res.rows[0].description}`));
        console.log(`  actor: ${completionEntry.actor_kind}/${completionEntry.actor}`);
        console.log(`  completed_at: ${completedAt}`);
      } catch (err) {
        console.error(chalk.red('완료 처리 실패:'), err instanceof Error ? err.message : err);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
