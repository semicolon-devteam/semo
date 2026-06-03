/**
 * semo runtime — Runtime Portable HostAdapter 진단·smoke·daemon 명령.
 *
 * - `semo runtime probe` — 어댑터 가용성 진단
 * - `semo runtime dispatch` — 1-shot smoke
 * - `semo runtime serve` — mailbox 폴링 daemon (1봇, host=openclaw 등 비-Claude Code 봇용)
 *
 * KB hardcoding 없이 bot_status DB 에서 host_kind 등 메타 동적 조회.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { getPool, closeConnection, isDbConnected } from '../database';
import { buildHermesProvisionPlan, ensureHermesProvisioned } from './hermes-provision.js';

interface CommonRuntime {
  ClaudeCodeAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
  CodexCliAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
  OpenClawAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
  OllamaCliAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
  HermesCliAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
  HermesDesktopAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
}

interface HostCapabilityLike {
  sandboxModes: string[];
  approvalPolicy: string;
  sessionResume: boolean;
  oneShotIO: boolean;
  daemonMode: boolean;
}

interface HostAdapterLike {
  readonly kind: string;
  readonly capability: HostCapabilityLike;
  probe(): Promise<{ ok: boolean; detail?: string }>;
  startSession(input: { botId: string }): Promise<{ hostSessionId: string; rolloutPath?: string }>;
  dispatch(input: {
    botId: string;
    session: { hostSessionId: string; rolloutPath?: string };
    prompt: string;
    personaEnvelope?: string;
    timeoutMs?: number;
    context?: Record<string, unknown>;
  }): Promise<{
    text: string;
    session?: { hostSessionId: string; rolloutPath?: string };
    endReason: string;
    hostMeta?: Record<string, unknown>;
  }>;
}

interface RuntimeOutputEnvelope {
  reply_text?: unknown;
  kb_status?: unknown;
  needs_user_confirmation?: unknown;
  actions_taken?: unknown;
  files_changed?: unknown;
  suggested_delegation?: unknown;
}

interface NormalizedDispatchOutput {
  replyText: string;
  kbStatus: 'written' | 'not-needed' | 'pending';
  needsUserConfirmation: boolean;
  envelope?: {
    reply_text: string;
    kb_status?: 'written' | 'not-needed' | 'pending';
    needs_user_confirmation?: boolean;
    actions_taken?: unknown[];
    files_changed?: unknown[];
    suggested_delegation?: unknown;
  };
}

export interface RuntimeSessionEntry {
  session: { hostSessionId: string; rolloutPath?: string };
  updated_at: string;
  expires_at: string;
}

export type RuntimeSessionMap = Record<string, RuntimeSessionEntry>;

async function loadCommon(): Promise<CommonRuntime> {
  try {
    return (await import('@team-semicolon/semo-common')) as unknown as CommonRuntime;
  } catch (err) {
    console.error(chalk.red('✗ @team-semicolon/semo-common 로드 실패 — optional 의존성입니다.'));
    console.error(chalk.gray('  설치: npm i -g @team-semicolon/semo-common'));
    console.error(chalk.gray(`  상세: ${(err as Error).message}`));
    process.exit(1);
  }
}

interface AdapterDef {
  name: string;
  factory: (m: CommonRuntime, opts: Record<string, unknown>) => HostAdapterLike;
}

/** mailbox 메시지 타입 (packages/common/src/mailbox/types.ts InboxMessage 와 정합). */
interface InboxMessage {
  id: string;
  type?: string;
  platform?: string;
  channel_id?: string;
  thread_id?: string;
  text?: string;
  sender_name?: string;
  speaker_domain?: string;
  thread_history?: unknown[];
  [k: string]: unknown;
}

/** bot_status 조회 결과 (필요 필드만). */
interface BotRecord {
  bot_id: string;
  config: {
    host_kind?: string;
    openclaw_workspace?: string;
    openclaw_profile?: string;
    hermes_home?: string;
    hermes_profile?: string;
    hermes_base_profile?: string;
    hermes_provider?: string;
    hermes_model?: string;
    hermes_toolsets?: string;
    hermes_skills?: string;
    hermes_max_turns?: number;
    hermes_role?: string;
  } | null;
  workspace_path: string | null;
}

function semoMailboxDir(): string {
  return process.env.SEMO_MAILBOX_DIR ?? path.join(os.homedir(), '.semo', 'mailbox');
}

/**
 * 동적 에이전트 personaEnvelope 로드 — agent_personas.soul_md 우선, 없으면 agent_definitions.persona_prompt.
 * 둘 다 없으면 undefined(envelope 없이 base profile 행동으로 fallback).
 */
async function loadPersonaEnvelope(botId: string): Promise<string | undefined> {
  const pool = getPool();
  try {
    const p = await pool.query<{ soul_md: string }>(
      `SELECT soul_md FROM semo.agent_personas WHERE slug = $1 AND status = 'active' LIMIT 1`,
      [botId],
    );
    if (p.rows[0]?.soul_md) return p.rows[0].soul_md;
    const d = await pool.query<{ persona_prompt: string }>(
      `SELECT persona_prompt FROM semo.agent_definitions WHERE name = $1 LIMIT 1`,
      [botId],
    );
    return d.rows[0]?.persona_prompt || undefined;
  } catch {
    return undefined;
  }
}

async function loadBotRecord(botId: string): Promise<BotRecord | null> {
  const pool = getPool();
  const r = await pool.query(
    `SELECT bot_id, config, workspace_path
     FROM semo.bot_status WHERE bot_id = $1 LIMIT 1`,
    [botId],
  );
  return (r.rows[0] as BotRecord | undefined) ?? null;
}

function buildAdapterFromHostKind(
  m: CommonRuntime,
  hostKind: string,
  bot: BotRecord,
  opts: {
    openclawBinary?: string;
    hermesBinary?: string;
    hermesHome?: string;
    hermesProfile?: string;
    hermesProvider?: string;
    hermesModel?: string;
    hermesToolsets?: string;
    hermesSkills?: string;
    hermesMaxTurns?: number;
    hermesRole?: string;
    enableSessionResume?: boolean;
  },
): HostAdapterLike | null {
  const ctorOpts: Record<string, unknown> = {};
  switch (hostKind) {
    case 'claude-code':
      return new m.ClaudeCodeAdapter(ctorOpts);
    case 'codex-cli':
      return new m.CodexCliAdapter(ctorOpts);
    case 'openclaw':
      if (opts.openclawBinary) ctorOpts.binaryPath = opts.openclawBinary;
      // bot.config.openclaw_workspace 의 부모 디렉토리를 workspaceParent 로 (~/.openclaw-{bot} 패턴 유지).
      return new m.OpenClawAdapter(ctorOpts);
    case 'ollama-cli':
      ctorOpts.model = (bot.config as Record<string, unknown> | undefined)?.ollama_model;
      return new m.OllamaCliAdapter(ctorOpts);
    case 'hermes-cli':
      if (opts.hermesBinary) ctorOpts.binaryPath = opts.hermesBinary;
      ctorOpts.hermesHome = opts.hermesHome ?? bot.config?.hermes_home;
      ctorOpts.profile = opts.hermesProfile ?? bot.config?.hermes_profile ?? `semo-${bot.bot_id}`;
      ctorOpts.provider = opts.hermesProvider ?? bot.config?.hermes_provider;
      ctorOpts.model = opts.hermesModel ?? bot.config?.hermes_model;
      ctorOpts.toolsets = opts.hermesToolsets ?? bot.config?.hermes_toolsets;
      ctorOpts.skills = opts.hermesSkills ?? bot.config?.hermes_skills;
      ctorOpts.maxTurns = opts.hermesMaxTurns ?? bot.config?.hermes_max_turns;
      ctorOpts.semoRole = opts.hermesRole ?? bot.config?.hermes_role;
      ctorOpts.enableSessionResume = opts.enableSessionResume === true;
      return new m.HermesCliAdapter(ctorOpts);
    case 'hermes-desktop':
      if (opts.hermesBinary) ctorOpts.binaryPath = opts.hermesBinary;
      ctorOpts.hermesHome = opts.hermesHome ?? bot.config?.hermes_home;
      ctorOpts.profile = opts.hermesProfile ?? bot.config?.hermes_profile ?? `semo-${bot.bot_id}`;
      ctorOpts.provider = opts.hermesProvider ?? bot.config?.hermes_provider;
      ctorOpts.model = opts.hermesModel ?? bot.config?.hermes_model;
      ctorOpts.toolsets = opts.hermesToolsets ?? bot.config?.hermes_toolsets;
      ctorOpts.skills = opts.hermesSkills ?? bot.config?.hermes_skills;
      ctorOpts.maxTurns = opts.hermesMaxTurns ?? bot.config?.hermes_max_turns;
      ctorOpts.semoRole = opts.hermesRole ?? bot.config?.hermes_role;
      ctorOpts.enableSessionResume = opts.enableSessionResume === true;
      return new m.HermesDesktopAdapter(ctorOpts);
    default:
      return null;
  }
}

/**
 * 어댑터 enumerate — 봇 이름 하드코딩 없음. 여기는 호스트 종류 enum (어댑터 클래스 자체).
 */
function listAdapters(): AdapterDef[] {
  return [
    { name: 'claude-code', factory: (m, o) => new m.ClaudeCodeAdapter(o) },
    { name: 'codex-cli', factory: (m, o) => new m.CodexCliAdapter(o) },
    { name: 'openclaw', factory: (m, o) => new m.OpenClawAdapter(o) },
    { name: 'ollama-cli', factory: (m, o) => new m.OllamaCliAdapter(o) },
    { name: 'hermes-cli', factory: (m, o) => new m.HermesCliAdapter(o) },
    { name: 'hermes-desktop', factory: (m, o) => new m.HermesDesktopAdapter(o) },
  ];
}

export function registerRuntimeCommands(program: Command): void {
  const runtime = program.command('runtime').description('Runtime Portable HostAdapter 진단·smoke');

  runtime
    .command('probe')
    .description('모든 HostAdapter 의 probe() 실행 → CLI/바이너리 가용성 표시')
    .option('--openclaw-binary <path>', 'openclaw 바이너리 절대경로 (PATH 미등록 환경용)')
    .option('--hermes-binary <path>', 'hermes 바이너리 절대경로 (PATH 미등록 환경용)')
    .option('--hermes-home <path>', 'Hermes HERMES_HOME 격리 디렉토리')
    .option('--json', 'JSON 출력')
    .action(
      async (opts: {
        openclawBinary?: string;
        hermesBinary?: string;
        hermesHome?: string;
        json?: boolean;
      }) => {
        const m = await loadCommon();

        const adapters = listAdapters();
        const results: Array<{
          name: string;
          capability: HostCapabilityLike;
          ok: boolean;
          detail?: string;
        }> = [];

        for (const def of adapters) {
          const ctorOpts: Record<string, unknown> = {};
          if (def.name === 'openclaw' && opts.openclawBinary) {
            ctorOpts.binaryPath = opts.openclawBinary;
          }
          if (def.name.startsWith('hermes') && opts.hermesBinary) {
            ctorOpts.binaryPath = opts.hermesBinary;
          }
          if (def.name.startsWith('hermes') && opts.hermesHome) {
            ctorOpts.hermesHome = opts.hermesHome;
          }
          const adapter = def.factory(m, ctorOpts);
          const r = await adapter.probe();
          results.push({
            name: def.name,
            capability: adapter.capability,
            ok: r.ok,
            detail: r.detail,
          });
        }

        if (opts.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        console.log(chalk.cyan.bold('\n🧪 HostAdapter probe\n'));
        console.log(
          chalk.gray('  어댑터              상태  capability                              detail'),
        );
        console.log(chalk.gray('  ' + '─'.repeat(95)));
        for (const r of results) {
          const icon = r.ok ? chalk.green('✓ ok ') : chalk.red('✗ no ');
          const cap = `sandbox=${r.capability.sandboxModes.length},approval=${r.capability.approvalPolicy},resume=${r.capability.sessionResume ? '✓' : '✗'},1shot=${r.capability.oneShotIO ? '✓' : '✗'}`;
          const detail = (r.detail ?? '').slice(0, 50);
          console.log(`  ${r.name.padEnd(20)}${icon} ${cap.padEnd(40)} ${chalk.gray(detail)}`);
        }
        console.log();
        const okCount = results.filter((r) => r.ok).length;
        console.log(chalk.gray(`  총 ${results.length}개 어댑터 (가용: ${okCount})\n`));
      },
    );

  runtime
    .command('dispatch <prompt>')
    .description('지정 어댑터로 1-shot dispatch — smoke 검증 (운영 흐름 미침투)')
    .requiredOption(
      '--adapter <name>',
      'claude-code | codex-cli | openclaw | ollama-cli | hermes-cli',
    )
    .option('--bot-id <id>', '봇 식별자 (호스트별 의미 다름)', 'probe-bot')
    .option('--timeout <ms>', 'timeout (ms)', '60000')
    .option('--openclaw-binary <path>', 'openclaw 바이너리 절대경로')
    .option('--hermes-binary <path>', 'hermes 바이너리 절대경로')
    .option('--hermes-home <path>', 'Hermes HERMES_HOME 격리 디렉토리')
    .option('--hermes-profile <profile>', 'Hermes profile override')
    .option('--hermes-base-profile <profile>', 'Hermes profile provision 시 clone할 base profile')
    .option('--hermes-provider <provider>', 'Hermes provider override')
    .option('--hermes-model <model>', 'Hermes model override')
    .option('--hermes-toolsets <csv>', 'Hermes toolsets override')
    .option('--hermes-skills <csv>', 'Hermes skills override')
    .option('--hermes-max-turns <n>', 'Hermes max turns override')
    .option('--hermes-role <role>', 'Hermes SEMO role-bounded worker role')
    .option('--no-hermes-provision', 'Hermes profile/skill readiness guard 비활성화')
    .option('--cwd <dir>', '호출 cwd')
    .action(
      async (
        prompt: string,
        opts: {
          adapter: string;
          botId: string;
          timeout: string;
          openclawBinary?: string;
          hermesBinary?: string;
          hermesHome?: string;
          hermesProfile?: string;
          hermesBaseProfile?: string;
          hermesProvider?: string;
          hermesModel?: string;
          hermesToolsets?: string;
          hermesSkills?: string;
          hermesMaxTurns?: string;
          hermesRole?: string;
          hermesProvision?: boolean;
          cwd?: string;
        },
      ) => {
        const m = await loadCommon();
        const def = listAdapters().find((d) => d.name === opts.adapter);
        if (!def) {
          console.error(
            chalk.red(`✗ unknown adapter '${opts.adapter}'. options:`),
            listAdapters()
              .map((d) => d.name)
              .join(', '),
          );
          process.exit(1);
        }
        const ctorOpts: Record<string, unknown> = {};
        if (def.name === 'openclaw' && opts.openclawBinary) {
          ctorOpts.binaryPath = opts.openclawBinary;
        }
        if (def.name.startsWith('hermes') && opts.hermesBinary) {
          ctorOpts.binaryPath = opts.hermesBinary;
        }
        if (def.name.startsWith('hermes') && opts.hermesHome) {
          ctorOpts.hermesHome = opts.hermesHome;
        }
        if (def.name.startsWith('hermes')) {
          const plan = buildHermesProvisionPlan({
            botId: opts.botId,
            hostKind: def.name,
            hermesHome: opts.hermesHome,
            hermesProfile: opts.hermesProfile,
            hermesBaseProfile: opts.hermesBaseProfile,
            hermesSkills: opts.hermesSkills,
            noHermesProvision: opts.hermesProvision === false,
          });
          const ready = await ensureHermesProvisioned(plan);
          ctorOpts.profile = ready.profile;
          if (ready.home) ctorOpts.hermesHome = ready.home;
        }
        if (def.name.startsWith('hermes') && opts.hermesProvider) {
          ctorOpts.provider = opts.hermesProvider;
        }
        if (def.name.startsWith('hermes') && opts.hermesModel) {
          ctorOpts.model = opts.hermesModel;
        }
        if (def.name.startsWith('hermes') && opts.hermesToolsets) {
          ctorOpts.toolsets = opts.hermesToolsets;
        }
        if (def.name.startsWith('hermes') && opts.hermesSkills) {
          ctorOpts.skills = opts.hermesSkills;
        }
        if (def.name.startsWith('hermes') && opts.hermesMaxTurns) {
          ctorOpts.maxTurns = Number(opts.hermesMaxTurns);
        }
        if (def.name.startsWith('hermes') && opts.hermesRole) {
          ctorOpts.semoRole = opts.hermesRole;
        }
        const adapter = def.factory(m, ctorOpts);

        const probe = await adapter.probe();
        if (!probe.ok) {
          console.error(chalk.red(`✗ probe 실패: ${probe.detail}`));
          process.exit(1);
        }

        const spinner = ora(`${opts.adapter} dispatch...`).start();
        const t0 = Date.now();
        try {
          const session = await adapter.startSession({ botId: opts.botId });
          const r = await adapter.dispatch({
            botId: opts.botId,
            session,
            prompt,
            timeoutMs: Number(opts.timeout),
          });
          spinner.succeed(`완료: endReason=${r.endReason}, ${Date.now() - t0}ms`);
          console.log();
          console.log(chalk.cyan('--- response ---'));
          console.log(r.text);
          console.log();
          console.log(chalk.gray('--- hostMeta (요약) ---'));
          if (r.hostMeta) {
            for (const [k, v] of Object.entries(r.hostMeta)) {
              if (v === undefined || v === null) continue;
              const vStr = typeof v === 'string' ? v : JSON.stringify(v);
              console.log(chalk.gray(`  ${k}: ${vStr.slice(0, 100)}`));
            }
          }
        } catch (err) {
          spinner.fail(`dispatch 실패: ${(err as Error).message}`);
          process.exit(1);
        }
      },
    );

  runtime
    .command('serve')
    .description(
      'mailbox 폴링 daemon — 1봇 inbox 를 dispatch 후 outbox 에 reply 작성 (host=openclaw 등 비-Claude Code 봇)',
    )
    .requiredOption('--bot <id>', '봇 식별자 (bot_status.bot_id)')
    .option('--interval-ms <n>', '폴링 주기 ms', '5000')
    .option('--once', '한 번만 처리하고 종료 (테스트용)')
    .option('--openclaw-binary <path>', 'openclaw 바이너리 절대경로 (PATH 미등록 환경)')
    .option('--hermes-binary <path>', 'hermes 바이너리 절대경로 (PATH 미등록 환경)')
    .option('--hermes-home <path>', 'Hermes HERMES_HOME 격리 디렉토리')
    .option('--hermes-profile <profile>', 'Hermes profile override')
    .option('--hermes-base-profile <profile>', 'Hermes profile provision 시 clone할 base profile')
    .option('--hermes-provider <provider>', 'Hermes provider override')
    .option('--hermes-model <model>', 'Hermes model override')
    .option('--hermes-toolsets <csv>', 'Hermes toolsets override')
    .option('--hermes-skills <csv>', 'Hermes skills override')
    .option('--hermes-max-turns <n>', 'Hermes max turns override')
    .option('--hermes-role <role>', 'Hermes SEMO role-bounded worker role')
    .option('--no-hermes-provision', 'Hermes profile/skill readiness guard 비활성화')
    .option(
      '--enable-session-resume',
      'Enable host session resume for reused thread session mappings',
    )
    .option('--session-ttl-ms <n>', 'Thread session mapping TTL ms', '86400000')
    .option('--reset-session-map', 'Clear this bot runtime session map before serving')
    .option('--timeout-ms <n>', 'dispatch 1회 timeout ms', '120000')
    .action(
      async (opts: {
        bot: string;
        intervalMs: string;
        once?: boolean;
        openclawBinary?: string;
        hermesBinary?: string;
        hermesHome?: string;
        hermesProfile?: string;
        hermesBaseProfile?: string;
        hermesProvider?: string;
        hermesModel?: string;
        hermesToolsets?: string;
        hermesSkills?: string;
        hermesMaxTurns?: string;
        hermesRole?: string;
        hermesProvision?: boolean;
        enableSessionResume?: boolean;
        sessionTtlMs: string;
        resetSessionMap?: boolean;
        timeoutMs: string;
      }) => {
        const connected = await isDbConnected();
        if (!connected) {
          console.error(chalk.red('✗ DB 연결 실패'));
          process.exit(1);
        }

        const bot = await loadBotRecord(opts.bot);
        if (!bot) {
          console.error(
            chalk.red(
              `✗ bot_status 에 '${opts.bot}' 없음. semo bots create 또는 직접 INSERT 필요.`,
            ),
          );
          await closeConnection();
          process.exit(1);
        }

        // 봇당 워커 1 보장 (Codex #4: migration 089 는 동시성 보장 아님 → 별도 claim lock).
        // 전용 connection 에 session-level advisory lock 을 잡고 워커 생애 동안 유지(에이전트별 순차 큐).
        // 다른 워커가 이미 점유 중이면 즉시 종료(중복 워커·경쟁 방지). 프로세스 종료 시 자동 해제.
        const lockClient = await getPool().connect();
        const lockKey = `semo-serve:${opts.bot}`;
        const lockRes = await lockClient.query<{ locked: boolean }>(
          `SELECT pg_try_advisory_lock(hashtext($1)) AS locked`,
          [lockKey],
        );
        if (!lockRes.rows[0]?.locked) {
          console.error(chalk.yellow(`⏭  '${opts.bot}' 워커가 이미 실행 중 — 종료(중복 방지).`));
          lockClient.release();
          await closeConnection();
          process.exit(0);
        }
        const releaseLock = () => {
          try {
            lockClient.release();
          } catch {
            /* 종료 경로 — 무시 */
          }
        };
        process.once('exit', releaseLock);
        process.once('SIGTERM', () => {
          releaseLock();
          process.exit(0);
        });

        const hostKind = bot.config?.host_kind ?? 'claude-code';
        if (hostKind === 'hermes-cli' || hostKind === 'hermes-desktop') {
          const plan = buildHermesProvisionPlan({
            botId: opts.bot,
            hostKind,
            hermesHome: opts.hermesHome ?? bot.config?.hermes_home,
            hermesProfile: opts.hermesProfile ?? bot.config?.hermes_profile,
            hermesBaseProfile: opts.hermesBaseProfile ?? bot.config?.hermes_base_profile,
            hermesSkills: opts.hermesSkills ?? bot.config?.hermes_skills,
            noHermesProvision: opts.hermesProvision === false,
          });
          await ensureHermesProvisioned(plan);
          opts.hermesHome = plan.home ?? undefined;
          opts.hermesProfile = plan.profile;
        }

        // 동적 에이전트: DB 정의(agent_personas.soul_md / agent_definitions.persona_prompt)를
        // personaEnvelope 로 로드해 dispatch 시 in-band 주입(per-agent profile 불필요).
        // config.use_persona_envelope 인 봇만 — 기존 profile-기반 봇(Semi/Colony)은 자기 SOUL.md 사용(무변).
        let dynamicPersonaEnvelope: string | undefined;
        if ((bot.config as Record<string, unknown> | undefined)?.use_persona_envelope) {
          dynamicPersonaEnvelope = await loadPersonaEnvelope(opts.bot);
          console.log(
            chalk.dim(
              `[serve] persona envelope ${dynamicPersonaEnvelope ? `loaded (${dynamicPersonaEnvelope.length} chars)` : 'not found in DB'}`,
            ),
          );
        }

        const m = await loadCommon();
        const adapter = buildAdapterFromHostKind(m, hostKind, bot, {
          openclawBinary: opts.openclawBinary,
          hermesBinary: opts.hermesBinary,
          hermesHome: opts.hermesHome,
          hermesProfile: opts.hermesProfile,
          hermesProvider: opts.hermesProvider,
          hermesModel: opts.hermesModel,
          hermesToolsets: opts.hermesToolsets,
          hermesSkills: opts.hermesSkills,
          hermesMaxTurns: opts.hermesMaxTurns ? Number(opts.hermesMaxTurns) : undefined,
          hermesRole: opts.hermesRole,
          enableSessionResume: opts.enableSessionResume === true,
        });
        if (!adapter) {
          console.error(chalk.red(`✗ host_kind='${hostKind}' 지원 어댑터 없음`));
          await closeConnection();
          process.exit(1);
        }

        const probe = await adapter.probe();
        if (!probe.ok) {
          console.error(chalk.red(`✗ probe 실패: ${probe.detail}`));
          await closeConnection();
          process.exit(1);
        }

        const mboxDir = path.join(semoMailboxDir(), opts.bot);
        fs.mkdirSync(mboxDir, { recursive: true });
        const inboxPath = path.join(mboxDir, 'inbox.jsonl');
        const consumedPath = path.join(mboxDir, 'inbox.consumed');
        const outboxPath = path.join(mboxDir, 'outbox.jsonl');
        const auditPath = path.join(mboxDir, 'audit.jsonl');
        const sessionMapPath = path.join(mboxDir, 'sessions.json');
        const heartbeatPath = path.join(mboxDir, 'heartbeat');

        const intervalMs = Math.max(1000, Number(opts.intervalMs));
        const timeoutMs = Math.max(5000, Number(opts.timeoutMs));
        const sessionTtlMs = Math.max(0, Number(opts.sessionTtlMs));
        if (opts.resetSessionMap && fs.existsSync(sessionMapPath)) fs.unlinkSync(sessionMapPath);

        console.log(chalk.cyan.bold(`\n🚀 semo runtime serve\n`));
        console.log(`  bot:        ${chalk.green(opts.bot)}`);
        console.log(`  host_kind:  ${chalk.green(hostKind)} (${probe.detail ?? 'ok'})`);
        console.log(`  mailbox:    ${chalk.gray(mboxDir)}`);
        console.log(`  interval:   ${intervalMs}ms`);
        console.log(`  mode:       ${opts.once ? 'once' : 'forever'}\n`);

        let stopRequested = false;
        const onShutdown = (signal: string) => {
          if (stopRequested) return;
          stopRequested = true;
          console.log(chalk.yellow(`\n[serve] ${signal} 수신 — graceful shutdown...`));
        };
        process.on('SIGINT', () => onShutdown('SIGINT'));
        process.on('SIGTERM', () => onShutdown('SIGTERM'));

        const sleep = (ms: number) =>
          new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

        let totalProcessed = 0;
        let totalErrors = 0;

        while (!stopRequested) {
          fs.writeFileSync(heartbeatPath, new Date().toISOString());
          try {
            const newMessages = readNewInboxMessages(inboxPath, consumedPath);
            for (const msg of newMessages) {
              if (stopRequested) break;
              if (msg.type !== 'message') {
                appendConsumed(consumedPath, msg.id);
                continue;
              }
              const t0 = Date.now();
              process.stdout.write(
                chalk.gray(
                  `[serve] ${new Date().toISOString().slice(11, 19)} dispatching ${msg.id.slice(0, 8)}... `,
                ),
              );
              try {
                const sessionMap = loadRuntimeSessionMap(sessionMapPath, sessionTtlMs);
                const sessionKey = buildRuntimeSessionKey(opts.bot, msg);
                const existingSession = sessionMap[sessionKey]?.session;
                const sessionReused = Boolean(existingSession);
                const session =
                  existingSession ?? (await adapter.startSession({ botId: opts.bot }));
                const r = await adapter.dispatch({
                  botId: opts.bot,
                  session,
                  // 동적 에이전트 행동 envelope 를 프롬프트에 prepend (adapter-agnostic — ollama/codex 등 모두 적용).
                  prompt: dynamicPersonaEnvelope
                    ? `# 당신의 정체성·행동 정의 (아래 에이전트로서 응답한다)\n${dynamicPersonaEnvelope}\n\n---\n\n${composePrompt(msg)}`
                    : composePrompt(msg),
                  timeoutMs,
                  context: { runtimeSessionReused: sessionReused, runtimeSessionKey: sessionKey },
                });
                const elapsedMs = Date.now() - t0;
                const audit = buildRuntimeAudit({
                  botId: opts.bot,
                  hostKind,
                  elapsedMs,
                  timeoutMs,
                  result: r,
                });
                audit.runtime_session_key = sessionKey;
                audit.runtime_session_reused = sessionReused;
                audit.session_resume_capable = adapter.capability.sessionResume;
                const nextSession = r.session ?? session;
                sessionMap[sessionKey] = buildRuntimeSessionEntry(nextSession, sessionTtlMs);
                saveRuntimeSessionMap(sessionMapPath, sessionMap);
                appendAudit(auditPath, {
                  id: randomUUID(),
                  in_reply_to: msg.id,
                  timestamp: new Date().toISOString(),
                  ...audit,
                });
                if (r.text && r.endReason === 'completed') {
                  const output = normalizeDispatchOutput(r.text);
                  appendOutbox(outboxPath, {
                    id: randomUUID(),
                    in_reply_to: msg.id,
                    timestamp: new Date().toISOString(),
                    type: 'reply',
                    bot_id: opts.bot,
                    text: output.replyText,
                    output_contract: {
                      kb_status: output.kbStatus,
                      needs_user_confirmation: output.needsUserConfirmation,
                      envelope_present: Boolean(output.envelope),
                      actions_taken: output.envelope?.actions_taken ?? [],
                      files_changed: output.envelope?.files_changed ?? [],
                      suggested_delegation: output.envelope?.suggested_delegation ?? null,
                    },
                    runtime_audit: audit,
                    platform: msg.platform ?? 'slack',
                    channel_id: msg.channel_id ?? '',
                    thread_id: msg.thread_id ?? '',
                  });
                  totalProcessed++;
                  console.log(
                    chalk.green(`✓ ${r.endReason} (${elapsedMs}ms, ${output.replyText.length}b)`),
                  );
                } else {
                  totalErrors++;
                  console.log(chalk.red(formatDispatchFailureForLog(r, elapsedMs)));
                  // P0-A (2026-05-28): timeout/error/empty 응답 시에도 placeholder outbox 작성.
                  // 이유: slack-router 의 outbox-matcher 가 reply 를 감지해야 bot_commitments 를
                  // 'failed' 로 마감. 안 그러면 commitment 가 영원히 active 상태로 stuck.
                  // KB: semo decision/one-agent-experience-implementation-2026-05-27
                  appendOutbox(outboxPath, {
                    id: randomUUID(),
                    in_reply_to: msg.id,
                    timestamp: new Date().toISOString(),
                    type: 'reply',
                    bot_id: opts.bot,
                    text: `[runtime-fallback] dispatch 처리 실패 (endReason=${r.endReason}${r.text ? ', empty text' : ''}). audit 로그 확인 필요.`,
                    runtime_audit: audit,
                    platform: msg.platform ?? 'slack',
                    channel_id: msg.channel_id ?? '',
                    thread_id: msg.thread_id ?? '',
                    metadata: { failed: true, endReason: r.endReason },
                  });
                }
              } catch (err) {
                totalErrors++;
                console.log(chalk.red(`✗ throw: ${(err as Error).message}`));
              }
              // 성공·실패 무관 consumed 마킹 — 무한 재시도 방지. 실패는 KB/로그에서 추적.
              appendConsumed(consumedPath, msg.id);
            }
          } catch (err) {
            console.error(chalk.red(`[serve] poll error: ${(err as Error).message}`));
          }
          if (opts.once) break;
          await sleep(intervalMs);
        }

        console.log(
          chalk.gray(`\n[serve] 종료. processed=${totalProcessed}, errors=${totalErrors}`),
        );
        await closeConnection();
        process.exit(0);
      },
    );
}

export function normalizeDispatchOutput(text: string): NormalizedDispatchOutput {
  const trimmed = text.trim();
  const candidate = extractJsonCandidate(trimmed);
  if (candidate) {
    try {
      const parsed = JSON.parse(candidate) as RuntimeOutputEnvelope;
      if (typeof parsed.reply_text === 'string' && parsed.reply_text.trim()) {
        const kbStatus = normalizeKbStatus(parsed.kb_status);
        return {
          replyText: parsed.reply_text,
          kbStatus,
          needsUserConfirmation: parsed.needs_user_confirmation === true,
          envelope: {
            reply_text: parsed.reply_text,
            kb_status: kbStatus,
            needs_user_confirmation: parsed.needs_user_confirmation === true,
            actions_taken: Array.isArray(parsed.actions_taken) ? parsed.actions_taken : [],
            files_changed: Array.isArray(parsed.files_changed) ? parsed.files_changed : [],
            suggested_delegation: parsed.suggested_delegation ?? null,
          },
        };
      }
    } catch {
      // Tolerant contract: invalid JSON never blocks plain-text fallback.
    }
  }

  return {
    replyText: text,
    kbStatus: 'not-needed',
    needsUserConfirmation: false,
  };
}

export function buildRuntimeAudit(input: {
  botId: string;
  hostKind: string;
  elapsedMs: number;
  timeoutMs: number;
  result: { text?: string; endReason: string; hostMeta?: Record<string, unknown> };
}): Record<string, unknown> {
  const hostMeta = input.result.hostMeta ?? {};
  const out: Record<string, unknown> = {
    bot_id: input.botId,
    host_kind: input.hostKind,
    end_reason: input.result.endReason,
    elapsed_ms: input.elapsedMs,
    timeout_ms: input.timeoutMs,
  };
  for (const [auditKey, metaKey] of [
    ['profile', 'profile'],
    ['provider', 'provider'],
    ['model', 'model'],
    ['semo_role', 'semo_role'],
    ['session_resume_enabled', 'session_resume_enabled'],
    ['session_resume_requested', 'session_resume_requested'],
    ['hermes_session_id', 'hermes_session_id'],
    ['exit_code', 'exit_code'],
    ['signal', 'signal'],
  ] as const) {
    const value = hostMeta[metaKey];
    if (value !== undefined && value !== null) out[auditKey] = value;
  }
  if (hostMeta.stderr_tail !== undefined && hostMeta.stderr_tail !== null) {
    out.stderr_tail = redactSensitive(oneLine(String(hostMeta.stderr_tail))).slice(-1000);
  }
  return out;
}

export function buildRuntimeSessionKey(botId: string, msg: InboxMessage): string {
  const platform = sanitizeSessionKeyPart(msg.platform ?? 'unknown-platform');
  const channel = sanitizeSessionKeyPart(msg.channel_id ?? 'unknown-channel');
  const thread = sanitizeSessionKeyPart(msg.thread_id ?? msg.id);
  const bot = sanitizeSessionKeyPart(botId);
  return [platform, channel, thread, bot].join(':');
}

export function loadRuntimeSessionMap(sessionMapPath: string, ttlMs: number): RuntimeSessionMap {
  if (!fs.existsSync(sessionMapPath)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(sessionMapPath, 'utf8'));
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const now = Date.now();
  const out: RuntimeSessionMap = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = value as Partial<RuntimeSessionEntry>;
    if (!entry.session || typeof entry.session.hostSessionId !== 'string') continue;
    const expiresAt = typeof entry.expires_at === 'string' ? Date.parse(entry.expires_at) : NaN;
    if (ttlMs > 0 && Number.isFinite(expiresAt) && expiresAt <= now) continue;
    out[key] = {
      session: {
        hostSessionId: entry.session.hostSessionId,
        rolloutPath:
          typeof entry.session.rolloutPath === 'string' ? entry.session.rolloutPath : undefined,
      },
      updated_at:
        typeof entry.updated_at === 'string' ? entry.updated_at : new Date(now).toISOString(),
      expires_at:
        typeof entry.expires_at === 'string'
          ? entry.expires_at
          : new Date(now + Math.max(0, ttlMs)).toISOString(),
    };
  }
  return out;
}

export function buildRuntimeSessionEntry(
  session: { hostSessionId: string; rolloutPath?: string },
  ttlMs: number,
): RuntimeSessionEntry {
  const now = Date.now();
  return {
    session,
    updated_at: new Date(now).toISOString(),
    expires_at: new Date(now + Math.max(0, ttlMs)).toISOString(),
  };
}

export function saveRuntimeSessionMap(sessionMapPath: string, map: RuntimeSessionMap): void {
  fs.writeFileSync(sessionMapPath, JSON.stringify(map, null, 2) + '\n');
}

export function formatDispatchFailureForLog(
  result: { text?: string; endReason: string; hostMeta?: Record<string, unknown> },
  elapsedMs: number,
): string {
  const parts = [`✗ endReason=${result.endReason}`, `(${elapsedMs}ms)`];
  const hostMeta = result.hostMeta ?? {};
  const exitCode = hostMeta.exit_code;
  const signal = hostMeta.signal;
  const stderrTail = hostMeta.stderr_tail;
  if (exitCode !== undefined && exitCode !== null) parts.push(`exit_code=${String(exitCode)}`);
  if (signal !== undefined && signal !== null) parts.push(`signal=${String(signal)}`);
  if (stderrTail !== undefined && stderrTail !== null && String(stderrTail).trim()) {
    parts.push(`stderr_tail=${redactSensitive(oneLine(String(stderrTail))).slice(0, 500)}`);
  }
  if (result.text && result.text.trim()) {
    parts.push(`text=${oneLine(result.text).slice(0, 300)}`);
  }
  return parts.join(' ');
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function sanitizeSessionKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 160) || 'unknown';
}

function extractJsonCandidate(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  if (text.startsWith('{') && text.endsWith('}')) return text;
  return null;
}

function normalizeKbStatus(value: unknown): 'written' | 'not-needed' | 'pending' {
  return value === 'written' || value === 'pending' || value === 'not-needed'
    ? value
    : 'not-needed';
}

function redactSensitive(text: string): string {
  return text
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|secret|password)=([^\s&]+)/gi, '$1=[REDACTED]')
    .replace(/(api[_-]?key|token|secret|password):\s*([^\s]+)/gi, '$1: [REDACTED]');
}

function readNewInboxMessages(inboxPath: string, consumedPath: string): InboxMessage[] {
  if (!fs.existsSync(inboxPath)) return [];
  const consumed = new Set<string>();
  if (fs.existsSync(consumedPath)) {
    for (const line of fs.readFileSync(consumedPath, 'utf8').split('\n')) {
      const id = line.trim();
      if (id) consumed.add(id);
    }
  }
  const out: InboxMessage[] = [];
  for (const line of fs.readFileSync(inboxPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg: InboxMessage;
    try {
      msg = JSON.parse(trimmed) as InboxMessage;
    } catch {
      continue;
    }
    if (!msg.id || consumed.has(msg.id)) continue;
    out.push(msg);
  }
  return out;
}

function appendConsumed(consumedPath: string, id: string): void {
  fs.appendFileSync(consumedPath, id + '\n');
}

function appendOutbox(outboxPath: string, msg: Record<string, unknown>): void {
  fs.appendFileSync(outboxPath, JSON.stringify(msg) + '\n');
}

function appendAudit(auditPath: string, msg: Record<string, unknown>): void {
  fs.appendFileSync(auditPath, JSON.stringify(msg) + '\n');
}

function composePrompt(msg: InboxMessage): string {
  // 봇이 의도 파악 가능한 최소 컨텍스트만 전달.
  // host_kind=openclaw (gpt-5.4) 의 토큰 절약 위해 thread_history 는 일단 제외 — 향후 옵션화.
  const sender = msg.sender_name ?? 'unknown';
  const text = msg.text ?? '';
  return `${sender}: ${text}`;
}
