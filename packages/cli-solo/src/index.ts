#!/usr/bin/env node
/**
 * semo-solo — 개인용 SEMO 바이너리.
 *
 * 완전 오프라인 프로파일: SQLite KbStore + SQLite OperationalStore + MessageSource=stdin/http/obsidian.
 * pg 드라이버 / Slack SDK / Discord SDK 완전히 미포함.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import BetterSqlite from 'better-sqlite3';
import {
  StdinSource,
  HttpSource,
  ObsidianFileSource,
  defaultRegistry,
  type TargetKind,
  type TargetMessage,
  type MessageSource,
  buildAgentSpec,
  renderAgentSpec,
  type AgentSpec,
  type AgentRuntimeProjectionTarget,
} from '@team-semicolon/semo-common/solo';
import { SqliteKbStore, type SqliteEmbeddingProvider } from '@team-semicolon/semo-kb-core';
import { SqliteOperationalStore } from '@team-semicolon/semo-ops-store/sqlite';
import { renderConfigToml, runWizard } from './wizard.js';

// SEMO→semicolony 호환: SEMICOLONY_HOME > SEMO_HOME > ~/.semo (Phase 0 default 불변).
const DEFAULT_CONFIG_DIR =
  process.env.SEMICOLONY_HOME ?? process.env.SEMO_HOME ?? path.join(os.homedir(), '.semo');
const DEFAULT_DB_PATH = path.join(DEFAULT_CONFIG_DIR, 'kb.db');
const DEFAULT_AGENT_ID = 'default-agent';

const program = new Command();
program
  .name('semo-solo')
  .description('SEMO Solo — 오프라인 SQLite 기반 개인 AI 에이전트')
  .version('0.1.0');

/**
 * No-op 임베더 — 빈 벡터를 반환해 `SqliteKbStore` 가 벡터 컬럼을 채우지 않고 FTS 만 쓰게 한다.
 * sqlite-vec 확장이 없거나 임베딩 엔드포인트 미설정 환경(Solo 기본) 에서의 폴백.
 */
const noopEmbedding: SqliteEmbeddingProvider = {
  async embed() {
    return [];
  },
};

function openDb(dbPath: string): BetterSqlite.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return new BetterSqlite(dbPath);
}

function pickMessageSource(
  sourceId: string,
  opts: { vault?: string; port?: number },
): MessageSource {
  switch (sourceId) {
    case 'stdin':
      return new StdinSource({ prompt: chalk.cyan('semo-solo> ') });
    case 'http':
      return new HttpSource({ port: opts.port ?? 3939 });
    case 'obsidian-file':
      if (!opts.vault) throw new Error('--vault <path> 필수 (obsidian-file source)');
      return new ObsidianFileSource({ vaultPath: opts.vault });
    default:
      throw new Error(`지원하지 않는 source: ${sourceId}`);
  }
}

function buildDefaultAgentSpec(): AgentSpec {
  return buildAgentSpec({
    profile: 'personal',
    agent: {
      name: DEFAULT_AGENT_ID,
      displayName: 'SEMO Personal',
      content: `---
name: ${DEFAULT_AGENT_ID}
description: "Personal SEMO default agent"
tools:
  - Read
  - Glob
  - Grep
  - Bash
---
# SEMO Personal Default Agent

You are the single local SEMO Personal agent.

Use local SQLite KB and local files as source of truth. Do not assume Slack, Discord, cmux, Claude Code mailbox, Team bot roster, or Team Agent Factory runtime is available.

When team state is needed but missing locally, say what is missing and ask the user to sync or provide context. Keep external publication opt-in.
`,
      metadata: {
        source: 'semo-solo',
      },
    },
    botStatus: {
      bot_id: DEFAULT_AGENT_ID,
      name: 'SEMO Personal',
      role: 'Personal local SEMO assistant',
      kb_domains: ['personal'],
    },
  });
}

function parseAgentTargets(raw: string): AgentRuntimeProjectionTarget[] {
  const allowed = new Set(['claude-code', 'codex-skill']);
  const targets = raw
    .split(',')
    .map((target) => target.trim())
    .filter(Boolean);
  for (const target of targets) {
    if (!allowed.has(target)) {
      throw new Error(`Personal agent target not supported: ${target}`);
    }
  }
  return targets as AgentRuntimeProjectionTarget[];
}

function writeRenderedArtifacts(
  artifacts: Array<{ path: string; content: string }>,
  dryRun: boolean,
): void {
  for (const artifact of artifacts) {
    if (dryRun) {
      console.log(chalk.gray(`render ${artifact.path}`));
      continue;
    }
    fs.mkdirSync(path.dirname(artifact.path), { recursive: true });
    fs.writeFileSync(artifact.path, artifact.content, 'utf8');
    console.log(chalk.green(`write ${artifact.path}`));
  }
}

// === init: 대화형 위저드 + config.toml + DB 초기화 ===
program
  .command('init')
  .description('대화형 위저드로 ~/.semo/config.toml 생성 + SQLite DB 초기화')
  .option('--db <path>', 'SQLite DB 경로', DEFAULT_DB_PATH)
  .option('-y, --yes', '프롬프트 없이 기본값으로 진행')
  .option('-f, --force', '이미 존재하는 config.toml 을 덮어쓴다')
  .action(async (opts: { db: string; yes?: boolean; force?: boolean }) => {
    if (!fs.existsSync(DEFAULT_CONFIG_DIR)) fs.mkdirSync(DEFAULT_CONFIG_DIR, { recursive: true });
    const cfgPath = path.join(DEFAULT_CONFIG_DIR, 'config.toml');

    if (fs.existsSync(cfgPath) && !opts.force) {
      console.log(chalk.gray(`~ ${cfgPath} 이미 존재 (--force 로 덮어쓰기)`));
    } else {
      const answers = opts.yes
        ? {
            profile: 'solo-offline' as const,
            kbDriver: 'sqlite' as const,
            sqlitePath: opts.db,
            execTarget: 'ollama' as const,
            model: 'qwen2.5-coder:14b',
            endpoint: 'http://127.0.0.1:11434',
            networkMode: 'offline' as const,
            listen: '127.0.0.1:3939',
          }
        : await runWizard({ sqlitePath: opts.db });
      fs.writeFileSync(cfgPath, renderConfigToml(answers), 'utf8');
      console.log(chalk.green(`\n✓ ${cfgPath} 생성됨`));
    }

    const db = openDb(opts.db);
    new SqliteKbStore(db, noopEmbedding);
    new SqliteOperationalStore(db);
    db.close();
    console.log(chalk.green(`✓ SQLite DB 초기화: ${opts.db}`));
    console.log(chalk.cyan(`\n다음:  semo-solo chat\n`));
  });

// === kb: SQLite KB 직접 조작 ===
const kbCmd = program.command('kb').description('SQLite KB CRUD');
kbCmd
  .command('upsert <domain> <key> [subKey]')
  .option('--content <text>', '본문', '')
  .option('--db <path>', 'DB 경로', DEFAULT_DB_PATH)
  .action(
    async (
      domain: string,
      key: string,
      subKey: string | undefined,
      opts: { content: string; db: string },
    ) => {
      const db = openDb(opts.db);
      const store = new SqliteKbStore(db, noopEmbedding);
      await store.upsert({ domain, key, subKey, content: opts.content });
      console.log(chalk.green(`✓ ${domain}/${key}${subKey ? `/${subKey}` : ''} 저장됨`));
    },
  );

kbCmd
  .command('get <domain> <key> [subKey]')
  .option('--db <path>', 'DB 경로', DEFAULT_DB_PATH)
  .action(async (domain: string, key: string, subKey: string | undefined, opts: { db: string }) => {
    const db = openDb(opts.db);
    const store = new SqliteKbStore(db, noopEmbedding);
    const entry = await store.get(domain, key, subKey);
    if (!entry) {
      console.log(chalk.yellow('(없음)'));
      process.exit(1);
    }
    console.log(entry.content);
  });

kbCmd
  .command('search <query>')
  .option('--db <path>', 'DB 경로', DEFAULT_DB_PATH)
  .option('-n, --top <int>', 'top K', '5')
  .action(async (query: string, opts: { db: string; top: string }) => {
    const db = openDb(opts.db);
    const store = new SqliteKbStore(db, noopEmbedding);
    const res = await store.search(query, { topK: parseInt(opts.top, 10) });
    if (!res.length) {
      console.log(chalk.yellow('결과 없음'));
      return;
    }
    for (const r of res) {
      console.log(`${chalk.cyan(`[${r.domain}]`)} ${r.key}${r.subKey ? `/${r.subKey}` : ''}`);
      console.log(`  ${r.content.slice(0, 120)}${r.content.length > 120 ? '…' : ''}`);
    }
  });

// === agents: Personal profile exposes exactly one default-agent ===
const agentsCmd = program.command('agents').description('Personal AgentSpec 조회/렌더링');
agentsCmd
  .command('list')
  .description('Personal default-agent 표시')
  .option('--json', 'JSON 출력')
  .action((opts: { json?: boolean }) => {
    const spec = buildDefaultAgentSpec();
    if (opts.json) {
      console.log(JSON.stringify([spec], null, 2));
      return;
    }
    console.log(`${chalk.cyan(spec.botId)}  ${spec.displayName} — ${spec.role}`);
  });

agentsCmd
  .command('render')
  .description('Personal default-agent artifact 렌더링')
  .option('--targets <csv>', 'claude-code,codex-skill', 'claude-code')
  .option(
    '--session-dir <path>',
    'ClaudeCode session dir',
    path.join(DEFAULT_CONFIG_DIR, 'sessions'),
  )
  .option('--codex-skills-dir <path>', 'Codex skills dir', path.join(DEFAULT_CONFIG_DIR, 'skills'))
  .option('--write', '파일 쓰기')
  .option('--json', 'JSON 출력')
  .action(
    (opts: {
      targets: string;
      sessionDir: string;
      codexSkillsDir: string;
      write?: boolean;
      json?: boolean;
    }) => {
      const spec = buildDefaultAgentSpec();
      const targets = parseAgentTargets(opts.targets);
      const artifacts = renderAgentSpec(spec, targets, {
        profile: 'personal',
        sessionDir: opts.sessionDir,
        codexSkillsDir: opts.codexSkillsDir,
      });
      if (opts.json) {
        console.log(JSON.stringify({ spec, artifacts }, null, 2));
        return;
      }
      writeRenderedArtifacts(artifacts, !opts.write);
    },
  );

// === chat: stdin REPL + ExecutionTarget ===
program
  .command('chat')
  .description('stdin REPL (기본 source)')
  .option('--target <kind>', 'ExecutionTarget kind', 'ollama')
  .option('--model <id>', '모델 ID')
  .option('--endpoint <url>', '엔드포인트')
  .option('--system <text>', '시스템 프롬프트')
  .option('--source <id>', 'MessageSource: stdin | http | obsidian-file', 'stdin')
  .option('--vault <path>', 'Vault 경로 (obsidian-file)')
  .option('--port <n>', 'HTTP 포트', (v) => parseInt(v, 10))
  .action(
    async (opts: {
      target: string;
      model?: string;
      endpoint?: string;
      system?: string;
      source: string;
      vault?: string;
      port?: number;
    }) => {
      const kind = opts.target as TargetKind;
      if (!defaultRegistry.has(kind)) {
        console.error(chalk.red(`등록되지 않은 target: '${kind}'`));
        process.exit(1);
      }
      const target = defaultRegistry.resolve({ kind, model: opts.model, endpoint: opts.endpoint });
      const source = pickMessageSource(opts.source, { vault: opts.vault, port: opts.port });
      const agentSpec = buildDefaultAgentSpec();

      const history: TargetMessage[] = [];
      console.log(
        chalk.bold(`SEMO Solo — agent=${agentSpec.botId}, target=${kind}, source=${source.id}`),
      );
      if (source.id === 'http') {
        const addr = (source as HttpSource).address();
        if (addr) console.log(chalk.gray(`HTTP listening on ${addr.host}:${addr.port}`));
      }

      source.onMessage(async (msg) => {
        if (msg.text === '.exit') {
          await source.stop();
          await target.shutdown();
          process.exit(0);
        }
        history.push({ role: 'user', content: msg.text });
        try {
          const out = await target.dispatch({
            botId: agentSpec.botId,
            sessionKey: `solo-${process.pid}`,
            systemPrompt: opts.system ?? agentSpec.personaPrompt,
            messages: history,
          });
          history.push({ role: 'assistant', content: out.replyText });
          await source.reply({ channel: msg.channel, text: out.replyText, inReplyTo: msg.id });
        } catch (err) {
          await source.reply({
            channel: msg.channel,
            text: `[dispatch error] ${(err as Error).message}`,
            inReplyTo: msg.id,
          });
        }
      });

      await source.start();
    },
  );

// === doctor: 환경 점검 ===
program
  .command('doctor')
  .description('SQLite/ExecutionTarget/MessageSource 상태 점검')
  .option('--db <path>', 'DB 경로', DEFAULT_DB_PATH)
  .option('--target <kind>', 'health check 할 target', 'ollama')
  .action(async (opts: { db: string; target: string }) => {
    console.log(chalk.bold('\nSEMO Solo — doctor'));
    console.log(chalk.gray('─'.repeat(40)));

    // SQLite
    try {
      const db = openDb(opts.db);
      new SqliteKbStore(db, noopEmbedding);
      new SqliteOperationalStore(db);
      console.log(`  ${chalk.green('✓')} SQLite  ${opts.db}`);
      db.close();
    } catch (err) {
      console.log(`  ${chalk.red('✗')} SQLite  ${(err as Error).message}`);
    }

    // ExecutionTarget
    try {
      const target = defaultRegistry.resolve({ kind: opts.target as TargetKind });
      const h = await target.healthCheck();
      console.log(
        h.ok
          ? `  ${chalk.green('✓')} target  ${opts.target}${h.detail ? ` (${h.detail})` : ''}`
          : `  ${chalk.yellow('!')} target  ${opts.target} — ${h.detail}`,
      );
      await target.shutdown();
    } catch (err) {
      console.log(`  ${chalk.red('✗')} target  ${(err as Error).message}`);
    }

    console.log();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(`fatal: ${(err as Error).message}`));
  process.exit(1);
});
