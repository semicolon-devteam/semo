/**
 * semo guard — P5-7 PolicyEngine/HookGateway 진입점.
 *
 * Claude Code lifecycle hook 의 sh 스크립트를 단계적으로 TS/CLI 패턴으로 통일.
 * 단일 진입점 (`semo guard run <name>`) + npm 배포 (위치 일관) + 견고한 에러 처리.
 *
 * 진행 (Codex 리뷰 2026-04-27): 기존 13 sh 유지 + 새 hook 부터 이 패턴.
 * KB decision: policy-engine-vs-tool-gateway-2026-04-27.
 *
 * 인터페이스 추상화: packages/common/src/runtime/hook-gateway.ts (P5-7 2단계).
 * 등록된 guard:
 *   response-length  — 봇 응답 20줄 초과 시 WARN
 *   kb-search-loop   — KB 검색 3회 + kb get 0회 시 BLOCK 메시지
 *   assertion        — 사실 주장에 출처 표기 없으면 WARN
 */

import { Command } from 'commander';
import * as fs from 'fs';
import {
  ConsolePolicyAuditSink,
  InMemoryHookGateway,
  type HookGuard,
  type HookPayload,
  type HookResult,
} from '@team-semicolon/semo-common';

const BOT_CWD_RE = /openclaw-[a-z]+\/workspace|semo-(bot-)?sessions\/|\.semo\/sessions\//;
const BOT_SESSION_ONLY_RE = /\.semo\/sessions\//;
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;
const LIMIT_DEFAULT = 20;
const LOOP_TAIL_LINES = 100;
const LOOP_SEARCH_RE = /semo\s+kb\s+search/;
const LOOP_GET_RE = /semo\s+kb\s+get/;
const LOOP_THRESHOLD = 3;
const ASSERTION_MIN_LINES = 3;
const ENTITY_NOUNS = /팀원|서비스|배포|버전|설정|인프라|서버|도메인|DB|데이터베이스|API|포트/;
const ASSERTION_TAIL = /(입니다|됩니다|있습니다|합니다)/;
const SOURCE_RE = /답변근거.*KB|\[KB\]|semo kb|KB 조회|https?:\/\/|GitHub|출처/;
const URL_RE = /https?:\/\/[^\s)\]>"']+/g;
const URL_WHITELIST = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'gist.github.com',
  'vercel.app',
  'vercel.com',
  'supabase.co',
  'supabase.com',
  'slack.com',
  'notion.so',
  'notion.site',
  'google.com',
  'googleapis.com',
  'docs.google.com',
  'npmjs.com',
  'npmjs.org',
  'registry.npmjs.org',
  'anthropic.com',
  'claude.ai',
  'semi-colon.space',
  'semicolon.dev',
  'localhost',
  '127.0.0.1',
  'naver.com',
  'kakao.com',
  'tistory.com',
  'pypi.org',
  'docs.python.org',
  'developer.mozilla.org',
  'stackoverflow.com',
  'linear.app',
  'figma.com',
  'miro.com',
  'sentry.io',
  'grafana.com',
  'openai.com',
  'platform.openai.com',
  'arxiv.org',
  'wikipedia.org',
]);

const PASS: HookResult = { exitCode: 0, level: 'pass' };

function normalizeAssistantMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join('\n');
  return '';
}

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

// ============================================================
// Guards (HookGuard 구현체)
// ============================================================

function makeResponseLengthGuard(limit: number): HookGuard {
  return {
    name: 'response-length',
    triggers: ['Stop'],
    botSessionOnly: true,
    description: '봇 응답 20줄 초과 시 WARN',
    async evaluate(payload: HookPayload | null): Promise<HookResult> {
      if (!payload) return PASS;
      const cwd = payload.cwd ?? '';
      const response = normalizeAssistantMessage(payload.last_assistant_message);
      if (!response || !BOT_CWD_RE.test(cwd)) return PASS;
      const stripped = response.replace(CODE_BLOCK_RE, '');
      const lines = stripped.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length > limit) {
        return {
          exitCode: 0,
          level: 'warn',
          message: `WARN: 응답이 ${lines.length}줄입니다 (코드 블록 제외). 봇 응답은 ${limit}줄 이내를 권장합니다.`,
        };
      }
      return PASS;
    },
  };
}

const KB_SEARCH_LOOP_GUARD: HookGuard = {
  name: 'kb-search-loop',
  triggers: ['Stop'],
  botSessionOnly: true,
  description: 'KB 검색 3회 + kb get 0회 시 BLOCK 메시지 출력',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const cwd = payload.cwd ?? '';
    const transcriptPath = payload.transcript_path ?? '';
    if (!BOT_SESSION_ONLY_RE.test(cwd) || !transcriptPath) return PASS;
    const searchCount = countTranscriptLines(transcriptPath, LOOP_SEARCH_RE, LOOP_TAIL_LINES);
    const getCount = countTranscriptLines(transcriptPath, LOOP_GET_RE, LOOP_TAIL_LINES);
    if (searchCount >= LOOP_THRESHOLD && getCount === 0) {
      return {
        exitCode: 0,
        level: 'block',
        message:
          `BLOCK: KB 검색이 ${searchCount}회 반복되었으나 \`semo kb get\`으로 확정 조회된 결과가 없습니다. ` +
          `'KB에 해당 정보가 없습니다'로 응답하세요.`,
      };
    }
    return PASS;
  },
};

function isWhitelistedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    for (const allowed of URL_WHITELIST) {
      if (host === allowed || host.endsWith('.' + allowed)) return true;
    }
    return false;
  } catch {
    // URL parse 실패 시 차단 안 함 (sh: try/except → True)
    return true;
  }
}

const URL_VALIDATOR_GUARD: HookGuard = {
  name: 'url-validator',
  triggers: ['Stop'],
  botSessionOnly: true,
  description: '봇 응답 URL 도메인 화이트리스트 검증 (hard block exit 1)',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const cwd = payload.cwd ?? '';
    const response = normalizeAssistantMessage(payload.last_assistant_message);
    if (!response || !BOT_CWD_RE.test(cwd)) return PASS;
    const stripped = response.replace(CODE_BLOCK_RE, '');
    const urls = stripped.match(URL_RE) ?? [];
    if (urls.length === 0) return PASS;
    const badUrls = urls.filter((u) => !isWhitelistedUrl(u));
    if (badUrls.length === 0) return PASS;
    const domains = new Set<string>();
    for (const u of badUrls) {
      try {
        domains.add(new URL(u).hostname);
      } catch {
        domains.add(u.slice(0, 50));
      }
    }
    return {
      exitCode: 1,
      level: 'block',
      message: `[URL-GUARD] 화이트리스트에 없는 도메인: ${Array.from(domains).join(', ')}. URL을 확인해주세요.`,
    };
  },
};

const ASSERTION_GUARD: HookGuard = {
  name: 'assertion',
  triggers: ['Stop'],
  botSessionOnly: true,
  description: '사실 주장에 출처 표기 없으면 WARN',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const cwd = payload.cwd ?? '';
    const response = normalizeAssistantMessage(payload.last_assistant_message);
    if (!response || !BOT_CWD_RE.test(cwd)) return PASS;
    let cleaned = response.replace(CODE_BLOCK_RE, '');
    cleaned = cleaned.replace(INLINE_CODE_RE, '');
    const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < ASSERTION_MIN_LINES) return PASS;
    const hasAssertion = cleaned
      .split('\n')
      .some((l) => ENTITY_NOUNS.test(l) && ASSERTION_TAIL.test(l));
    if (!hasAssertion) return PASS;
    if (SOURCE_RE.test(cleaned)) return PASS;
    return {
      exitCode: 0,
      level: 'warn',
      message:
        'WARN: 사실 주장이 포함되어 있으나 출처(KB/URL)가 명시되지 않았습니다. [답변근거: KB ...] 형식 권장.',
    };
  },
};

// ============================================================
// Singleton gateway 등록
// ============================================================

function buildGateway(limit: number): InMemoryHookGateway {
  const gateway = new InMemoryHookGateway({
    audit: process.env.SEMO_GUARD_AUDIT === '1' ? new ConsolePolicyAuditSink(true) : undefined,
  });
  gateway.register(makeResponseLengthGuard(limit));
  gateway.register(KB_SEARCH_LOOP_GUARD);
  gateway.register(ASSERTION_GUARD);
  gateway.register(URL_VALIDATOR_GUARD);
  return gateway;
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
      const limit = Math.max(1, parseInt(options.limit, 10) || LIMIT_DEFAULT);
      const gateway = buildGateway(limit);
      const payload = await readStdinJson<HookPayload>();
      const result = await gateway.run(name, payload);
      if (result.message) console.log(result.message);
      process.exit(result.exitCode);
    });

  guardCmd
    .command('list')
    .description('등록된 guard 목록')
    .action(() => {
      const gateway = buildGateway(LIMIT_DEFAULT);
      console.log('Available guards:');
      for (const g of gateway.list()) {
        console.log(`  ${g.name.padEnd(16)} — ${g.description}`);
      }
      console.log('');
      console.log('호출:');
      console.log('  echo "{...}" | semo guard run <name> [--limit 20]');
      console.log('');
      console.log('SEMO_GUARD_AUDIT=1 환경변수 설정 시 stderr 에 [guard-audit] 라인 기록.');
    });
}
