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
import * as fs from 'fs';

interface HookInput {
  cwd?: string;
  last_assistant_message?: string | string[];
  transcript_path?: string;
}

const BOT_CWD_RE = /openclaw-[a-z]+\/workspace|semo-(bot-)?sessions\/|\.semo\/sessions\//;
const BOT_SESSION_ONLY_RE = /\.semo\/sessions\//;
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const LIMIT_DEFAULT = 20;
const LOOP_TAIL_LINES = 100;
const LOOP_SEARCH_RE = /semo\s+kb\s+search/;
const LOOP_GET_RE = /semo\s+kb\s+get/;
const LOOP_THRESHOLD = 3;

/**
 * last_assistant_message 가 string 또는 string[] 양쪽 가능 (Claude SDK 변종).
 * Codex 리뷰 (2026-04-27) 등가성 케이스 반영.
 */
function normalizeAssistantMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join('\n');
  return '';
}

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

/** transcript jsonl tail 안에서 정규식 매칭 line 수 카운트. 파일 없거나 읽기 실패 시 0. */
function countTranscriptLines(transcriptPath: string, re: RegExp, tailLines: number): number {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return 0;
    const all = fs
      .readFileSync(transcriptPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    const tail = all.slice(-tailLines);
    let count = 0;
    for (const line of tail) {
      if (re.test(line)) count++;
    }
    return count;
  } catch {
    return 0;
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
      const input = await readStdinJson<HookInput>();

      switch (name) {
        case 'response-length': {
          if (!input) {
            process.exit(0);
            return;
          }
          const cwd = input.cwd ?? '';
          const response = normalizeAssistantMessage(input.last_assistant_message);
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
        case 'kb-search-loop': {
          if (!input) {
            process.exit(0);
            return;
          }
          const cwd = input.cwd ?? '';
          const transcriptPath = input.transcript_path ?? '';
          // Bot session only (sh: ~/.semo/sessions/ 만)
          if (!BOT_SESSION_ONLY_RE.test(cwd)) {
            process.exit(0);
            return;
          }
          if (!transcriptPath) {
            process.exit(0);
            return;
          }
          const searchCount = countTranscriptLines(transcriptPath, LOOP_SEARCH_RE, LOOP_TAIL_LINES);
          const getCount = countTranscriptLines(transcriptPath, LOOP_GET_RE, LOOP_TAIL_LINES);
          if (searchCount >= LOOP_THRESHOLD && getCount === 0) {
            console.log(
              `BLOCK: KB 검색이 ${searchCount}회 반복되었으나 \`semo kb get\`으로 확정 조회된 결과가 없습니다. ` +
                `'KB에 해당 정보가 없습니다'로 응답하세요.`,
            );
          }
          process.exit(0);
          return;
        }
        default:
          console.error(`unknown guard: ${name}`);
          console.error(`available: response-length, kb-search-loop`);
          process.exit(2);
      }
    });

  guardCmd
    .command('list')
    .description('등록된 guard 목록')
    .action(() => {
      console.log('Available guards:');
      console.log('  response-length  — 봇 응답 20줄 초과 시 WARN');
      console.log('  kb-search-loop   — KB 검색 3회 + kb get 0회 시 BLOCK 메시지 출력');
      console.log('');
      console.log('호출:');
      console.log('  echo "{...}" | semo guard run response-length [--limit 20]');
      console.log('  echo "{...}" | semo guard run kb-search-loop');
    });
}
