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

interface CommonRuntime {
  ClaudeCodeAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
  CodexCliAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
  OpenClawAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
  OllamaCliAdapter: new (opts?: Record<string, unknown>) => HostAdapterLike;
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
  startSession(input: { botId: string }): Promise<{ hostSessionId: string }>;
  dispatch(input: {
    botId: string;
    session: { hostSessionId: string };
    prompt: string;
    timeoutMs?: number;
  }): Promise<{
    text: string;
    endReason: string;
    hostMeta?: Record<string, unknown>;
  }>;
}

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
  config: { host_kind?: string; openclaw_workspace?: string; openclaw_profile?: string } | null;
  workspace_path: string | null;
}

function semoMailboxDir(): string {
  return process.env.SEMO_MAILBOX_DIR ?? path.join(os.homedir(), '.semo', 'mailbox');
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
  opts: { openclawBinary?: string },
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
      return new m.OllamaCliAdapter(ctorOpts);
    case 'hermes-desktop':
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
    { name: 'hermes-desktop', factory: (m, o) => new m.HermesDesktopAdapter(o) },
  ];
}

export function registerRuntimeCommands(program: Command): void {
  const runtime = program.command('runtime').description('Runtime Portable HostAdapter 진단·smoke');

  runtime
    .command('probe')
    .description('모든 HostAdapter 의 probe() 실행 → CLI/바이너리 가용성 표시')
    .option('--openclaw-binary <path>', 'openclaw 바이너리 절대경로 (PATH 미등록 환경용)')
    .option('--json', 'JSON 출력')
    .action(async (opts: { openclawBinary?: string; json?: boolean }) => {
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
    });

  runtime
    .command('dispatch <prompt>')
    .description('지정 어댑터로 1-shot dispatch — smoke 검증 (운영 흐름 미침투)')
    .requiredOption('--adapter <name>', 'claude-code | codex-cli | openclaw | ollama-cli')
    .option('--bot-id <id>', '봇 식별자 (호스트별 의미 다름)', 'probe-bot')
    .option('--timeout <ms>', 'timeout (ms)', '60000')
    .option('--openclaw-binary <path>', 'openclaw 바이너리 절대경로')
    .option('--cwd <dir>', '호출 cwd')
    .action(
      async (
        prompt: string,
        opts: {
          adapter: string;
          botId: string;
          timeout: string;
          openclawBinary?: string;
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
    .option('--timeout-ms <n>', 'dispatch 1회 timeout ms', '120000')
    .action(
      async (opts: {
        bot: string;
        intervalMs: string;
        once?: boolean;
        openclawBinary?: string;
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
        const hostKind = bot.config?.host_kind ?? 'claude-code';
        const m = await loadCommon();
        const adapter = buildAdapterFromHostKind(m, hostKind, bot, {
          openclawBinary: opts.openclawBinary,
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
        const heartbeatPath = path.join(mboxDir, 'heartbeat');

        const intervalMs = Math.max(1000, Number(opts.intervalMs));
        const timeoutMs = Math.max(5000, Number(opts.timeoutMs));

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
                const session = await adapter.startSession({ botId: opts.bot });
                const r = await adapter.dispatch({
                  botId: opts.bot,
                  session,
                  prompt: composePrompt(msg),
                  timeoutMs,
                });
                if (r.text && r.endReason === 'completed') {
                  appendOutbox(outboxPath, {
                    id: randomUUID(),
                    in_reply_to: msg.id,
                    timestamp: new Date().toISOString(),
                    type: 'reply',
                    bot_id: opts.bot,
                    text: r.text,
                    platform: msg.platform ?? 'slack',
                    channel_id: msg.channel_id ?? '',
                    thread_id: msg.thread_id ?? '',
                  });
                  totalProcessed++;
                  console.log(
                    chalk.green(`✓ ${r.endReason} (${Date.now() - t0}ms, ${r.text.length}b)`),
                  );
                } else {
                  totalErrors++;
                  console.log(chalk.red(`✗ endReason=${r.endReason} (${Date.now() - t0}ms)`));
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

function composePrompt(msg: InboxMessage): string {
  // 봇이 의도 파악 가능한 최소 컨텍스트만 전달.
  // host_kind=openclaw (gpt-5.4) 의 토큰 절약 위해 thread_history 는 일단 제외 — 향후 옵션화.
  const sender = msg.sender_name ?? 'unknown';
  const text = msg.text ?? '';
  return `${sender}: ${text}`;
}
