/**
 * semo commitments — 봇 약속 추적 (Durable Task Tracking)
 *
 * 봇이 "~하겠습니다" 약속 후 세션 종료되어도 추적 가능하도록
 * semo.bot_commitments 테이블에 기록하고, 워치독이 overdue/stale 감지.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getPool, closeConnection, isDbConnected } from '../database';

// ─── ID 생성 ─────────────────────────────────────────────────────────────────

function generateCommitmentId(botId: string): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `cmt-${botId}-${Date.now()}-${rand}`;
}

// ─── deadline 파싱 ───────────────────────────────────────────────────────────

function parseDeadline(input: string): string {
  const match = input.match(/^(\d+)(m|h|d)$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    const now = new Date();
    if (unit === 'm') now.setMinutes(now.getMinutes() + value);
    else if (unit === 'h') now.setHours(now.getHours() + value);
    else if (unit === 'd') now.setDate(now.getDate() + value);
    return now.toISOString();
  }
  // ISO 문자열이면 그대로
  return new Date(input).toISOString();
}

// ─── Command registration ───────────────────────────────────────────────────

export function registerCommitmentsCommands(program: Command): void {
  const cmd = program
    .command('commitments')
    .description('봇 약속 추적 (Durable Commitment Tracking)');

  // ── semo commitments create ────────────────────────────────────────────────
  cmd
    .command('create')
    .description('새 약속 등록')
    .requiredOption('--bot-id <id>', '봇 ID')
    .requiredOption('--title <text>', '약속 제목')
    .option('--description <text>', '상세 설명')
    .option('--source-type <type>', '출처 (github-issue|slack|cron|manual)')
    .option('--source-ref <ref>', '출처 참조 (issue URL, channel:thread)')
    .option('--deadline <time>', '기한 (15m, 1h, 2d, 또는 ISO 문자열)')
    .option('--steps <json>', '단계 JSON 배열 (예: \'[{"label":"Step1","done":false}]\')')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      const id = generateCommitmentId(options.botId);
      const deadlineAt = options.deadline ? parseDeadline(options.deadline) : null;
      let steps: Array<{ label: string; done: boolean }> = [];
      if (options.steps) {
        try {
          steps = JSON.parse(options.steps);
        } catch {
          console.error(chalk.red('❌ --steps JSON 파싱 실패'));
          await closeConnection();
          process.exit(1);
        }
      }

      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO semo.bot_commitments
             (id, bot_id, status, title, description, source_type, source_ref, deadline_at, steps)
           VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8)`,
          [
            id,
            options.botId,
            options.title,
            options.description ?? null,
            options.sourceType ?? null,
            options.sourceRef ?? null,
            deadlineAt,
            JSON.stringify(steps),
          ],
        );
        console.log(chalk.green(`✔ commitment created: ${id}`));
        if (!options.sourceType) {
          console.log(chalk.yellow(`⚠ source-type 미지정: 자동 검증 불가. --source-type 권장.`));
        }
        console.log(
          JSON.stringify({
            id,
            bot_id: options.botId,
            title: options.title,
            deadline_at: deadlineAt,
          }),
        );
      } catch (err) {
        console.error(chalk.red(`❌ create 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments update ────────────────────────────────────────────────
  cmd
    .command('update <id>')
    .description('진행 보고 (heartbeat, status, step 완료)')
    .option('--heartbeat', 'heartbeat 갱신')
    .option('--status <status>', '상태 변경 (active|pending)')
    .option('--step-done <label>', '특정 step을 완료 처리')
    .action(async (id, options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();

        if (options.heartbeat) {
          await pool.query(
            `UPDATE semo.bot_commitments
             SET last_heartbeat_at = NOW(),
                 status = CASE WHEN status = 'pending' THEN 'active' ELSE status END
             WHERE id = $1`,
            [id],
          );
          console.log(chalk.green(`✔ heartbeat updated: ${id}`));
        }

        if (options.status) {
          await pool.query(`UPDATE semo.bot_commitments SET status = $1 WHERE id = $2`, [
            options.status,
            id,
          ]);
          console.log(chalk.green(`✔ status → ${options.status}: ${id}`));
        }

        if (options.stepDone) {
          await pool.query(
            `UPDATE semo.bot_commitments
             SET steps = (
               SELECT jsonb_agg(
                 CASE
                   WHEN elem->>'label' = $2 THEN jsonb_set(elem, '{done}', 'true')
                   ELSE elem
                 END
               )
               FROM jsonb_array_elements(steps) AS elem
             )
             WHERE id = $1`,
            [id, options.stepDone],
          );
          console.log(chalk.green(`✔ step done "${options.stepDone}": ${id}`));
        }
      } catch (err) {
        console.error(chalk.red(`❌ update 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments done ──────────────────────────────────────────────────
  cmd
    .command('done <id>')
    .description('약속 완료 처리')
    .action(async (id) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const result = await pool.query(
          `UPDATE semo.bot_commitments SET status = 'done' WHERE id = $1 AND status IN ('pending', 'active') RETURNING id`,
          [id],
        );
        if (result.rowCount === 0) {
          console.error(chalk.yellow(`⚠ commitment 없거나 이미 종료됨: ${id}`));
        } else {
          console.log(chalk.green(`✔ commitment done: ${id}`));
        }
      } catch (err) {
        console.error(chalk.red(`❌ done 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments fail ──────────────────────────────────────────────────
  cmd
    .command('fail <id>')
    .description('약속 실패 처리')
    .option('--reason <text>', '실패 사유')
    .action(async (id, options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const metadataUpdate = options.reason
          ? `, metadata = metadata || jsonb_build_object('fail_reason', $2::text)`
          : '';
        const params = options.reason ? [id, options.reason] : [id];

        const result = await pool.query(
          `UPDATE semo.bot_commitments SET status = 'failed'${metadataUpdate} WHERE id = $1 AND status IN ('pending', 'active') RETURNING id`,
          params,
        );
        if (result.rowCount === 0) {
          console.error(chalk.yellow(`⚠ commitment 없거나 이미 종료됨: ${id}`));
        } else {
          console.log(chalk.green(`✔ commitment failed: ${id}`));
        }
      } catch (err) {
        console.error(chalk.red(`❌ fail 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments list ──────────────────────────────────────────────────
  cmd
    .command('list')
    .description('약속 목록 조회')
    .option('--bot-id <id>', '특정 봇만')
    .option('--status <status>', '상태 필터 (pending|active|done|failed|expired)')
    .option('--limit <n>', '최대 조회 수', '20')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const conditions: string[] = [];
        const params: (string | number)[] = [];
        let paramIdx = 1;

        if (options.botId) {
          conditions.push(`bot_id = $${paramIdx++}`);
          params.push(options.botId);
        }
        if (options.status) {
          conditions.push(`status = $${paramIdx++}`);
          params.push(options.status);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(parseInt(options.limit));

        const result = await pool.query(
          `SELECT id, bot_id, status, title, description, source_type, source_ref,
                  deadline_at::text, steps,
                  last_heartbeat_at::text, created_at::text, completed_at::text, metadata
           FROM semo.bot_commitments
           ${where}
           ORDER BY created_at DESC
           LIMIT $${paramIdx}`,
          params,
        );

        if (options.format === 'json') {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n📋 Commitments\n'));
          if (result.rows.length === 0) {
            console.log(chalk.yellow('  약속 없음'));
          } else {
            for (const c of result.rows) {
              const statusColor =
                c.status === 'done'
                  ? chalk.green
                  : c.status === 'failed'
                    ? chalk.red
                    : c.status === 'expired'
                      ? chalk.gray
                      : c.status === 'active'
                        ? chalk.cyan
                        : chalk.yellow;
              const deadline = c.deadline_at
                ? new Date(c.deadline_at).toLocaleString('ko-KR')
                : '-';
              const stepsInfo =
                Array.isArray(c.steps) && c.steps.length > 0
                  ? ` [${c.steps.filter((s: { done: boolean }) => s.done).length}/${c.steps.length}]`
                  : '';
              console.log(
                `  ${statusColor(c.status.padEnd(8))} ` +
                  chalk.white(c.title.slice(0, 40).padEnd(42)) +
                  chalk.gray(`${c.bot_id.padEnd(14)}`) +
                  chalk.gray(`⏰ ${deadline}`) +
                  chalk.cyan(stepsInfo),
              );
              console.log(chalk.gray(`           ${c.id}`));
            }
          }
          console.log();
        }
      } catch (err) {
        console.error(chalk.red(`❌ list 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments claim ──────────────────────────────────────────────────
  cmd
    .command('claim <id>')
    .description('세션이 commitment를 점유 (assigned_session 설정)')
    .requiredOption('--session <key>', '세션 키')
    .option('--owner <name>', '세션 소유자 (예: alice-local, semiclaw-cron-local)')
    .action(async (id, options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        // 이미 다른 세션이 점유 중이면 실패
        const result = await pool.query(
          `UPDATE semo.bot_commitments
           SET assigned_session = $2,
               session_owner = $3,
               status = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
               last_heartbeat_at = NOW(),
               updated_at = NOW()
           WHERE id = $1
             AND status IN ('pending', 'active')
             AND (assigned_session IS NULL OR assigned_session = $2)
           RETURNING id, title, status`,
          [id, options.session, options.owner ?? null],
        );
        if (result.rowCount === 0) {
          console.error(chalk.yellow('⚠ commitment 없거나 이미 다른 세션이 점유 중'));
          process.exit(1);
        } else {
          const row = result.rows[0];
          console.log(chalk.green(`✔ claimed: ${row.id} — ${row.title} (${row.status})`));
          console.log(JSON.stringify({ id: row.id, status: row.status, session: options.session }));
        }
      } catch (err) {
        console.error(chalk.red(`❌ claim 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments release ──────────────────────────────────────────────
  cmd
    .command('release')
    .description('세션 종료 시 미완료 commitment 해제 (assigned_session 초기화)')
    .requiredOption('--session <key>', '세션 키')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const result = await pool.query(
          `UPDATE semo.bot_commitments
           SET assigned_session = NULL,
               session_owner = NULL,
               status = CASE WHEN status = 'active' THEN 'pending' ELSE status END,
               updated_at = NOW()
           WHERE assigned_session = $1
             AND status IN ('pending', 'active')
           RETURNING id, title`,
          [options.session],
        );
        if (result.rowCount === 0) {
          console.log(chalk.gray('ℹ 해제할 commitment 없음'));
        } else {
          for (const row of result.rows) {
            console.log(chalk.green(`✔ released: ${row.id} — ${row.title}`));
          }
        }
      } catch (err) {
        console.error(chalk.red(`❌ release 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments stale ────────────────────────────────────────────────
  cmd
    .command('stale')
    .description('stale commitment 감지 (장기간 상태 변경 없음)')
    .option('--threshold <hours>', 'stale 판단 기준 시간', '24')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const hours = parseInt(options.threshold);
        const result = await pool.query(
          `SELECT id, bot_id, status, title, assigned_session, session_owner,
                  updated_at::text, EXTRACT(EPOCH FROM NOW() - updated_at)/3600 AS hours_stale
           FROM semo.bot_commitments
           WHERE status IN ('pending', 'active')
             AND updated_at < NOW() - INTERVAL '1 hour' * $1
           ORDER BY updated_at ASC`,
          [hours],
        );

        if (options.format === 'json') {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          if (result.rows.length === 0) {
            console.log(chalk.green(`✅ stale commitment 없음 (기준: ${hours}시간)`));
          } else {
            console.log(chalk.yellow.bold(`\n⏰ Stale Commitments (${hours}h+)\n`));
            for (const c of result.rows) {
              console.log(
                `  ${chalk.red(Math.round(c.hours_stale) + 'h')} ` +
                  chalk.white(c.title.slice(0, 40).padEnd(42)) +
                  chalk.gray(c.bot_id.padEnd(14)) +
                  chalk.gray(c.session_owner ?? 'no-owner'),
              );
            }
            console.log();
          }
        }
      } catch (err) {
        console.error(chalk.red(`❌ stale 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments watch ─────────────────────────────────────────────────
  cmd
    .command('watch')
    .description('워치독 — 활성 약속의 health 상태 조회')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .option('--bot-id <id>', '특정 봇만 필터')
    .option('--exclude-bot <id>', '특정 봇 제외')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const conditions: string[] = [];
        const params: string[] = [];
        let paramIdx = 1;

        if (options.botId) {
          conditions.push(`bot_id = $${paramIdx++}`);
          params.push(options.botId);
        }
        if (options.excludeBot) {
          conditions.push(`bot_id != $${paramIdx++}`);
          params.push(options.excludeBot);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await pool.query(
          `SELECT id, bot_id, status, title, description, source_type, source_ref,
                  deadline_at::text,
                  health, minutes_since_heartbeat, minutes_overdue,
                  steps, last_heartbeat_at::text, created_at::text, metadata
           FROM semo.v_active_commitments
           ${whereClause}
           ORDER BY
             CASE health
               WHEN 'overdue' THEN 0
               WHEN 'stale' THEN 1
               ELSE 2
             END,
             deadline_at ASC NULLS LAST`,
          params,
        );

        if (options.format === 'json') {
          const summary = {
            total: result.rows.length,
            overdue: result.rows.filter((r: { health: string }) => r.health === 'overdue').length,
            stale: result.rows.filter((r: { health: string }) => r.health === 'stale').length,
            on_track: result.rows.filter((r: { health: string }) => r.health === 'on-track').length,
            commitments: result.rows,
          };
          console.log(JSON.stringify(summary, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n🔍 Commitment Watchdog\n'));
          if (result.rows.length === 0) {
            console.log(chalk.green('  ✅ 활성 약속 없음 — all clear'));
          } else {
            for (const c of result.rows) {
              const healthColor =
                c.health === 'overdue'
                  ? chalk.red.bold
                  : c.health === 'stale'
                    ? chalk.yellow
                    : chalk.green;
              const overdue =
                c.minutes_overdue != null && c.minutes_overdue > 0
                  ? ` (${Math.round(c.minutes_overdue)}분 초과)`
                  : '';
              console.log(
                `  ${healthColor(c.health.padEnd(10))} ` +
                  chalk.white(c.title.slice(0, 35).padEnd(37)) +
                  chalk.gray(c.bot_id.padEnd(14)) +
                  chalk.gray(`hb: ${Math.round(c.minutes_since_heartbeat)}분 전`) +
                  chalk.red(overdue),
              );
            }
            const overdue = result.rows.filter(
              (r: { health: string }) => r.health === 'overdue',
            ).length;
            const stale = result.rows.filter(
              (r: { health: string }) => r.health === 'stale',
            ).length;
            console.log();
            if (overdue > 0) console.log(chalk.red.bold(`  ⚠ ${overdue}건 overdue`));
            if (stale > 0) console.log(chalk.yellow(`  ⏳ ${stale}건 stale`));
          }
          console.log();
        }
      } catch (err) {
        console.error(chalk.red(`❌ watch 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo commitments summary ──────────────────────────────────────────────
  // session_owner 기준으로 local vs agent-sdk 분포를 보여준다.
  // 로컬 훅이 제대로 돌고 있는지 한눈에 확인하는 용도.
  cmd
    .command('summary')
    .description('환경별(local/agent-sdk) commitment 분포 요약')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const result = await pool.query<{
          session_owner: string | null;
          status: string;
          count: string;
          oldest_active_hours: string | null;
        }>(
          `SELECT
             COALESCE(session_owner, '(none)') AS session_owner,
             status,
             COUNT(*)::text AS count,
             ROUND(
               EXTRACT(EPOCH FROM NOW() - MIN(created_at) FILTER (WHERE status IN ('pending','active')))/3600,
               1
             )::text AS oldest_active_hours
           FROM semo.bot_commitments
           WHERE created_at > NOW() - INTERVAL '7 days'
           GROUP BY session_owner, status
           ORDER BY session_owner, status`,
        );

        if (options.format === 'json') {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          if (result.rows.length === 0) {
            console.log(chalk.gray('(지난 7일 간 commitment 없음)'));
          } else {
            console.log(chalk.bold('\n📊 Commitment Summary (최근 7일)\n'));
            let currentOwner = '';
            for (const row of result.rows) {
              if (row.session_owner !== currentOwner) {
                currentOwner = row.session_owner || '(none)';
                console.log(chalk.cyan.bold(`  ${currentOwner}`));
              }
              const statusColor =
                row.status === 'done'
                  ? chalk.green
                  : row.status === 'failed'
                    ? chalk.red
                    : chalk.yellow;
              const suffix = row.oldest_active_hours
                ? chalk.gray(`  (oldest active: ${row.oldest_active_hours}h)`)
                : '';
              console.log(
                `    ${statusColor(row.status.padEnd(8))} ${row.count.padStart(4)}${suffix}`,
              );
            }
            console.log();
          }
        }
      } catch (err) {
        console.error(chalk.red(`❌ summary 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
