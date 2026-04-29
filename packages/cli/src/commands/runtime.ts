/**
 * semo runtime — Runtime Portable HostAdapter 진단·smoke 명령.
 *
 * P6-0~6 단계 어댑터(claude-code/codex-cli/openclaw/ollama-cli/hermes-desktop) 의
 * probe() / dispatch() 를 cli 에서 직접 호출. 운영 흐름(slack-router → mailbox)에는
 * 침투하지 않는 진단 도구. KB hardcoding 없이 어댑터 인스턴스만 만들어 호출.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

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
}
