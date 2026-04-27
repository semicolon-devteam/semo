/**
 * semo guard — P5-7 PolicyEngine/HookGateway 시범.
 *
 * Claude Code lifecycle hook (~/.semo/shared/hooks/*.sh) 의 sh 스크립트를 단계적으로
 * TS/CLI 패턴으로 통일. 단일 진입점 (`semo guard run <name>`) + npm 배포 (위치 일관) +
 * 더 견고한 에러 처리 + 향후 ConsoleAuditSink/MetricsSink 통합 가능.
 *
 * 진행 (Codex 리뷰 2026-04-27): 기존 13 sh 유지 + 새 hook 부터 이 패턴 + 빈도 높은 1~2개만
 * 점진 포팅 (운영 영향 최소화). KB decision: policy-engine-vs-tool-gateway-2026-04-27.
 *
 * 첫 시범 guard:
 *   response-length: 봇 응답 20줄 초과 시 WARN 출력 (~/.semo/shared/hooks/response-length-guard.sh 와 동일).
 */

import { Command } from 'commander';

interface ResponseLengthInput {
  cwd?: string;
  last_assistant_message?: string;
}

const BOT_CWD_RE = /openclaw-[a-z]+\/workspace|semo-(bot-)?sessions\/|\.semo\/sessions\//;
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const LIMIT_DEFAULT = 20;

/**
 * stdin (Claude Code hook payload) 를 JSON 파싱. 비-JSON 또는 빈 입력 시 null.
 */
async function readStdinJson<T>(): Promise<T | null> {
  if (process.stdin.isTTY) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function registerGuardCommands(program: Command): void {
  const guardCmd = program
    .command('guard')
    .description('P5-7 PolicyEngine — Claude Code lifecycle hook TS 진입점');

  guardCmd
    .command('run <name>')
    .description('등록된 guard 실행 (stdin: Claude Code hook payload JSON)')
    .option('--limit <n>', 'response-length 등 임계 (기본 20)', '20')
    .action(async (name, options) => {
      const input = await readStdinJson<ResponseLengthInput>();

      switch (name) {
        case 'response-length': {
          if (!input) {
            // 입력 없으면 hook 정상 종료 (sh 동작과 동일)
            process.exit(0);
            return;
          }
          const cwd = input.cwd ?? '';
          const response = input.last_assistant_message ?? '';
          if (!response || !BOT_CWD_RE.test(cwd)) {
            process.exit(0);
            return;
          }
          const stripped = response.replace(CODE_BLOCK_RE, '');
          const lines = stripped.split('\n').filter((l) => l.trim().length > 0);
          const limit = Math.max(1, parseInt(options.limit, 10) || LIMIT_DEFAULT);
          if (lines.length > limit) {
            console.log(
              `WARN: 응답이 ${lines.length}줄입니다 (코드 블록 제외). 봇 응답은 ${limit}줄 이내를 권장합니다.`,
            );
          }
          process.exit(0);
          return;
        }
        default:
          console.error(`unknown guard: ${name}`);
          console.error(`available: response-length`);
          process.exit(2);
      }
    });

  guardCmd
    .command('list')
    .description('등록된 guard 목록')
    .action(() => {
      console.log('Available guards:');
      console.log('  response-length  — 봇 응답 20줄 초과 시 WARN');
      console.log('');
      console.log('호출:');
      console.log('  echo "{...}" | semo guard run response-length [--limit 20]');
    });
}
