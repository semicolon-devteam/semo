/**
 * semo agent-factory — 포터블 봇 CRUD.
 *
 * Team(PG)은 기존 `semo bots factory` 가 계속 담당한다(PG schema/view 의존).
 * Solo(SQLite) 에서는 이 명령을 통해 KbStore + OperationalStore 만으로 봇을 CRUD.
 *
 * 저장 구조 (KbStore):
 *   - `{botId}` / `identity` — role, emoji, slack-username (frontmatter)
 *   - `{botId}` / `delegation/{toBotId}` — 위임 설정 (JSON in content)
 *   - `{botId}` / `status` — active/retired/online + timestamp
 *   - `{botId}` / `template` — 템플릿 봇 ID (있으면)
 *
 * 시트는 OperationalStore.allocateSeat 이 담당.
 *
 * 하위 명령:
 *   create --id <botId> --role <role> [--template <botId>] [--delegations <json>]
 *   delete --id <botId> [--force]
 *   show   --id <botId>
 *   list
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { loadProfile } from '../config';
import { openStores, type StoreHandle } from '../config/store-factory.js';
import type { KbStore } from '@team-semicolon/semo-kb-core';

interface Delegation {
  to_bot_id: string;
  domains: string[];
  delegation_type?: string;
  method?: string;
  priority?: number;
}

export interface CreateInput {
  botId: string;
  role: string;
  templateBotId?: string;
  delegations: Delegation[];
  kbDomains: string[];
  slackUsername?: string;
  slackIconEmoji?: string;
  dryRun: boolean;
}

const TEMPLATE_SEED_KEYS = [
  'identity',
  'delegation',
  'model-config',
  'status',
  'slack-profile',
  'cron-schedule',
  'tools',
  'skills',
  'kb-access',
];

async function copyTemplateSeeds(
  kb: KbStore,
  templateBotId: string,
  newBotId: string,
): Promise<number> {
  let copied = 0;
  for (const key of TEMPLATE_SEED_KEYS) {
    const source = await kb.get(templateBotId, key);
    if (!source) continue;
    await kb.upsert({
      domain: newBotId,
      key,
      content: source.content,
      metadata: { ...(source.metadata ?? {}), copied_from: templateBotId },
      createdBy: 'agent-factory',
    });
    copied += 1;
  }
  return copied;
}

export async function createBot(stores: StoreHandle, input: CreateInput): Promise<void> {
  if (input.dryRun) {
    console.log(chalk.yellow('🧪 DRY-RUN — 다음 작업을 수행 예정:'));
    console.log(JSON.stringify(input, null, 2));
    return;
  }

  const existing = await stores.kb.get(input.botId, 'identity');
  if (existing) {
    throw new Error(`봇 "${input.botId}" 이미 존재. show 로 상태 확인 후 retire/delete.`);
  }

  const seat = await stores.ops.allocateSeat(input.botId);
  if (!seat) {
    throw new Error('가용 seat 없음. `semo seats add` 로 시트 확보 또는 retire.');
  }

  await stores.kb.upsert({
    domain: input.botId,
    key: 'identity',
    content: JSON.stringify(
      {
        role: input.role,
        slack_username: input.slackUsername ?? input.botId,
        slack_icon: input.slackIconEmoji ?? ':robot_face:',
        kb_domains: input.kbDomains,
      },
      null,
      2,
    ),
    metadata: {
      seat_id: seat.id,
      seat_key: seat.seatKey,
      template_bot_id: input.templateBotId ?? null,
    },
    createdBy: 'agent-factory',
  });

  await stores.kb.upsert({
    domain: input.botId,
    key: 'status',
    content: 'online',
    metadata: { transitioned_at: new Date().toISOString() },
    createdBy: 'agent-factory',
  });

  for (const d of input.delegations) {
    await stores.kb.upsert({
      domain: input.botId,
      key: 'delegation',
      subKey: d.to_bot_id,
      content: JSON.stringify(
        {
          delegation_type: d.delegation_type ?? 'routing',
          domains: d.domains,
          method: d.method ?? 'slack',
          priority: d.priority ?? 100,
        },
        null,
        2,
      ),
      createdBy: 'agent-factory',
    });
  }

  let copied = 0;
  if (input.templateBotId) {
    copied = await copyTemplateSeeds(stores.kb, input.templateBotId, input.botId);
  }

  console.log(
    chalk.green(
      `✓ 봇 "${input.botId}" 생성 완료 — seat=${seat.id}${copied > 0 ? ` (template 시드 ${copied}건)` : ''}`,
    ),
  );
}

async function deleteBot(stores: StoreHandle, botId: string, force: boolean): Promise<void> {
  const identity = await stores.kb.get(botId, 'identity');
  if (!identity) throw new Error(`봇 "${botId}" 없음`);

  if (force) {
    const seatId = identity.metadata?.seat_id;
    if (typeof seatId === 'string') {
      await stores.ops.releaseSeat(seatId).catch(() => undefined);
    }
    await stores.kb.delete({ domain: botId, key: 'identity' });
    await stores.kb.delete({ domain: botId, key: 'status' });
    for (const k of TEMPLATE_SEED_KEYS) {
      if (k === 'identity' || k === 'status') continue;
      await stores.kb.delete({ domain: botId, key: k }).catch(() => undefined);
    }
    console.log(chalk.yellow(`⚠ 봇 "${botId}" 강제 삭제 (cascade).`));
  } else {
    await stores.kb.upsert({
      domain: botId,
      key: 'status',
      content: 'retired',
      metadata: { transitioned_at: new Date().toISOString() },
      createdBy: 'agent-factory',
    });
    const seatId = identity.metadata?.seat_id;
    if (typeof seatId === 'string') {
      await stores.ops.releaseSeat(seatId).catch(() => undefined);
    }
    console.log(chalk.green(`✓ 봇 "${botId}" retire 완료 (seat 해제).`));
  }
}

async function showBot(stores: StoreHandle, botId: string): Promise<void> {
  const identity = await stores.kb.get(botId, 'identity');
  if (!identity) {
    console.log(chalk.yellow(`봇 "${botId}" 없음`));
    process.exitCode = 2;
    return;
  }
  const status = await stores.kb.get(botId, 'status');
  const delegations = await stores.kb.search('', {
    topK: 50,
    domain: botId,
  });

  console.log(chalk.cyan.bold(`\nBot: ${botId}\n`));
  console.log(chalk.white('identity:'));
  console.log(identity.content);
  console.log(chalk.gray(`  metadata: ${JSON.stringify(identity.metadata ?? {})}`));
  console.log(chalk.white(`\nstatus: ${status?.content ?? 'unknown'}`));

  const delegationEntries = delegations.filter((e) => e.key === 'delegation');
  if (delegationEntries.length > 0) {
    console.log(chalk.white('\nDelegations:'));
    for (const d of delegationEntries) {
      console.log(chalk.gray(`  → ${d.subKey}: ${d.content.replace(/\s+/g, ' ').slice(0, 80)}`));
    }
  }
}

export function registerAgentFactoryCommands(program: Command): void {
  const cmd = program
    .command('agent-factory')
    .description('포터블 봇 CRUD (KbStore + OperationalStore, Solo/Team 양쪽 동작)');

  cmd
    .command('create')
    .description('신규 봇 생성')
    .requiredOption('--id <botId>', '봇 ID (불변)')
    .requiredOption('--role <role>', '역할')
    .option('--template <botId>', '복사 베이스')
    .option('--delegations <json>', 'JSON 배열', '[]')
    .option('--kb-domains <csv>', '쉼표구분', 'semicolon')
    .option('--slack-username <name>', 'Slack 표시명')
    .option('--slack-icon <emoji>', 'Slack 아이콘')
    .option('--dry-run', '계획만 출력')
    .action(async (options) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        const input: CreateInput = {
          botId: options.id,
          role: options.role,
          templateBotId: options.template,
          delegations: JSON.parse(options.delegations),
          kbDomains: options.kbDomains.split(',').map((s: string) => s.trim()),
          slackUsername: options.slackUsername,
          slackIconEmoji: options.slackIcon,
          dryRun: !!options.dryRun,
        };
        await createBot(stores, input);
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('delete')
    .description('봇 삭제 (기본 retire; --force 로 완전 삭제)')
    .requiredOption('--id <botId>', '봇 ID')
    .option('--force', 'cascade 삭제')
    .action(async (options) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        await deleteBot(stores, options.id, !!options.force);
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('show')
    .description('봇 상태 + delegation 조회')
    .requiredOption('--id <botId>', '봇 ID')
    .action(async (options) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        await showBot(stores, options.id);
      } finally {
        await stores.close();
      }
    });
}
