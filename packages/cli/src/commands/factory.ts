/**
 * semo factory — 자연어 → 구조화된 factory action 매핑 + 실행.
 *
 *   - `semo factory plan "<message>"`  rule-parser 결과를 JSON 또는 human 포맷으로 출력 (dry-run)
 *   - `semo factory parse <message>`   동일하되 항상 JSON only (agent 연동용)
 *   - `semo factory apply "<message>"` 파싱 + 실행. 기본은 확인 프롬프트, `--yes` 로 자동 승인.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import type { FactoryAction } from '@team-semicolon/semo-common';
import { loadProfile } from '../config/index.js';
import { openStores } from '../config/store-factory.js';
import { createBot, type CreateInput } from './agent-factory.js';

async function loadCommon() {
  try {
    return await import('@team-semicolon/semo-common');
  } catch (err) {
    console.error(chalk.red('✗ @team-semicolon/semo-common 로드 실패 — optional 의존성입니다.'));
    console.error(chalk.gray('  설치: npm i -g @team-semicolon/semo-common'));
    console.error(chalk.gray(`  상세: ${(err as Error).message}`));
    process.exit(1);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function formatAction(a: FactoryAction): string {
  switch (a.kind) {
    case 'bot.create':
      return [
        chalk.bold.cyan('[bot.create]'),
        `  botId    : ${a.botId}`,
        `  role     : ${a.role}`,
        `  template : ${a.template ?? '<none>'}`,
        a.kbDomains?.length ? `  kb       : ${a.kbDomains.join(', ')}` : '',
        chalk.gray(`  source   : ${truncate(a.sourceText, 120)}`),
        '',
        chalk.gray('실행 예:'),
        `  semo agent-factory create --id ${a.botId} --role "${a.role}" --template ${a.template ?? 'semiclaw'}`,
      ]
        .filter(Boolean)
        .join('\n');

    case 'bot.list':
      return [
        chalk.bold.cyan('[bot.list]'),
        chalk.gray(`  source: ${truncate(a.sourceText, 120)}`),
        '',
        chalk.gray('실행 예:'),
        `  semo bots list`,
      ].join('\n');

    case 'kb.upsert':
      return [
        chalk.bold.cyan('[kb.upsert]'),
        `  domain : ${a.domain}`,
        `  key    : ${a.key}${a.subKey ? `/${a.subKey}` : ''}`,
        `  content: ${truncate(a.content, 80)}`,
        chalk.gray(`  source : ${truncate(a.sourceText, 120)}`),
        '',
        chalk.gray('실행 예:'),
        `  semo kb upsert ${a.domain} ${a.key}${a.subKey ? ` ${a.subKey}` : ''} --content "${a.content.replace(/"/g, '\\"')}"`,
      ].join('\n');

    case 'kb.search':
      return [
        chalk.bold.cyan('[kb.search]'),
        `  query : ${a.query}`,
        chalk.gray(`  source: ${truncate(a.sourceText, 120)}`),
        '',
        chalk.gray('실행 예:'),
        `  semo kb search "${a.query}"`,
      ].join('\n');

    case 'ontology.list':
      return [
        chalk.bold.cyan('[ontology.list]'),
        chalk.gray(`  source: ${truncate(a.sourceText, 120)}`),
        '',
        chalk.gray('실행 예:'),
        `  semo kb ontology --action instances`,
      ].join('\n');

    case 'needs-clarification':
      return [
        chalk.bold.yellow('[needs-clarification]'),
        `  reason: ${a.reason}`,
        `  ask   : ${a.prompt}`,
        chalk.gray(`  source: ${truncate(a.sourceText, 120)}`),
      ].join('\n');

    case 'unknown':
    default:
      return [
        chalk.bold.red('[unknown]'),
        `  reason: ${a.reason}`,
        chalk.gray(`  source: ${truncate(a.sourceText, 120)}`),
      ].join('\n');
  }
}

async function confirm(question: string): Promise<boolean> {
  const { createInterface } = await import('readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = await new Promise<string>((resolve) => {
      rl.question(`${question} (y/N) `, resolve);
    });
    return ans.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function applyBotCreate(
  action: Extract<FactoryAction, { kind: 'bot.create' }>,
): Promise<void> {
  const { defaultTemplateCatalog } = await loadCommon();
  const template = action.template ? defaultTemplateCatalog.get(action.template) : null;
  const resolvedRole = action.role || template?.role || action.template || 'general';
  const kbDomains = action.kbDomains?.length
    ? action.kbDomains
    : template?.kbDomains?.length
      ? [...template.kbDomains]
      : ['inbox', 'me'];

  const input: CreateInput = {
    botId: action.botId,
    role: resolvedRole,
    templateBotId: action.template,
    delegations: [],
    kbDomains,
    slackIconEmoji: template?.slackIcon,
    dryRun: false,
  };

  const cfg = loadProfile();
  const stores = await openStores(cfg);
  try {
    await createBot(stores, input);
  } finally {
    await stores.close();
  }
}

async function applyKbUpsert(action: Extract<FactoryAction, { kind: 'kb.upsert' }>): Promise<void> {
  const cfg = loadProfile();
  const stores = await openStores(cfg);
  try {
    await stores.kb.upsert({
      domain: action.domain,
      key: action.key,
      subKey: action.subKey,
      content: action.content,
      metadata: { source: 'factory-apply', source_text: action.sourceText },
      createdBy: 'factory',
    });
    console.log(
      chalk.green(
        `✔ KB upsert: ${action.domain}/${action.key}${action.subKey ? `/${action.subKey}` : ''}`,
      ),
    );
  } finally {
    await stores.close();
  }
}

async function applyKbSearch(action: Extract<FactoryAction, { kind: 'kb.search' }>): Promise<void> {
  const cfg = loadProfile();
  const stores = await openStores(cfg);
  try {
    const hits = await stores.kb.search(action.query, { topK: 5 });
    if (hits.length === 0) {
      console.log(chalk.gray(`매칭 없음: "${action.query}"`));
      return;
    }
    console.log(chalk.cyan.bold(`\n🔎 "${action.query}" (${hits.length})\n`));
    for (const h of hits) {
      const pct = typeof h.similarityPct === 'number' ? ` ${h.similarityPct.toFixed(1)}%` : '';
      console.log(
        `  ${chalk.bold(h.domain)}/${h.key}${h.subKey ? `/${h.subKey}` : ''}${chalk.gray(pct)}`,
      );
      console.log(chalk.gray(`    ${truncate(h.content, 100)}`));
    }
  } finally {
    await stores.close();
  }
}

async function applyOntologyList(): Promise<void> {
  const { defaultTemplateCatalog } = await loadCommon();
  const list = defaultTemplateCatalog.list();
  console.log(chalk.cyan.bold(`\n📚 가용 템플릿 (${list.length})\n`));
  for (const t of list) {
    console.log(`  ${chalk.bold.cyan(t.id)} — ${t.name}: ${t.summary}`);
  }
}

async function applyBotList(): Promise<void> {
  const cfg = loadProfile();
  if (cfg.kb.driver !== 'sqlite') {
    console.log(chalk.gray('bot.list 은 현재 SQLite KB 에서만 지원 — `semo bots list` 사용.'));
    return;
  }
  const { default: BetterSqlite } = await import('better-sqlite3');
  const path = await import('node:path');
  const os = await import('node:os');
  const dbPath = cfg.kb.sqlite_path ?? path.join(os.homedir(), '.semo', 'kb.db');
  const db = new BetterSqlite(dbPath);
  try {
    const rows = db
      .prepare(`SELECT DISTINCT domain FROM knowledge_base WHERE key='identity' ORDER BY domain`)
      .all() as Array<{ domain: string }>;
    if (rows.length === 0) {
      console.log(
        chalk.gray('등록된 봇 없음. semo factory apply "기획 봇 하나 만들어줘" 등으로 생성.'),
      );
      return;
    }
    console.log(chalk.cyan.bold(`\n🤖 봇 (${rows.length})\n`));
    for (const r of rows) {
      console.log(`  ${chalk.bold(r.domain)}`);
    }
  } finally {
    db.close();
  }
}

async function applyAction(action: FactoryAction, opts: { yes?: boolean }): Promise<void> {
  console.log(formatAction(action));
  console.log('');

  switch (action.kind) {
    case 'needs-clarification':
    case 'unknown':
      console.log(chalk.yellow('→ 실행 불가. 메시지를 더 구체적으로 주세요.'));
      process.exitCode = 1;
      return;

    case 'bot.list':
      await applyBotList();
      return;

    case 'ontology.list':
      await applyOntologyList();
      return;

    case 'kb.search':
      await applyKbSearch(action);
      return;

    case 'bot.create':
    case 'kb.upsert': {
      const ok = opts.yes ? true : await confirm('위 action 을 실행할까요?');
      if (!ok) {
        console.log(chalk.gray('취소됨.'));
        return;
      }
      if (action.kind === 'bot.create') await applyBotCreate(action);
      else await applyKbUpsert(action);
      return;
    }
  }
}

export function registerFactoryCommand(program: Command): void {
  const cmd = program
    .command('factory')
    .description('자연어 → 구조화된 factory action (bot/KB/ontology)');

  cmd
    .command('plan <message>')
    .description('메시지를 파싱해 제안 action 을 출력 (dry-run)')
    .option('--json', 'JSON 만 출력')
    .action(async (message: string, opts: { json?: boolean }) => {
      const { ruleFactoryIntentParser } = await loadCommon();
      const action = ruleFactoryIntentParser.parse(message);
      if (opts.json) {
        console.log(JSON.stringify(action, null, 2));
      } else {
        console.log(formatAction(action));
      }
    });

  cmd
    .command('parse <message>')
    .description('메시지를 파싱해 JSON 만 출력 (agent 연동용)')
    .action(async (message: string) => {
      const { ruleFactoryIntentParser } = await loadCommon();
      const action = ruleFactoryIntentParser.parse(message);
      console.log(JSON.stringify(action));
    });

  cmd
    .command('apply <message>')
    .description('파싱 후 실행. 기본 확인 프롬프트, --yes 로 자동 승인')
    .option('-y, --yes', '확인 프롬프트 생략')
    .action(async (message: string, opts: { yes?: boolean }) => {
      const { ruleFactoryIntentParser } = await loadCommon();
      const action = ruleFactoryIntentParser.parse(message);
      await applyAction(action, opts);
    });
}

export const __testables = { formatAction, truncate };
