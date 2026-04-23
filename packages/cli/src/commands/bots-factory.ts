/**
 * semo bots factory — Agent Factory MVP
 *
 * SemoBot이 런타임에 서브 봇을 CRUD하는 엔드포인트.
 *
 * 설계 원칙:
 *   - bot_id는 불변(immutable). 이름 변경은 bot_id_aliases 로 해결.
 *   - 모든 insert는 단일 트랜잭션. 실패 시 seat 누수 방지.
 *   - delete는 기본 soft delete(status='retired'). --force 만 FK cascade.
 *   - seat 획득은 원자 UPDATE ... RETURNING (동시 생성 레이스 방지).
 *
 * 구성:
 *   semo bots create --id <id> --role <role> [--template <base-bot>]
 *                    [--delegations <json>] [--kb-domains <csv>] [--dry-run]
 *   semo bots delete --id <id> [--force]
 *   semo bots show   --id <id>
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { Pool, PoolClient } from 'pg';
import { getPool, closeConnection, isDbConnected } from '../database';

interface Delegation {
  to_bot_id: string;
  domains: string[];
  delegation_type?: string;
  method?: string;
  channel?: string;
  max_roundtrips?: number;
  priority?: number;
}

interface CreateBotInput {
  botId: string;
  role: string;
  templateBotId: string | null;
  delegations: Delegation[];
  kbDomains: string[];
  budgetPerMessage: number | null;
  slackUsername: string | null;
  slackIconEmoji: string | null;
  dryRun: boolean;
}

async function withTransaction<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function allocateSeat(
  client: PoolClient,
  botId: string,
): Promise<{ seatId: string; configDir: string } | null> {
  const result = await client.query(
    `UPDATE semo.bot_seats
     SET current_bot_id = $1, allocated_at = NOW(), status = 'allocated', updated_at = NOW()
     WHERE seat_id = (
       SELECT seat_id FROM semo.bot_seats
       WHERE status = 'available' AND current_bot_id IS NULL
       ORDER BY created_at
       LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING seat_id, claude_config_dir`,
    [botId],
  );
  if (result.rows.length === 0) return null;
  return { seatId: result.rows[0].seat_id, configDir: result.rows[0].claude_config_dir };
}

async function releaseSeat(client: PoolClient, botId: string): Promise<void> {
  await client.query(
    `UPDATE semo.bot_seats
     SET current_bot_id = NULL, allocated_at = NULL, status = 'available', updated_at = NOW()
     WHERE current_bot_id = $1`,
    [botId],
  );
}

async function copyKbFromTemplate(
  client: PoolClient,
  botId: string,
  templateBotId: string,
): Promise<number> {
  const result = await client.query(
    `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by)
     SELECT $1, key, sub_key, content, metadata, 'bots-factory'
     FROM semo.knowledge_base
     WHERE domain = $2
       AND key IN ('identity','delegation','model-config','status','slack-profile','cron-schedule','tools','skills','kb-access')
     ON CONFLICT (domain, key, sub_key) DO NOTHING`,
    [botId, templateBotId],
  );
  return result.rowCount ?? 0;
}

async function createBot(pool: Pool, input: CreateBotInput): Promise<void> {
  if (input.dryRun) {
    console.log(chalk.yellow('🧪 DRY-RUN — 다음 작업을 수행 예정:'));
    console.log(JSON.stringify(input, null, 2));
    return;
  }

  await withTransaction(pool, async (client) => {
    // 1. bot_status 존재 여부 확인
    const existing = await client.query(
      `SELECT bot_id, status FROM semo.bot_status WHERE bot_id = $1 FOR UPDATE`,
      [input.botId],
    );
    if (existing.rows.length > 0) {
      throw new Error(
        `bot_id="${input.botId}" 이미 존재함 (status=${existing.rows[0].status}). 재활성화는 'update --status active' 사용.`,
      );
    }

    // 2. seat 획득 — 실패 시 전체 롤백
    const seat = await allocateSeat(client, input.botId);
    if (!seat) {
      throw new Error(
        '사용 가능한 Claude Max seat 없음. `semo seats add` 로 seat를 추가하거나 기존 봇을 retire 해주세요.',
      );
    }

    // 3. bot_status insert
    const workspacePath = `~/.semo/workspaces/${input.botId}`;
    await client.query(
      `INSERT INTO semo.bot_status (
         bot_id, name, emoji, role, workspace_path, status,
         kb_domains, budget_per_message, slack_username, slack_icon_emoji,
         created_by_bot_id, template_bot_id
       ) VALUES ($1,$2,$3,$4,$5,'online',$6,$7,$8,$9,$10,$11)`,
      [
        input.botId,
        input.slackUsername ?? input.botId,
        input.slackIconEmoji ?? ':robot_face:',
        input.role,
        workspacePath,
        input.kbDomains,
        input.budgetPerMessage,
        input.slackUsername ?? input.botId,
        input.slackIconEmoji ?? ':robot_face:',
        'semobot',
        input.templateBotId,
      ],
    );

    // 4. ontology row
    await client.query(
      `INSERT INTO semo.ontology (domain, entity_type, schema, description)
       VALUES ($1, 'agents', '{}'::jsonb, $2)
       ON CONFLICT (domain) DO NOTHING`,
      [input.botId, `Agent Factory — ${input.role}`],
    );

    // 5. KB 시드 (템플릿이 있으면 복사)
    if (input.templateBotId) {
      const copied = await copyKbFromTemplate(client, input.botId, input.templateBotId);
      console.log(chalk.gray(`  KB 키 ${copied}개 복사 (template=${input.templateBotId})`));
    }

    // 6. bot_delegation inserts
    for (const d of input.delegations) {
      await client.query(
        `INSERT INTO semo.bot_delegation (
           from_bot_id, to_bot_id, delegation_type, domains, method, channel,
           max_roundtrips, priority, is_active
         ) VALUES ('semobot',$1,$2,$3,$4,$5,$6,$7,TRUE)
         ON CONFLICT (from_bot_id, to_bot_id, delegation_type) DO NOTHING`,
        [
          d.to_bot_id === 'self' ? input.botId : d.to_bot_id,
          d.delegation_type ?? 'routing',
          d.domains,
          d.method ?? 'slack',
          d.channel ?? null,
          d.max_roundtrips ?? 3,
          d.priority ?? 100,
        ],
      );
    }

    console.log(
      chalk.green(`✔ 봇 "${input.botId}" 생성 완료 — seat=${seat.seatId} (${seat.configDir})`),
    );
  });

  console.log(chalk.gray('  다음 단계:'));
  console.log(chalk.gray(`    1) semo onboarding -f --bot ${input.botId} --skip-mcp`));
  console.log(chalk.gray(`    2) semo bots audit --fix --bot ${input.botId}`));
  console.log(chalk.gray(`    3) scripts/semo-pane-attach.sh ${input.botId}  (Phase 4)`));
}

async function deleteBot(pool: Pool, botId: string, force: boolean): Promise<void> {
  await withTransaction(pool, async (client) => {
    const row = await client.query(
      `SELECT bot_id, status, created_by_bot_id FROM semo.bot_status WHERE bot_id = $1 FOR UPDATE`,
      [botId],
    );
    if (row.rows.length === 0) {
      throw new Error(`bot_id="${botId}" 없음`);
    }
    if (row.rows[0].created_by_bot_id === '__genesis__' && !force) {
      throw new Error(`"${botId}" 는 Genesis 봇. 삭제하려면 --force 필요.`);
    }

    if (force) {
      // 모든 관련 테이블 cascade 삭제
      await client.query(`DELETE FROM semo.bot_delegation WHERE from_bot_id=$1 OR to_bot_id=$1`, [
        botId,
      ]);
      await client.query(`DELETE FROM semo.knowledge_base WHERE domain=$1`, [botId]);
      await client.query(`DELETE FROM semo.ontology WHERE domain=$1`, [botId]);
      await releaseSeat(client, botId);
      await client.query(`DELETE FROM semo.bot_status WHERE bot_id=$1`, [botId]);
      console.log(chalk.yellow(`⚠ 봇 "${botId}" 강제 삭제 (cascade).`));
    } else {
      // soft delete
      await client.query(
        `UPDATE semo.bot_status SET status='retired', synced_at=NOW() WHERE bot_id=$1`,
        [botId],
      );
      await client.query(
        `UPDATE semo.bot_delegation SET is_active=FALSE WHERE from_bot_id=$1 OR to_bot_id=$1`,
        [botId],
      );
      await releaseSeat(client, botId);
      console.log(chalk.green(`✔ 봇 "${botId}" retire 완료 (seat 해제).`));
    }
  });
}

async function showBot(pool: Pool, botId: string): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM semo.v_bot_factory_status WHERE bot_id = $1`, [
      botId,
    ]);
    if (result.rows.length === 0) {
      const alias = await client.query(
        `SELECT canonical_bot_id FROM semo.bot_id_aliases WHERE alias=$1`,
        [botId],
      );
      if (alias.rows.length > 0) {
        console.log(
          chalk.yellow(
            `"${botId}" 는 alias → canonical="${alias.rows[0].canonical_bot_id}". canonical로 재조회:`,
          ),
        );
        return showBot(pool, alias.rows[0].canonical_bot_id);
      }
      throw new Error(`bot_id="${botId}" 없음`);
    }
    console.log(JSON.stringify(result.rows[0], null, 2));

    const delegations = await client.query(
      `SELECT to_bot_id, delegation_type, domains, priority, is_active
       FROM semo.bot_delegation WHERE from_bot_id = $1 ORDER BY priority`,
      [botId],
    );
    console.log(chalk.cyan('\nDelegations:'));
    console.log(JSON.stringify(delegations.rows, null, 2));
  } finally {
    client.release();
  }
}

export function registerBotsFactoryCommands(botsCmd: Command): void {
  botsCmd
    .command('create')
    .description('신규 서브 봇 생성 (SemoBot Agent Factory)')
    .requiredOption('--id <botId>', '봇 ID (불변)')
    .requiredOption('--role <role>', '역할 (specialist|analyst|reviewer 등)')
    .option('--template <botId>', '복사할 베이스 봇 (KB 키 시드)')
    .option('--delegations <json>', 'JSON 배열 [{"to_bot_id":"...","domains":["..."]}]', '[]')
    .option('--kb-domains <csv>', 'KB 검색 허용 도메인 (쉼표구분)', 'semicolon')
    .option('--budget <num>', '메시지당 예산 (USD)', '1.0')
    .option('--slack-username <name>', 'Slack 표시명')
    .option('--slack-icon <emoji>', 'Slack 아이콘 (:robot_face: 등)')
    .option('--dry-run', '실제 실행 없이 계획만 출력')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      try {
        const pool = getPool();
        const delegations: Delegation[] = JSON.parse(options.delegations);
        const input: CreateBotInput = {
          botId: options.id,
          role: options.role,
          templateBotId: options.template ?? null,
          delegations,
          kbDomains: options.kbDomains
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean),
          budgetPerMessage: options.budget ? parseFloat(options.budget) : null,
          slackUsername: options.slackUsername ?? null,
          slackIconEmoji: options.slackIcon ?? null,
          dryRun: !!options.dryRun,
        };
        await createBot(pool, input);
      } catch (err) {
        console.error(chalk.red(`생성 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  botsCmd
    .command('delete')
    .description('서브 봇 삭제 (기본: soft retire)')
    .requiredOption('--id <botId>', '봇 ID')
    .option('--force', 'Genesis 봇 포함 전체 cascade 삭제', false)
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      try {
        const pool = getPool();
        await deleteBot(pool, options.id, !!options.force);
      } catch (err) {
        console.error(chalk.red(`삭제 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  botsCmd
    .command('show')
    .description('서브 봇 상세 조회 (status + aliases + seat + delegations)')
    .requiredOption('--id <botId>', '봇 ID 또는 alias')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      try {
        const pool = getPool();
        await showBot(pool, options.id);
      } catch (err) {
        console.error(chalk.red(`조회 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
