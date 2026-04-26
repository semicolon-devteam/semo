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

async function resolveActionItemId(pool: Pool, input: string): Promise<string> {
  if (UUID_RE.test(input)) return input;
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
        const metadata = opts.metadata ? JSON.parse(opts.metadata) : {};
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
          `SELECT action_item_id, owner_domain, target_domain, description, assignee, deadline, status, priority, created_at
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

        if (sets.length === 0) {
          console.error(chalk.yellow('변경할 항목을 지정하세요'));
          process.exit(1);
        }

        const resolvedId = await resolveActionItemId(pool, id);
        params.push(resolvedId);
        const res = await pool.query(
          `UPDATE semo.action_items SET ${sets.join(', ')} WHERE action_item_id = $${idx} RETURNING action_item_id, status, description`,
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

  // ── semo action-items complete ──
  cmd
    .command('complete <id>')
    .description('액션 아이템 완료 처리')
    .action(async (id) => {
      if (!(await isDbConnected())) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      const pool = getPool();
      try {
        const resolvedId = await resolveActionItemId(pool, id);
        const res = await pool.query(
          `UPDATE semo.action_items SET status = 'completed', completed_at = NOW()
           WHERE action_item_id = $1 RETURNING action_item_id, description`,
          [resolvedId],
        );
        if (res.rows.length === 0) {
          console.error(chalk.red(`아이템 ${id} 없음`));
          process.exit(1);
        }
        console.log(chalk.green(`✅ 완료: ${res.rows[0].description}`));
      } catch (err) {
        console.error(chalk.red('완료 처리 실패:'), err instanceof Error ? err.message : err);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
