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

/**
 * config.toml 출력 위치 결정 — OSS 격리 install 호환 (Codex 리뷰 2026-04-28).
 *
 * 우선순위:
 *   1. SEMO_CONFIG_PATH (full path) — 명시적 override
 *   2. SEMO_HOME/config.toml — OSS 사용자 격리 install (e.g., 빈 머신 smoke)
 *   3. ~/.semo/config.toml — 기본 (사용자 home)
 *
 * --path 옵션은 호출 측이 별도 처리.
 */
export function defaultConfigPath(): string {
  if (process.env.SEMO_CONFIG_PATH) return process.env.SEMO_CONFIG_PATH;
  const semoHome = process.env.SEMO_HOME;
  if (semoHome) return path.join(semoHome, 'config.toml');
  return DEFAULT_CONFIG_PATH;
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

// P1-B (2026-05-28): driver-별 추가 입력. 신규 설치 환경(외부 팀이 SEMO 도입) 에서
// coreDB / Obsidian / SQLite / hybrid 선택을 wizard 한 번에 끝낼 수 있게.
async function promptKbDriverDetails(cfg: InitConfigShape): Promise<InitConfigShape> {
  const driver = cfg.kb.driver;
  if (driver === 'obsidian') {
    const { vault } = await inquirer.prompt<{ vault: string }>([
      {
        type: 'input',
        name: 'vault',
        message: 'Obsidian vault 경로 (절대경로 권장):',
        default: cfg.kb.obsidian_vault ?? path.join(os.homedir(), 'Documents', 'SEMO-Vault'),
        validate: (v: string) => v.trim().length > 0 || 'vault 경로가 비어있습니다',
      },
    ]);
    cfg.kb = { ...cfg.kb, obsidian_vault: vault.trim() };
  }
  if (driver === 'notion') {
    const { token, dbId } = await inquirer.prompt<{ token: string; dbId: string }>([
      {
        type: 'input',
        name: 'token',
        message: 'Notion integration token:',
        default: cfg.kb.notion_token ?? '',
      },
      {
        type: 'input',
        name: 'dbId',
        message: 'Notion database ID:',
        default: cfg.kb.notion_database_id ?? '',
      },
    ]);
    cfg.kb = { ...cfg.kb, notion_token: token.trim(), notion_database_id: dbId.trim() };
  }
  if (driver === 'postgres') {
    const env = process.env.DATABASE_URL ? `(현재 env: 설정됨)` : `(현재 env: 미설정)`;
    const { url } = await inquirer.prompt<{ url: string }>([
      {
        type: 'input',
        name: 'url',
        message: `Postgres connection URL ${env} (Enter 로 env 사용):`,
        default: '',
      },
    ]);
    if (url.trim()) {
      cfg.kb = { ...cfg.kb, postgres_url: url.trim() };
    }
  }
  return cfg;
}

// P1-B: 1st-user 프로필 (선택). 신규 설치 시 KB 가 즉시 사용 가능하면 박제.
// hybrid wizard 안에서 호출되며, postgres 의 경우 DATABASE_URL 검증 실패 시 skip.
async function promptFirstUser(cfg: InitConfigShape): Promise<{
  nickname?: string;
  slackId?: string;
}> {
  const { wantOnboard } = await inquirer.prompt<{ wantOnboard: boolean }>([
    {
      type: 'confirm',
      name: 'wantOnboard',
      message: '본인 프로필을 KB 에 첫 사용자로 등록하시겠어요?',
      default: true,
    },
  ]);
  if (!wantOnboard) return {};
  const { nickname, slackId } = await inquirer.prompt<{ nickname: string; slackId: string }>([
    {
      type: 'input',
      name: 'nickname',
      message: '본인을 어떻게 부르면 좋을까요? (예: 재용)',
      validate: (v: string) => v.trim().length >= 1 || '닉네임이 비어있습니다',
    },
    {
      type: 'input',
      name: 'slackId',
      message: 'Slack user ID (선택, 모르면 Enter):',
      default: '',
    },
  ]);
  return { nickname: nickname.trim(), slackId: slackId.trim() || undefined };
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
  if (cfg.kb.driver === 'postgres' && cfg.kb.obsidian_vault) {
    // Hybrid mode 활성 (P3-F)
    console.log(chalk.bold('  • Hybrid 모드 (Core PG + Obsidian sync) 활성:'));
    console.log(
      `    ${chalk.cyan(`./scripts/install-kb-mirror-launchd.sh install --vault "${cfg.kb.obsidian_vault}" --bidirectional`)}`,
    );
    console.log(
      `    또는 foreground: ${chalk.cyan(`semo kb-mirror start --source obsidian --source-vault "${cfg.kb.obsidian_vault}" --target postgres --bidirectional`)}`,
    );
  } else if (cfg.kb.driver === 'obsidian' && cfg.kb.obsidian_vault) {
    console.log(`  • Obsidian watch: ${chalk.cyan('semo obsidian watch')}`);
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
    .option(
      '--hybrid',
      'kb.driver=postgres + obsidian_vault 동시 활성 (kb-mirror 가 sync). --profile 비대화형과 결합 가능',
    )
    .option(
      '--obsidian-vault <path>',
      '비대화형 obsidian_vault 경로 (--hybrid 또는 obsidian profile)',
    )
    .action(
      async (opts: {
        profile?: string;
        path: string;
        force?: boolean;
        dryRun?: boolean;
        hybrid?: boolean;
        obsidianVault?: string;
      }) => {
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

        let cfg = buildConfigForProfile(profile);

        // P3-F (2026-05-28): --hybrid 본구현. kb.driver 는 postgres 로 유지하되
        // obsidian_vault 도 함께 박제 → kb-mirror 가 양방향 sync.
        if (opts.hybrid) {
          if (cfg.kb.driver !== 'postgres') {
            console.log(
              chalk.yellow(
                `⚠ --hybrid 는 postgres driver 기반. 현재 ${cfg.kb.driver} → postgres 로 강제 변경.`,
              ),
            );
            cfg.kb = { ...cfg.kb, driver: 'postgres' };
          }
          const vault =
            opts.obsidianVault ||
            (opts.profile
              ? path.join(os.homedir(), 'Documents', 'SEMO-Vault')
              : (
                  await inquirer.prompt<{ vault: string }>([
                    {
                      type: 'input',
                      name: 'vault',
                      message: 'Obsidian vault 경로 (hybrid sync 대상):',
                      default: path.join(os.homedir(), 'Documents', 'SEMO-Vault'),
                      validate: (v: string) => v.trim().length > 0 || 'vault 경로 비어 있음',
                    },
                  ])
                ).vault);
          cfg.kb = { ...cfg.kb, obsidian_vault: vault.trim() };
        }

        // P1-B (2026-05-28): driver-별 detail prompt (비대화형 옵션 없는 경우만)
        if (!opts.profile && !opts.dryRun && !opts.hybrid) {
          cfg = await promptKbDriverDetails(cfg);
        }

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

        // P1-B: 1st-user 프로필 안내 (대화형만, 실제 KB upsert 는 별도 명령 권장)
        if (!opts.profile && !opts.dryRun) {
          try {
            const firstUser = await promptFirstUser(cfg);
            if (firstUser.nickname) {
              console.log(
                chalk.cyan(
                  `\n✓ 첫 사용자 정보 수집: nickname=${firstUser.nickname}${firstUser.slackId ? `, slack-id=${firstUser.slackId}` : ''}`,
                ),
              );
              console.log(chalk.gray(`  → 실제 KB 박제는 backend 준비 후 다음 명령으로:`));
              const slug =
                firstUser.nickname
                  .replace(/[^A-Za-z0-9]/g, '')
                  .toLowerCase()
                  .slice(0, 20) || 'user';
              const domain = `team-${slug}`;
              console.log(
                chalk.gray(
                  `    semo kb-portable upsert ${domain} nickname --content ${firstUser.nickname}`,
                ),
              );
              if (firstUser.slackId) {
                console.log(
                  chalk.gray(
                    `    semo kb-portable upsert ${domain} slack-id --content ${firstUser.slackId}`,
                  ),
                );
              }
            }
          } catch (err) {
            console.warn(chalk.yellow(`⚠ first-user prompt skipped: ${(err as Error).message}`));
          }
        }

        printNextSteps(cfg);
      },
    );
}

export const __testables = { buildConfigForProfile, renderConfigToml, writeConfig };
