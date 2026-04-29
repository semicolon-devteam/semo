/**
 * semo bots inbox-pump — inbox delivery transport daemon (Phase 4 / Codex 권고 B+C).
 *
 * 비전(2026-04-29 reus): 봇이 inbox 새 메시지를 능동 폴링 안 함. agent-mailbox MCP
 * notification 은 silent fail 중. → 외부 daemon이 fs.watch + cmux send 로 봇 pane 에
 * "inbox 처리해줘" prompt 자동 입력 → 봇이 user message 로 인식하고 처리.
 *
 * 역할 분리 (Codex 권고):
 *   - agent-mailbox (기존): storage / MCP API
 *   - inbox-pump (이 파일): delivery transport (fs.watch → cmux send)
 *
 * 미래 마이그레이션 (옵션 A): MCP notification spec 표준화 시 cmux send 부분만 교체.
 *   thin adapter 로 작성 — DeliveryAdapter 인터페이스.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

interface SurfaceMap {
  workspace: string;
  surfaces: Record<string, string>;
}

interface BotState {
  pendingCount: number;
  /** 마지막 cmux send 시각 — 너무 잦은 재전송 방지. */
  lastSentAt: number;
  /** 마지막으로 본 inbox.jsonl 파일 크기 (변화 감지용). */
  lastInboxSize: number;
}

const POLL_INTERVAL_MS = 3_000;
const MIN_RESEND_GAP_MS = 30_000; // 같은 봇에 30초 내 중복 prompt 금지

function loadSurfaceMap(): SurfaceMap {
  const mapPath = process.env.SEMO_SURFACE_MAP || '/tmp/semo-surface-map.json';
  try {
    return JSON.parse(fs.readFileSync(mapPath, 'utf8')) as SurfaceMap;
  } catch {
    return { workspace: process.env.SEMO_WORKSPACE || 'semo-agents', surfaces: {} };
  }
}

function semoMailboxDir(): string {
  return process.env.SEMO_MAILBOX_DIR ?? path.join(os.homedir(), '.semo', 'mailbox');
}

/** inbox.jsonl 와 inbox.consumed 비교 → pending 메시지 개수. */
function countPending(mailboxDir: string, botId: string): number {
  const inboxPath = path.join(mailboxDir, botId, 'inbox.jsonl');
  const consumedPath = path.join(mailboxDir, botId, 'inbox.consumed');
  if (!fs.existsSync(inboxPath)) return 0;
  const consumed = new Set<string>();
  if (fs.existsSync(consumedPath)) {
    for (const line of fs.readFileSync(consumedPath, 'utf8').split('\n')) {
      const id = line.trim();
      if (id) consumed.add(id);
    }
  }
  let pending = 0;
  for (const line of fs.readFileSync(inboxPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed) as { id?: string };
      if (msg.id && !consumed.has(msg.id)) pending++;
    } catch {
      // ignore non-json
    }
  }
  return pending;
}

/**
 * cmux pane 화면에서 봇 상태 추정.
 *
 * 'alive': Claude Code UI 표시 (prompt + bypass permissions footer)
 * 'busy':  alive + 응답 생성 중 (esc to interrupt / thinking)
 * 'dead':  Claude Code UI 없음 (zsh shell 등) — cmux send 시 zsh 가 prompt 를 명령으로 해석
 */
type BotPaneState = 'idle' | 'busy' | 'dead';

async function readBotPane(workspace: string, surface: string): Promise<BotPaneState> {
  try {
    const { stdout } = await execFileP(
      'cmux',
      ['read-screen', '--workspace', workspace, '--surface', surface, '--lines', '30'],
      { timeout: 5_000 },
    );
    // Claude Code alive 신호 — bypass permissions footer 또는 ⏵⏵ marker
    const isAlive = /bypass permissions|shift\+tab to cycle/.test(stdout);
    if (!isAlive) return 'dead';
    if (
      /esc to interrupt|Noodling|Sautéed for|Brewed for|Accomplishing|Fluttering|thinking/i.test(
        stdout,
      )
    ) {
      return 'busy';
    }
    return 'idle';
  } catch {
    // cmux read 실패 — 보수적으로 busy 처리 (잘못된 send 회피).
    return 'busy';
  }
}

async function sendToPane(workspace: string, surface: string, text: string): Promise<void> {
  await execFileP('cmux', ['send', '--workspace', workspace, '--surface', surface, text], {
    timeout: 5_000,
  });
  // newline 별도 전송 — 한글/특수문자 시 1 send에 포함하면 newline 누락 케이스 회피
  // (KB feedback_cmux-send-newline 참조).
  await execFileP('cmux', ['send', '--workspace', workspace, '--surface', surface, '\n'], {
    timeout: 5_000,
  });
}

function buildPrompt(botId: string, pendingCount: number): string {
  return [
    `[inbox-pump] ${pendingCount}건의 새 inbox 메시지가 있어.`,
    `agent-mailbox MCP \`check_inbox\` / \`read_message\` 로 가져와서 처리해줘.`,
    `메시지에 \`routing_hint.suggested_bot_id\` 가 있고 \`score>=2\` 면 즉시 그 봇에 \`escalate\` (또는 Task) 위임.`,
    `score=1 이면 의도 판단 후 위임 또는 직접 처리. hint 없으면 ${botId} 본인 처리.`,
  ].join(' ');
}

export function registerInboxPumpCommand(parent: Command): void {
  parent
    .command('inbox-pump')
    .description(
      'inbox 새 메시지 발견 시 봇 pane 에 prompt 자동 입력 (delivery transport daemon, Codex B+C)',
    )
    .option('--bot <id>', '특정 봇만 watch (기본: SEMO_SURFACE_MAP 의 모든 봇)')
    .option('--interval-ms <n>', '폴링 주기 ms', String(POLL_INTERVAL_MS))
    .option('--once', '단발 검사 후 종료 (테스트용)')
    .option('--dry-run', 'cmux send 시뮬만 (실 전송 안 함)')
    .action(
      async (opts: { bot?: string; intervalMs: string; once?: boolean; dryRun?: boolean }) => {
        const surfaceMap = loadSurfaceMap();
        if (Object.keys(surfaceMap.surfaces).length === 0) {
          console.error(
            chalk.red(
              '✗ SEMO_SURFACE_MAP 비어있음 — semo-agents-start.sh 로 워크스페이스 셋업 필요.',
            ),
          );
          process.exit(1);
        }

        const botIds = opts.bot
          ? [opts.bot]
          : Object.keys(surfaceMap.surfaces).filter((b) => surfaceMap.surfaces[b]);

        const mboxDir = semoMailboxDir();
        const intervalMs = Math.max(1000, Number(opts.intervalMs));
        const states = new Map<string, BotState>();

        console.log(chalk.cyan.bold('\n📬 inbox-pump\n'));
        console.log(`  workspace:  ${chalk.green(surfaceMap.workspace)}`);
        console.log(`  bots:       ${chalk.green(botIds.join(', '))}`);
        console.log(`  mailbox:    ${chalk.gray(mboxDir)}`);
        console.log(`  interval:   ${intervalMs}ms`);
        console.log(
          `  mode:       ${opts.once ? 'once' : 'forever'}${opts.dryRun ? ' (dry-run)' : ''}\n`,
        );

        let stopRequested = false;
        const onShutdown = (signal: string) => {
          if (stopRequested) return;
          stopRequested = true;
          console.log(chalk.yellow(`\n[pump] ${signal} 수신 — graceful shutdown...`));
        };
        process.on('SIGINT', () => onShutdown('SIGINT'));
        process.on('SIGTERM', () => onShutdown('SIGTERM'));

        const sleep = (ms: number) =>
          new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

        let totalSent = 0;
        let totalSkipped = 0;

        while (!stopRequested) {
          for (const botId of botIds) {
            if (stopRequested) break;
            const surface = surfaceMap.surfaces[botId];
            if (!surface) continue;

            const inboxPath = path.join(mboxDir, botId, 'inbox.jsonl');
            const inboxSize = fs.existsSync(inboxPath) ? fs.statSync(inboxPath).size : 0;
            const prevState = states.get(botId);

            // inbox.jsonl 크기 변화 + pending count 변화 감지
            if (prevState && prevState.lastInboxSize === inboxSize) continue;

            const pending = countPending(mboxDir, botId);
            const newState: BotState = {
              pendingCount: pending,
              lastSentAt: prevState?.lastSentAt ?? 0,
              lastInboxSize: inboxSize,
            };

            if (pending === 0) {
              states.set(botId, newState);
              continue;
            }

            // 중복 prompt 방지 — 30초 내 같은 봇에 send 한 적 있으면 skip
            const sinceLastSend = Date.now() - newState.lastSentAt;
            if (sinceLastSend < MIN_RESEND_GAP_MS) {
              totalSkipped++;
              states.set(botId, newState);
              continue;
            }

            // 봇 pane 상태 검사
            const paneState = await readBotPane(surfaceMap.workspace, surface);
            const ts = new Date().toISOString().slice(11, 19);
            if (paneState === 'dead') {
              // Claude Code UI 없음 (zsh shell 등) — send 하면 zsh 가 prompt 를 명령으로 해석.
              // HealthMonitor 가 재시작 책임. inbox-pump 는 skip + warn.
              console.log(
                chalk.yellow(
                  `[pump] ${ts} ⚠ ${botId} dead (Claude Code UI 없음) — health monitor 영역. skip (pending=${pending})`,
                ),
              );
              totalSkipped++;
              states.set(botId, newState);
              continue;
            }
            if (paneState === 'busy') {
              console.log(
                chalk.gray(`[pump] ${ts} ${botId} busy — queue 유지 (pending=${pending})`),
              );
              totalSkipped++;
              states.set(botId, newState);
              continue;
            }

            const prompt = buildPrompt(botId, pending);
            if (opts.dryRun) {
              console.log(
                chalk.cyan(`[pump] ${ts} (dry-run) → ${botId}@${surface} pending=${pending}`),
              );
              console.log(chalk.gray(`         prompt: ${prompt.slice(0, 80)}...`));
            } else {
              try {
                await sendToPane(surfaceMap.workspace, surface, prompt);
                newState.lastSentAt = Date.now();
                totalSent++;
                console.log(
                  chalk.green(`[pump] ${ts} ✓ ${botId}@${surface} sent (pending=${pending})`),
                );
              } catch (err) {
                console.error(
                  chalk.red(
                    `[pump] ${ts} ✗ ${botId}@${surface} cmux send 실패: ${(err as Error).message}`,
                  ),
                );
              }
            }

            states.set(botId, newState);
          }

          if (opts.once) break;
          await sleep(intervalMs);
        }

        console.log(chalk.gray(`\n[pump] 종료. sent=${totalSent}, skipped=${totalSkipped}`));
        process.exit(0);
      },
    );
}
