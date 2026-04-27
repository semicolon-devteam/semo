/**
 * semo init — 신규 설치를 위한 config.toml + 레이아웃 생성 위저드
 *
 * 역할:
 *   1. 프로파일 선택 (team / personal-discord / personal-offline / solo-connected / custom)
 *   2. `~/.semo/config.toml` 생성 (schema_version 포함)
 *   3. `ensureSemoLayout()` 으로 kernel/tenant/merged 디렉터리 확보
 *   4. 다음 단계 안내 (메신저 credential, LLM 키 등)
 *
 * 설계:
 *   - `--profile <name>` 으로 비대화형 실행 가능. CI/스크립트 용.
 *   - 기존 config 있으면 `--force` 없이 덮어쓰지 않음.
 *   - Personal 기본 = Discord 메신저 + SQLite KB + Ollama 실행 타깃 (플랜 P1.6).
 */
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import { stringify as tomlStringify } from 'smol-toml';
import { ensureSemoLayout } from '../paths.js';
import {
  CURRENT_CONFIG_SCHEMA_VERSION,
  type KbConfig,
  type OpsConfig,
  type MessagingConfig,
  type ExecutionConfig,
  type NetworkConfig,
  type EmbeddingConfig,
} from '../config/types.js';

export type InitProfile =
  | 'team'
  | 'personal-discord'
  | 'personal-offline'
  | 'solo-connected'
  | 'custom';

export interface InitConfigShape {
  schema_version: string;
  profile: string;
  kb: KbConfig;
  ops: OpsConfig;
  messaging: MessagingConfig;
  execution: ExecutionConfig;
  network: NetworkConfig;
  embedding?: EmbeddingConfig;
}

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.semo', 'config.toml');

export function defaultConfigPath(): string {
  return process.env.SEMO_CONFIG_PATH ?? DEFAULT_CONFIG_PATH;
}

export function buildConfigForProfile(profile: InitProfile): InitConfigShape {
  switch (profile) {
    case 'team':
      return {
        schema_version: CURRENT_CONFIG_SCHEMA_VERSION,
        profile: 'team',
        kb: { driver: 'postgres' },
        ops: { driver: 'postgres' },
        messaging: { sources: ['slack', 'discord'] },
        execution: { target: 'claude-code', seat_strategy: 'pool' },
        network: { mode: 'lan' },
      };
    case 'personal-discord':
      return {
        schema_version: CURRENT_CONFIG_SCHEMA_VERSION,
        profile: 'solo-offline',
        kb: { driver: 'sqlite', sqlite_path: '~/.semo/kb.db' },
        ops: { driver: 'sqlite', sqlite_path: '~/.semo/ops.db' },
        messaging: { sources: ['discord'] },
        execution: {
          target: 'ollama',
          model: 'qwen2.5-coder:14b',
          ollama_host: 'http://127.0.0.1:11434',
        },
        network: { mode: 'offline', listen: '127.0.0.1:3939' },
        embedding: { provider: 'ollama', model: 'nomic-embed-text', dim: 768 },
      };
    case 'personal-offline':
      return {
        schema_version: CURRENT_CONFIG_SCHEMA_VERSION,
        profile: 'solo-offline',
        kb: { driver: 'sqlite', sqlite_path: '~/.semo/kb.db' },
        ops: { driver: 'sqlite', sqlite_path: '~/.semo/ops.db' },
        messaging: { sources: ['stdin'] },
        execution: { target: 'ollama', model: 'qwen2.5-coder:14b' },
        network: { mode: 'offline', listen: '127.0.0.1:3939' },
        embedding: { provider: 'ollama', model: 'nomic-embed-text', dim: 768 },
      };
    case 'solo-connected':
      return {
        schema_version: CURRENT_CONFIG_SCHEMA_VERSION,
        profile: 'solo-connected',
        kb: { driver: 'sqlite', sqlite_path: '~/.semo/kb.db' },
        ops: { driver: 'sqlite', sqlite_path: '~/.semo/ops.db' },
        messaging: { sources: ['http', 'obsidian-file'] },
        execution: { target: 'anthropic-api', api_key_env: 'ANTHROPIC_API_KEY' },
        network: { mode: 'tailscale', listen: '0.0.0.0:3939' },
      };
    case 'custom':
      return {
        schema_version: CURRENT_CONFIG_SCHEMA_VERSION,
        profile: 'custom',
        kb: { driver: 'sqlite' },
        ops: { driver: 'sqlite' },
        messaging: { sources: ['stdin'] },
        execution: { target: 'ollama' },
        network: { mode: 'offline' },
      };
  }
}

export function renderConfigToml(cfg: InitConfigShape): string {
  const asRecord: Record<string, unknown> = {
    schema_version: cfg.schema_version,
    profile: cfg.profile,
    kb: stripUndefined(cfg.kb as unknown as Record<string, unknown>),
    ops: stripUndefined(cfg.ops as unknown as Record<string, unknown>),
    messaging: { sources: cfg.messaging.sources },
    execution: stripUndefined(cfg.execution as unknown as Record<string, unknown>),
    network: stripUndefined(cfg.network as unknown as Record<string, unknown>),
  };
  if (cfg.embedding) {
    asRecord.embedding = stripUndefined(cfg.embedding as unknown as Record<string, unknown>);
  }
  return tomlStringify(asRecord) + '\n';
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

interface WriteResult {
  path: string;
  written: boolean;
  skipped?: string;
}

export function writeConfig(
  target: string,
  cfg: InitConfigShape,
  opts: { force?: boolean },
): WriteResult {
  if (fs.existsSync(target) && !opts.force) {
    return { path: target, written: false, skipped: '파일 이미 존재 — --force 로 덮어쓸 수 있음' };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderConfigToml(cfg));
  return { path: target, written: true };
}

async function promptProfile(): Promise<InitProfile> {
  const { profile } = await inquirer.prompt<{ profile: InitProfile }>([
    {
      type: 'list',
      name: 'profile',
      message: 'SEMO 프로파일을 선택하세요',
      default: 'personal-discord',
      choices: [
        {
          name: 'personal-discord — SQLite + Ollama + Discord 봇 (개인용 기본값)',
          value: 'personal-discord',
        },
        {
          name: 'personal-offline — SQLite + Ollama + stdin (완전 오프라인)',
          value: 'personal-offline',
        },
        { name: 'solo-connected  — SQLite + Anthropic API + Tailscale', value: 'solo-connected' },
        { name: 'team            — PostgreSQL + Slack/Discord + Claude Code', value: 'team' },
        { name: 'custom          — 빈 스켈레톤 (수동 편집)', value: 'custom' },
      ],
    },
  ]);
  return profile;
}

function printNextSteps(cfg: InitConfigShape): void {
  console.log();
  console.log(chalk.bold('다음 단계'));
  if (cfg.execution.target === 'ollama') {
    console.log(`  • Ollama 설치/실행: ${chalk.cyan('brew install ollama && ollama serve')}`);
    if (cfg.execution.model) {
      console.log(`  • 모델 받기: ${chalk.cyan(`ollama pull ${cfg.execution.model}`)}`);
    }
  }
  if (cfg.execution.target === 'anthropic-api' && cfg.execution.api_key_env) {
    console.log(`  • ${chalk.cyan(cfg.execution.api_key_env)} 환경변수 설정 필요`);
  }
  if (cfg.messaging.sources.includes('discord')) {
    console.log(`  • Discord 봇 토큰 설정: ${chalk.cyan("export DISCORD_TOKEN='...'")}`);
    console.log(`  • Router 기동: ${chalk.cyan('semo router start --platform discord')}`);
  }
  if (cfg.messaging.sources.includes('slack')) {
    console.log(`  • Slack 봇 토큰 설정: ${chalk.cyan("export SLACK_BOT_TOKEN='...'")}`);
    console.log(chalk.gray('    (Slack router 는 OSS 1차 미지원, P6.1 예정)'));
  }
  if (cfg.kb.driver === 'sqlite') {
    console.log(`  • KB 스키마 적용: ${chalk.cyan('semo migrate-sqlite')}`);
  }
  console.log(`  • 레이아웃 확인: ${chalk.cyan('semo update --status')}`);
  console.log(`  • 설정 확인: ${chalk.cyan('semo config show')}`);
  console.log();
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('config.toml + 3-layer 레이아웃 초기화 위저드')
    .option(
      '--profile <name>',
      'team | personal-discord | personal-offline | solo-connected | custom (비대화형)',
    )
    .option('--path <file>', 'config.toml 출력 경로', defaultConfigPath())
    .option('--force', '기존 config 덮어쓰기')
    .option('--dry-run', '실제 쓰기 없이 생성될 내용만 출력')
    .action(async (opts: { profile?: string; path: string; force?: boolean; dryRun?: boolean }) => {
      const valid: InitProfile[] = [
        'team',
        'personal-discord',
        'personal-offline',
        'solo-connected',
        'custom',
      ];
      let profile: InitProfile;
      if (opts.profile) {
        if (!valid.includes(opts.profile as InitProfile)) {
          console.error(chalk.red(`✗ 알 수 없는 프로파일: ${opts.profile}`));
          console.error(chalk.gray(`  지원: ${valid.join(', ')}`));
          process.exit(2);
        }
        profile = opts.profile as InitProfile;
      } else {
        profile = await promptProfile();
      }

      const cfg = buildConfigForProfile(profile);

      if (opts.dryRun) {
        console.log(chalk.gray(`# ${opts.path}`));
        console.log(renderConfigToml(cfg));
        return;
      }

      const res = writeConfig(opts.path, cfg, { force: opts.force });
      if (!res.written) {
        console.error(chalk.yellow(`⚠ ${res.path} — ${res.skipped}`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ config 생성: ${res.path}`));

      const { created } = ensureSemoLayout();
      if (created.length > 0) {
        console.log(chalk.cyan(`레이아웃 생성: ${created.length}개 디렉터리`));
        for (const d of created) console.log(`  + ${d}`);
      } else {
        console.log(chalk.gray('레이아웃 이미 존재'));
      }

      printNextSteps(cfg);
    });
}

export const __testables = { buildConfigForProfile, renderConfigToml, writeConfig };
