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
import { buildHermesProvisionPlan, ensureHermesProvisioned } from './hermes-provision.js';

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
  hostKind: string;
  templateBotId: string | null;
  delegations: Delegation[];
  kbDomains: string[];
  budgetPerMessage: number | null;
  slackUsername: string | null;
  slackIconEmoji: string | null;
  hermesHome: string | null;
  hermesProfile: string | null;
  hermesBaseProfile: string | null;
  hermesProvider: string | null;
  hermesModel: string | null;
  hermesMaxTurns: number | null;
  hermesRole: string | null;
  hermesToolsets: string | null;
  hermesSkills: string | null;
  noHermesProvision: boolean;
  dryRun: boolean;
}

function sanitizeAlias(alias: string): string {
  const trimmed = alias.trim();
  if (!trimmed) {
    throw new Error('alias는 빈 문자열일 수 없습니다.');
  }
  return trimmed;
}

function sanitizeCanonicalBotId(botId: string): string {
  const trimmed = botId.trim();
  if (!trimmed) {
    throw new Error('canonical_bot_id는 빈 문자열일 수 없습니다.');
  }
  return trimmed;
}

export interface BotRuntimeConfigOptions {
  hostKind?: string | null;
  hermesHome?: string | null;
  hermesProfile?: string | null;
  hermesBaseProfile?: string | null;
  hermesProvider?: string | null;
  hermesModel?: string | null;
  hermesMaxTurns?: number | null;
  hermesRole?: string | null;
  hermesToolsets?: string | null;
  hermesSkills?: string | null;
}

export function requiresClaudeSeatForHostKind(hostKind?: string | null): boolean {
  const normalized = (hostKind ?? 'claude-code').trim().toLowerCase();
  return normalized === '' || normalized === 'claude-code' || normalized === 'claude';
}

export function buildBotRuntimeConfig(options: BotRuntimeConfigOptions): Record<string, unknown> {
  const hostKind = (options.hostKind ?? 'claude-code').trim() || 'claude-code';
  const config: Record<string, unknown> = {
    host_kind: hostKind,
  };

  if (hostKind === 'hermes-cli') {
    config.transport = 'semo-mailbox-only';
    config.gateway_enabled = false;
    if (options.hermesHome) config.hermes_home = options.hermesHome;
    if (options.hermesProfile) config.hermes_profile = options.hermesProfile;
    if (options.hermesBaseProfile) config.hermes_base_profile = options.hermesBaseProfile;
    if (options.hermesProvider) config.hermes_provider = options.hermesProvider;
    if (options.hermesModel) config.hermes_model = options.hermesModel;
    if (options.hermesMaxTurns != null) config.hermes_max_turns = options.hermesMaxTurns;
    if (options.hermesRole) config.hermes_role = options.hermesRole;
    if (options.hermesToolsets) config.hermes_toolsets = options.hermesToolsets;
    if (options.hermesSkills) config.hermes_skills = options.hermesSkills;
  }

  return config;
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

/**
 * 신규 봇 생성 시 KB `{bot_id}/identity`, `delegation`, `status` 시드.
 *
 * 비전(2026-04-29 reus): kb = "어느 봇이 어떤 역할/키워드 처리" 의 sot.
 * agent factory cud 시 자동 동기화 → router 가 kb 보고 의도 매칭 → 사용자가 봇 외울 필요 없음.
 *
 * 입력 데이터 우선:
 *   - identity: slack_username + slack_icon_emoji + role (CreateBotInput)
 *   - delegation: input.delegations 의 domains 를 키워드 풀로 사용
 *     (정교한 키워드는 사후 `semo kb upsert {bot} delegation` 로 보강)
 *   - status: 'online' (createBot 가 bot_status.status='online' 설정 시점과 동일)
 *
 * 트랜잭션 client 위에서 raw SQL INSERT — kbUpsert(pool) 의 검증/임베딩은 후속 sync 에서 갱신.
 * 이유: createBot 는 단일 트랜잭션. kbUpsert 는 자체 connect 로 별 트랜잭션이라 이 트랜잭션과 분리됨.
 */
/**
 * 봇 KB 시드 entry 5종의 (key, content) 계산 — seedBotKbEntries / rebuildBotKbEmbeddings 가 공유.
 * 한 곳에서 계산해야 raw SQL seed 와 kbUpsert (임베딩 생성) 가 동일 content 사용 보장.
 */
function computeBotKbSeedEntries(input: CreateBotInput): Array<{ key: string; content: string }> {
  const runtimeConfig = buildBotRuntimeConfig(input);
  const identityContent = [
    `name: ${input.slackUsername ?? input.botId}`,
    `emoji: ${input.slackIconEmoji ?? ':robot_face:'}`,
    `role: ${input.role}`,
    `agent_type: specialist`,
    `host_kind: ${input.hostKind}`,
  ].join('\n');

  // delegation 키워드 풀 (input.delegations 의 domains 합집합 — 1차 시드, 사후 보강 권장)
  const keywordPool = Array.from(
    new Set(input.delegations.flatMap((d) => d.domains).filter(Boolean)),
  );
  const delegationContent = [
    '## 수신 키워드',
    ...(keywordPool.length > 0 ? keywordPool.map((k) => `- ${k}`) : ['- (TODO: 키워드 백필 필요)']),
    '',
    '## 에스컬레이션',
    `- 담당 밖 요청 → escalate("semiclaw", reason, context)`,
  ].join('\n');

  const slackProfileContent = [
    `username: ${input.slackUsername ?? input.botId}`,
    `icon_emoji: ${input.slackIconEmoji ?? ':robot_face:'}`,
    `slack_user_id: ''`,
  ].join('\n');

  return [
    { key: 'identity', content: identityContent },
    { key: 'delegation', content: delegationContent },
    { key: 'model-config', content: JSON.stringify(runtimeConfig, null, 2) },
    { key: 'status', content: 'online' },
    { key: 'slack-profile', content: slackProfileContent },
  ];
}

async function seedBotKbEntries(client: PoolClient, input: CreateBotInput): Promise<void> {
  // 트랜잭션 내 raw SQL — atomic 보장 (createBot 트랜잭션 안에서 INSERT/UPDATE).
  // 임베딩은 누락 (raw SQL 이 자동 생성 안 함). 트랜잭션 commit 후 rebuildBotKbEmbeddings 가 갱신.
  const entries = computeBotKbSeedEntries(input);
  for (const { key, content } of entries) {
    await client.query(
      `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by, version, created_at, updated_at)
       VALUES ($1, $2, '', $3, '{}'::jsonb, 'semo-bots-factory', 1, NOW(), NOW())
       ON CONFLICT (domain, key, sub_key) DO UPDATE SET
         content = EXCLUDED.content,
         updated_at = NOW(),
         version = semo.knowledge_base.version + 1`,
      [input.botId, key, content],
    );
  }
}

/**
 * createBot 트랜잭션 commit 후 호출. seedBotKbEntries 의 4종을 kbUpsert 경로로 다시 upsert
 * → 임베딩 자동 생성 + 스키마 검증.
 *
 * Codex P2(d) 권고: raw SQL seed 는 임베딩 누락 → 별 트랜잭션 kbUpsert 로 보강.
 *   실패 시 bot create 는 성공 (이미 commit), kb seed 는 보상 작업 (다음 bots sync 가 identity 재upsert,
 *   delegation/status/slack-profile 은 명시 호출 필요 — console.warn 으로 사용자에게 알림).
 */
async function rebuildBotKbEmbeddings(pool: Pool, input: CreateBotInput): Promise<void> {
  const { kbUpsert } = await import('../kb.js');
  const entries = computeBotKbSeedEntries(input);
  const failures: string[] = [];
  for (const { key, content } of entries) {
    try {
      const r = await kbUpsert(pool, {
        domain: input.botId,
        key,
        content,
        created_by: 'semo-bots-factory',
      });
      if (!r.success) failures.push(`${key}: ${r.error?.slice(0, 80) ?? 'unknown'}`);
    } catch (err) {
      failures.push(`${key}: ${(err as Error).message.slice(0, 80)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `kbUpsert 부분 실패 ${failures.length}/${entries.length}: ${failures.join(' / ')}`,
    );
  }
}

async function createBot(pool: Pool, input: CreateBotInput): Promise<void> {
  const hermesPlan = buildHermesProvisionPlan({
    botId: input.botId,
    hostKind: input.hostKind,
    hermesHome: input.hermesHome,
    hermesProfile: input.hermesProfile,
    hermesBaseProfile: input.hermesBaseProfile,
    hermesSkills: input.hermesSkills,
    noHermesProvision: input.noHermesProvision,
  });

  if (input.dryRun) {
    console.log(chalk.yellow('🧪 DRY-RUN — 다음 작업을 수행 예정:'));
    console.log(JSON.stringify({ ...input, hermesProvision: hermesPlan }, null, 2));
    return;
  }

  if (hermesPlan.required) {
    const provisioned = await ensureHermesProvisioned(hermesPlan);
    console.log(
      chalk.gray(
        `  → Hermes profile 준비 완료 profile=${provisioned.profile}, created=${provisioned.profileCreated ? 'yes' : 'no'}, skills_synced=${provisioned.skillsSynced.join(',') || 'none'}`,
      ),
    );
    input.hermesHome = hermesPlan.home;
    input.hermesProfile = hermesPlan.profile;
    input.hermesBaseProfile = hermesPlan.baseProfile;
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

    // 2. seat 획득 — Claude Code 계열만 물리 Claude Max seat 필요.
    // Hermes/OpenClaw/Codex/Ollama 등 HostAdapter 계열은 SEMO mailbox/outbox 로 실행되며
    // Claude seat 를 소비하지 않는다.
    const needsSeat = requiresClaudeSeatForHostKind(input.hostKind);
    const seat = needsSeat ? await allocateSeat(client, input.botId) : null;
    if (needsSeat && !seat) {
      throw new Error(
        '사용 가능한 Claude Max seat 없음. `semo seats add` 로 seat를 추가하거나 기존 봇을 retire 하거나, --host-kind hermes-cli 같은 seatless runtime을 지정해주세요.',
      );
    }

    // 3. bot_status insert
    const workspacePath = `~/.semo/workspaces/${input.botId}`;
    const runtimeConfig = buildBotRuntimeConfig(input);
    await client.query(
      `INSERT INTO semo.bot_status (
         bot_id, name, emoji, role, workspace_path, status,
         kb_domains, budget_per_message, slack_username, slack_icon_emoji,
         created_by_bot_id, template_bot_id, runtime_hint, projection_targets
       ) VALUES ($1,$2,$3,$4,$5,'online',$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
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
        [input.hostKind],
        JSON.stringify({ runtime: runtimeConfig }),
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

    // 5.5. KB identity / delegation / status 자동 seed (라우팅 SoT)
    // 비전(2026-04-29): kb 엔트리 = "어느 봇이 어떤 역할" sot. cud 시 자동 동기화.
    // 템플릿이 있으면 복사된 entry 가 이미 있을 수 있으나 input 으로 덮어쓰기 (입력이 정확).
    await seedBotKbEntries(client, input);

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
      chalk.green(
        `✔ 봇 "${input.botId}" 생성 완료 — host=${input.hostKind}${
          seat ? `, seat=${seat.seatId} (${seat.configDir})` : ', seat=not-required'
        }`,
      ),
    );
  });

  // 7. KB 임베딩 갱신 (트랜잭션 commit 후 별 트랜잭션) — Codex P2(d) 권고.
  // 실패해도 bot 자체는 이미 생성됨. 다음 'semo bots sync' 가 identity 임베딩은 재upsert,
  // delegation/status/slack-profile 은 명시 호출 또는 후속 sync 확장 필요.
  try {
    await rebuildBotKbEmbeddings(pool, input);
    console.log(
      chalk.gray(
        '  → KB 임베딩 갱신 완료 (identity/delegation/model-config/status/slack-profile 5종)',
      ),
    );
  } catch (kbErr) {
    console.warn(
      chalk.yellow(
        `  ⚠ KB 임베딩 갱신 실패 (bot 생성은 성공). 보상: 'semo kb upsert ${input.botId} {key} ...' 직접 호출 또는 'semo bots sync'.`,
      ),
    );
    console.warn(chalk.gray(`     상세: ${(kbErr as Error).message}`));
  }

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
      // KB status 동기화 — 라우터가 'retired' 보고 라우팅 제외 가능 (loadActiveBotIds 가 1차 필터)
      await client.query(
        `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by, version, created_at, updated_at)
         VALUES ($1, 'status', '', 'retired', '{}'::jsonb, 'semo-bots-factory', 1, NOW(), NOW())
         ON CONFLICT (domain, key, sub_key) DO UPDATE SET content='retired', updated_at=NOW(),
           version = semo.knowledge_base.version + 1`,
        [botId],
      );
      await releaseSeat(client, botId);
      console.log(chalk.green(`✔ 봇 "${botId}" retire 완료 (seat 해제, KB status=retired).`));
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

async function upsertBotAlias(pool: Pool, alias: string, canonicalBotId: string): Promise<void> {
  const normalizedAlias = sanitizeAlias(alias);
  const normalizedCanonical = sanitizeCanonicalBotId(canonicalBotId);

  const client = await pool.connect();
  try {
    const canonical = await client.query(`SELECT bot_id FROM semo.bot_status WHERE bot_id = $1`, [
      normalizedCanonical,
    ]);
    if (canonical.rows.length === 0) {
      throw new Error(`canonical bot_id="${normalizedCanonical}" 없음`);
    }

    const result = await client.query(
      `INSERT INTO semo.bot_id_aliases (alias, canonical_bot_id, retired_at)
       VALUES ($1, $2, NULL)
       ON CONFLICT (alias) DO UPDATE SET
         canonical_bot_id = EXCLUDED.canonical_bot_id,
         retired_at = NULL`,
      [normalizedAlias, normalizedCanonical],
    );

    if (result.rowCount === 1) {
      console.log(
        chalk.green(`✔ alias "${normalizedAlias}" 생성/갱신: canonical="${normalizedCanonical}"`),
      );
    } else {
      console.log(chalk.yellow(`alias "${normalizedAlias}" 처리: 행 없음(중복/락) 가능성`));
    }
  } finally {
    client.release();
  }
}

async function retireBotAlias(pool: Pool, alias: string): Promise<void> {
  const normalizedAlias = sanitizeAlias(alias);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE semo.bot_id_aliases SET retired_at = NOW() WHERE alias = $1 AND retired_at IS NULL`,
      [normalizedAlias],
    );
    if (result.rowCount === 0) {
      throw new Error(`alias="${normalizedAlias}" 찾지 못했거나 이미 retired 상태입니다.`);
    }
    console.log(chalk.yellow(`✔ alias "${normalizedAlias}" retired`));
  } finally {
    client.release();
  }
}

async function restoreBotAlias(pool: Pool, alias: string): Promise<void> {
  const normalizedAlias = sanitizeAlias(alias);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE semo.bot_id_aliases SET retired_at = NULL WHERE alias = $1`,
      [normalizedAlias],
    );
    if (result.rowCount === 0) {
      throw new Error(`alias="${normalizedAlias}" 없음`);
    }
    console.log(chalk.green(`✔ alias "${normalizedAlias}" restored`));
  } finally {
    client.release();
  }
}

async function listBotAliases(pool: Pool, showRetired = false): Promise<void> {
  const client = await pool.connect();
  try {
    const rows = await client.query(
      `SELECT alias, canonical_bot_id, retired_at, created_at
       FROM semo.bot_id_aliases
       WHERE retired_at ${showRetired ? 'IS NOT NULL' : 'IS NULL'}
       ORDER BY created_at DESC, alias`,
    );
    console.log(JSON.stringify(rows.rows, null, 2));
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
    .option(
      '--host-kind <kind>',
      '실행 host kind (claude-code|hermes-cli|openclaw|codex-cli|ollama-cli|local-worker)',
      'claude-code',
    )
    .option('--template <botId>', '복사할 베이스 봇 (KB 키 시드)')
    .option('--delegations <json>', 'JSON 배열 [{"to_bot_id":"...","domains":["..."]}]', '[]')
    .option('--kb-domains <csv>', 'KB 검색 허용 도메인 (쉼표구분)', 'semicolon')
    .option('--budget <num>', '메시지당 예산 (USD)', '1.0')
    .option('--slack-username <name>', 'Slack 표시명')
    .option('--slack-icon <emoji>', 'Slack 아이콘 (:robot_face: 등)')
    .option('--hermes-home <path>', 'hermes-cli 전용 HERMES_HOME')
    .option('--hermes-profile <profile>', 'hermes-cli 전용 profile')
    .option(
      '--hermes-base-profile <profile>',
      'hermes-cli profile provision 시 clone할 base profile',
    )
    .option('--hermes-provider <provider>', 'hermes-cli 전용 provider')
    .option('--hermes-model <model>', 'hermes-cli 전용 model')
    .option('--hermes-max-turns <num>', 'hermes-cli 전용 max turns')
    .option('--hermes-role <role>', 'hermes-cli 전용 role/persona label')
    .option('--hermes-toolsets <csv>', 'hermes-cli 전용 enabled toolsets CSV')
    .option('--hermes-skills <csv>', 'hermes-cli 전용 skills CSV')
    .option('--no-hermes-provision', 'hermes-cli profile/skill 자동 provision 비활성화')
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
          hostKind: options.hostKind,
          templateBotId: options.template ?? null,
          delegations,
          kbDomains: options.kbDomains
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean),
          budgetPerMessage: options.budget ? parseFloat(options.budget) : null,
          slackUsername: options.slackUsername ?? null,
          slackIconEmoji: options.slackIcon ?? null,
          hermesHome: options.hermesHome ?? null,
          hermesProfile: options.hermesProfile ?? null,
          hermesBaseProfile: options.hermesBaseProfile ?? null,
          hermesProvider: options.hermesProvider ?? null,
          hermesModel: options.hermesModel ?? null,
          hermesMaxTurns: options.hermesMaxTurns ? parseInt(options.hermesMaxTurns, 10) : null,
          hermesRole: options.hermesRole ?? null,
          hermesToolsets: options.hermesToolsets ?? null,
          hermesSkills: options.hermesSkills ?? null,
          noHermesProvision: options.hermesProvision === false,
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

  const aliasCmd = botsCmd.command('alias').description('봇 alias 관리');
  aliasCmd
    .command('set')
    .requiredOption('--alias <alias>', '별칭 (예: @Semi)')
    .requiredOption('--canonical-bot-id <botId>', '실제 bot_id')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      try {
        const pool = getPool();
        await upsertBotAlias(pool, options.alias, options.canonicalBotId);
      } catch (err) {
        console.error(chalk.red(`alias set 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  aliasCmd
    .command('retire')
    .requiredOption('--alias <alias>', 'retire할 별칭')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      try {
        const pool = getPool();
        await retireBotAlias(pool, options.alias);
      } catch (err) {
        console.error(chalk.red(`alias retire 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  aliasCmd
    .command('restore')
    .requiredOption('--alias <alias>', 'restore할 별칭')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      try {
        const pool = getPool();
        await restoreBotAlias(pool, options.alias);
      } catch (err) {
        console.error(chalk.red(`alias restore 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  aliasCmd
    .command('list')
    .option('--retired', 'retired alias만 조회')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('DB 연결 실패'));
        process.exit(1);
      }
      try {
        const pool = getPool();
        await listBotAliases(pool, !!options.retired);
      } catch (err) {
        console.error(chalk.red(`alias list 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
