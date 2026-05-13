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
import * as os from 'os';
import * as path from 'path';
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

// kb-first
const KB_TOPICS_RE = /서비스|프로젝트|인프라|배포|KPI|의사결정|인시던트|팀원|담당자|현황|상태/;
const KB_EVIDENCE_RE = /semo kb|KB.*조회|답변근거.*KB|\[KB\]|kb_search|kb_get|semo service/;
const KB_TRANSCRIPT_TAIL = 30;
const KB_TRANSCRIPT_TOOL_RE = /semo kb|semo service|kb_search|kb_get/;

// decision-reminder
const DECISION_KB_INPROGRESS_RE = /KB 기록:|semo kb upsert|KB upsert 완료|답변근거: KB/;
const DECISION_DISMISS_RE =
  /(?:KB 기록 불필요|기록 대상[이가]? 아닙?|false positive|DECISION REMINDER|기록할 필요|실제 의사결정이 아닌?|설명[만일]? 한 것|가상 (?:예시|시나리오)|hook.*(?:반복|루프|개선))/i;
const DECISION_KEYWORDS_RE =
  /(?:도입했|폐기했|전환했|적용했|배포했|마이그레이션|변경했|합의했|결정했|도입합니다|폐기합니다|전환합니다|적용합니다|배포합니다|도입 완료|폐기 완료|전환 완료|적용 완료|배포 완료|표준화했|통합했|분리했|추가했|제거했|Phase \d+ 완료|설정을? 변경|규칙을? 변경|프로세스를? 변경|NON-NEGOTIABLE|신규 생성|전체 배포)/g;
const DECISION_TRANSCRIPT_TAIL = 50;

// context-router — SEMO_HOME ?? ~/.semo 기반 portable path (Codex 리뷰: OSS 배포 호환)
function defaultContextRouterConfPath(): string {
  const semoHome = process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
  return path.join(semoHome, 'shared', 'hooks', 'context-router.conf');
}

// skill-mirror — bot mirror SKILL.md 경로
const SKILL_MIRROR_PATH_RE = /\/\.claude\/semo\/bots\/[^/]+\/skills\/([^/]+)\/SKILL\.md$/;

// destructive-guard — Bash 도구의 파괴적 패턴
const DESTRUCTIVE_PATTERNS: Array<[RegExp, string]> = [
  [/rm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)*\/(?!tmp)/i, 'rm -rf on root or system paths'],
  [/rm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)*~/i, 'rm -rf on home directory'],
  [/git\s+reset\s+--hard/i, 'git reset --hard'],
  [/git\s+push\s+(--force|-f)\b/i, 'git push --force'],
  [/git\s+clean\s+-[a-zA-Z]*[fd]/i, 'git clean with force/directory flags'],
  // gstack /careful 흡수 패턴 (2026-05-13, KB decision/superpowers-gstack-adoption-...)
  [/git\s+(checkout|restore)\s+\.\s*$/i, 'git checkout/restore working tree'],
  [/DROP\s+TABLE/i, 'SQL DROP TABLE'],
  [/DROP\s+SCHEMA/i, 'SQL DROP SCHEMA'],
  [/DROP\s+DATABASE/i, 'SQL DROP DATABASE'],
  [/TRUNCATE\s+TABLE/i, 'SQL TRUNCATE TABLE'],
  [/DELETE\s+FROM\s+\w+\s*;/i, 'SQL DELETE FROM without WHERE clause'],
  [/chmod\s+(-R\s+)?777/i, 'chmod 777'],
  [/mkfs\./i, 'filesystem format command'],
  [/dd\s+.*of=\/dev\//i, 'dd write to block device'],
  [/kubectl\s+delete\b/i, 'kubectl delete'],
  [/docker\s+rm\s+-[a-zA-Z]*f/i, 'docker rm --force'],
  [/docker\s+system\s+prune(\s+-[a-zA-Z]*a)?/i, 'docker system prune'],
];

// Safe rm targets — 빌드 산출물은 봇이 clean 가능 (gstack /careful 패턴)
const SAFE_RM_TARGETS = new Set([
  'node_modules',
  '.next',
  'dist',
  '__pycache__',
  '.cache',
  'build',
  '.turbo',
  'coverage',
]);

/** `rm -rf <targets>` 가 모두 안전 디렉토리(빌드 산출물)만 대상으로 하면 true. */
function isOnlySafeRm(command: string): boolean {
  // "rm <flags> <targets>" 만 처리. 다른 명령과 결합되면 false (보수적)
  if (!/^\s*rm\s+/i.test(command)) return false;
  if (/[;&|]|\$\(|`/.test(command)) return false; // shell composition → 보수 처리
  const after = command.replace(/^\s*rm\s+/i, '');
  const tokens = after.split(/\s+/).filter(Boolean);
  const targets = tokens.filter((t) => !t.startsWith('-'));
  if (targets.length === 0) return false;
  return targets.every((t) => {
    const norm = t.replace(/^\.\//, '').replace(/\/+$/, '');
    return SAFE_RM_TARGETS.has(norm);
  });
}

// compact 짝 — state file + threshold conf (SEMO_HOME 호환)
function semoStateDir(): string {
  const semoHome = process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
  return path.join(semoHome, 'state');
}
function autoCompactConfPath(): string {
  const semoHome = process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
  return path.join(semoHome, 'shared', 'auto-compact.conf');
}
function autoCompactLogPath(): string {
  const semoHome = process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
  return path.join(semoHome, 'logs', 'auto-compact.log');
}
const AUTO_COMPACT_DEFAULT_THRESHOLD = 50;

function appendAutoCompactLog(msg: string): void {
  try {
    const logPath = autoCompactLogPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const ts = new Date().toISOString();
    fs.appendFileSync(logPath, `${ts} ${msg}\n`);
  } catch {
    /* ignore */
  }
}

function loadAutoCompactThreshold(botId: string): number {
  const conf = autoCompactConfPath();
  if (!fs.existsSync(conf)) return AUTO_COMPACT_DEFAULT_THRESHOLD;
  let result = AUTO_COMPACT_DEFAULT_THRESHOLD;
  let foundDefault = false;
  try {
    for (const line of fs.readFileSync(conf, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = parseInt(t.slice(eq + 1).trim(), 10);
      if (Number.isNaN(v)) continue;
      if (k === botId) {
        return v; // bot 별 명시 값 우선
      }
      if (k === 'DEFAULT' && !foundDefault) {
        result = v;
        foundDefault = true;
      }
    }
  } catch {
    /* ignore */
  }
  return result;
}

function compactBotIdFromCwd(cwd: string): string {
  let m = cwd.match(/semo[-_](?:bot[-_])?sessions\/([a-z]+)/);
  if (m) return m[1];
  m = cwd.match(/\.semo\/sessions\/([a-z]+)/);
  if (m) return m[1];
  return '';
}

// commitment-guard — Korean 미래 약속 패턴
const COMMITMENT_RE =
  /(?:처리|검토|진행|구현|수정|배포|확인|보고|등록|완료|작성|분석|조사)하겠|할게요|할 예정|약속하겠|약속합니다|드리겠습니다|해드리겠/;
const COMMITMENT_EXCLUDE_RE = /했습니다|였습니다|었습니다|알겠습니다|네.*겠습니다/;
const COMMITMENT_STRONG_RE = /처리하겠|진행하겠|구현하겠|배포하겠/;
const COMMITMENT_REGISTERED_RE = /cmt-[a-zA-Z0-9]+|commitment.*등록|약속.*등록/;

function extractBotIdFromCwd(cwd: string): string {
  let m = cwd.match(/openclaw-([a-z]+)\/workspace/);
  if (m) return m[1];
  m = cwd.match(/semo-(?:bot-)?sessions\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = cwd.match(/\.semo\/sessions\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return '';
}
const CONTEXT_HINTS: Record<string, string> = {
  KB: '[KB-FIRST] 이 질문은 KB 조회가 필요합니다. semo kb search 또는 semo kb get으로 먼저 확인하세요.',
  LOCAL: '[LOCAL-CONFIG] 로컬 설정/워크스페이스 관련 질문입니다.',
  GFP: '[GFP] 프로젝트 파이프라인 관련 질문입니다.',
  INFRA: '[INFRA] 인프라 관련 질문입니다. KB에서 infra 도메인을 먼저 확인하세요.',
  CODE_CHANGE: '[CODE-CHANGE] 코드 변경 작업입니다. 3자 동기화에 유의하세요.',
};

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

/** transcript tail 의 raw 텍스트 합본 (kb-first 의 단순 문자열 검색 용). */
function tailTranscriptText(transcriptPath: string, tailLines: number): string {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return '';
    const all = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    return all.slice(-tailLines).join('\n');
  } catch {
    return '';
  }
}

/** transcript tail 의 jsonl 파싱 — decision-reminder 가 사용 (role/content 분석). */
interface TranscriptEntry {
  role?: string;
  content?: unknown;
  message?: TranscriptEntry;
}
function parseTranscriptTail(transcriptPath: string, tailLines: number): TranscriptEntry[] {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return [];
    const all = fs
      .readFileSync(transcriptPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    const tail = all.slice(-tailLines);
    const out: TranscriptEntry[] = [];
    for (const line of tail) {
      try {
        out.push(JSON.parse(line) as TranscriptEntry);
      } catch {
        /* skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** context-router conf 파일 로드 — 'CATEGORY|kw1|kw2|...' 한 줄씩. 없으면 빈 맵. */
function loadContextRouterConf(confPath: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  try {
    if (!fs.existsSync(confPath)) return out;
    const raw = fs.readFileSync(confPath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('|');
      if (idx < 0) continue;
      const cat = t.slice(0, idx).trim();
      const kws = t
        .slice(idx + 1)
        .split('|')
        .map((k) => k.trim())
        .filter(Boolean);
      const prev = out.get(cat) ?? [];
      out.set(cat, prev.concat(kws));
    }
  } catch {
    /* ignore */
  }
  return out;
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

const KB_FIRST_GUARD: HookGuard = {
  name: 'kb-first',
  triggers: ['Stop'],
  botSessionOnly: true,
  description: 'KB 관련 응답에 KB 조회 흔적 없으면 WARN',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const cwd = payload.cwd ?? '';
    const response = normalizeAssistantMessage(payload.last_assistant_message);
    if (!response || !BOT_CWD_RE.test(cwd)) return PASS;
    let cleaned = response.replace(CODE_BLOCK_RE, '');
    cleaned = cleaned.replace(INLINE_CODE_RE, '');
    if (!KB_TOPICS_RE.test(cleaned)) return PASS;
    if (KB_EVIDENCE_RE.test(response)) return PASS;
    const transcriptPath = payload.transcript_path ?? '';
    if (transcriptPath) {
      const tail = tailTranscriptText(transcriptPath, KB_TRANSCRIPT_TAIL);
      if (KB_TRANSCRIPT_TOOL_RE.test(tail)) return PASS;
    }
    return {
      exitCode: 0,
      level: 'warn',
      message:
        'WARN: KB 관련 응답이지만 KB 조회 흔적이 없습니다. semo kb search로 먼저 확인하세요.',
    };
  },
};

const DECISION_REMINDER_GUARD: HookGuard = {
  name: 'decision-reminder',
  triggers: ['Stop'],
  botSessionOnly: false, // sh 와 동일 — bot session 한정 X (로컬 세션 포함)
  description: '의사결정 키워드 감지 시 KB 기록 안 했으면 BLOCK + JSON reason',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const lastMsg = normalizeAssistantMessage(payload.last_assistant_message);
    if (!lastMsg) return PASS;
    let cleaned = lastMsg.replace(CODE_BLOCK_RE, '');
    cleaned = cleaned.replace(INLINE_CODE_RE, '');
    // 이미 KB 기록 중 또는 dismiss 응답이면 통과
    if (DECISION_KB_INPROGRESS_RE.test(cleaned)) return PASS;
    if (DECISION_DISMISS_RE.test(cleaned)) return PASS;
    // decision keywords 매칭
    const matches = cleaned.match(DECISION_KEYWORDS_RE);
    if (!matches || matches.length === 0) return PASS;
    // transcript tail 50줄에서 kb upsert 또는 이전 DECISION REMINDER 있으면 통과
    const transcriptPath = payload.transcript_path ?? '';
    if (transcriptPath) {
      const entries = parseTranscriptTail(transcriptPath, DECISION_TRANSCRIPT_TAIL);
      let kbRecorded = false;
      let alreadyReminded = false;
      for (const entry of entries) {
        const msg = entry.message ?? entry;
        const role = msg.role;
        if (role === 'system' || role === 'user') {
          const content = typeof msg.content === 'string' ? msg.content : '';
          if (content.includes('DECISION REMINDER')) alreadyReminded = true;
        } else if (role === 'assistant') {
          const blocks = Array.isArray(msg.content) ? msg.content : [];
          for (const block of blocks) {
            if (
              block &&
              typeof block === 'object' &&
              (block as { type?: string }).type === 'tool_use'
            ) {
              const inp = JSON.stringify((block as { input?: unknown }).input ?? {});
              if (inp.includes('kb upsert') || inp.includes('kb_upsert')) kbRecorded = true;
            }
          }
        } else if (role === 'tool') {
          const c = msg.content;
          const text = Array.isArray(c) ? c.map(String).join(' ') : String(c ?? '');
          if (text.includes('KB upsert') || text.includes('upsert 완료')) kbRecorded = true;
        }
      }
      if (kbRecorded || alreadyReminded) return PASS;
    }
    const unique = Array.from(new Set(matches)).slice(0, 3);
    const patterns = unique.join('|');
    const reason = `[DECISION REMINDER] 의사결정/변경 감지: ${patterns}. KB 기록이 필요하면 semo kb upsert <domain> decision/<slug> --content '...'로 기록하세요. 기록 불필요하면 원래 답변을 그대로 다시 보내세요.`;
    return {
      exitCode: 0,
      level: 'block',
      message: JSON.stringify({ decision: 'block', reason }, undefined, 0),
    };
  },
};

const SKILL_MIRROR_GUARD: HookGuard = {
  name: 'skill-mirror',
  triggers: ['PreToolUse'],
  botSessionOnly: false,
  description: 'bot mirror SKILL.md 직접 수정 시 WARN (semo skill edit 안내)',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const toolName = (payload.tool_name as string | undefined) ?? '';
    if (toolName !== 'Edit' && toolName !== 'Write') return PASS;
    const filePath =
      ((payload.tool_input as Record<string, unknown> | undefined)?.file_path as
        | string
        | undefined) ?? '';
    const m = filePath.match(SKILL_MIRROR_PATH_RE);
    if (!m) return PASS;
    return {
      exitCode: 0,
      level: 'warn',
      message: `⚠️ 이 경로는 DB sync에 의해 덮어써집니다.\n→ \`semo skill edit ${m[1]}\` 명령을 사용하세요.`,
    };
  },
};

const DESTRUCTIVE_GUARD: HookGuard = {
  name: 'destructive',
  triggers: ['PreToolUse'],
  botSessionOnly: true,
  description: 'Bash 도구의 파괴적 명령 차단 (deny JSON)',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const cwd = payload.cwd ?? '';
    if (!BOT_CWD_RE.test(cwd)) return PASS;
    const toolName = (payload.tool_name as string | undefined) ?? '';
    if (toolName !== 'Bash') return PASS;
    const command =
      ((payload.tool_input as Record<string, unknown> | undefined)?.command as
        | string
        | undefined) ?? '';
    if (!command) return PASS;
    // gstack-style safe exception — 봇이 빌드 산출물 clean 가능하게
    if (isOnlySafeRm(command)) return PASS;
    const found: string[] = [];
    for (const [re, desc] of DESTRUCTIVE_PATTERNS) {
      if (re.test(command)) found.push(desc);
    }
    if (found.length === 0) return PASS;
    const reason = `[DESTRUCTIVE GUARD] 차단: ${found.join(', ')}. 이 명령은 봇 세션에서 실행할 수 없습니다. 안전한 대안을 사용하세요.`;
    return {
      exitCode: 0,
      level: 'block',
      message: JSON.stringify({ decision: 'deny', reason }, undefined, 0),
    };
  },
};

function makeCommitmentGuard(commitmentsCheck: (botId: string) => Promise<boolean>): HookGuard {
  return {
    name: 'commitment',
    triggers: ['Stop'],
    botSessionOnly: true,
    description: 'Korean 미래 약속 패턴 감지 + commitments 미등록 시 BLOCK exit 1',
    async evaluate(payload: HookPayload | null): Promise<HookResult> {
      if (!payload) return PASS;
      const cwd = payload.cwd ?? '';
      const response = normalizeAssistantMessage(payload.last_assistant_message);
      if (!response || !BOT_CWD_RE.test(cwd)) return PASS;
      const botId = extractBotIdFromCwd(cwd);
      if (!botId) return PASS;
      let cleaned = response.replace(CODE_BLOCK_RE, '');
      cleaned = cleaned.replace(INLINE_CODE_RE, '');
      if (!COMMITMENT_RE.test(cleaned)) return PASS;
      // 단순 인사 (했습니다/알겠습니다) + strong 패턴 미존재 시 통과
      if (COMMITMENT_EXCLUDE_RE.test(cleaned) && !COMMITMENT_STRONG_RE.test(cleaned)) return PASS;
      // 응답에 commitment 등록 흔적 있으면 통과
      if (COMMITMENT_REGISTERED_RE.test(cleaned)) return PASS;
      // 활성 commitments 있으면 통과 (CLI 호출)
      try {
        const hasActive = await commitmentsCheck(botId);
        if (hasActive) return PASS;
      } catch {
        // CLI 실패 시 차단하지 않음 (sh 동일)
        return PASS;
      }
      const m = cleaned.match(COMMITMENT_RE);
      const phrase = m ? m[0] : '약속 패턴';
      return {
        exitCode: 1,
        level: 'block',
        message: `[COMMITMENT-GUARD] 미래 약속 패턴 감지 ("${phrase}"). semo commitments create로 먼저 약속을 등록하세요.`,
      };
    },
  };
}

/**
 * 실 commitments 확인 — `semo commitments list --bot-id <id> --status active` 호출 후
 * stdout 에 'active' 또는 'in_progress' 포함 시 true.
 */
async function checkActiveCommitments(botId: string): Promise<boolean> {
  const { execFileSync } = await import('node:child_process');
  try {
    const out = execFileSync(
      'semo',
      ['commitments', 'list', '--bot-id', botId, '--status', 'active'],
      { timeout: 5000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).toLowerCase();
    return out.includes('active') || out.includes('in_progress');
  } catch {
    throw new Error('commitments cli failure');
  }
}

const COMPACT_RESET_GUARD: HookGuard = {
  name: 'compact-reset',
  triggers: ['Stop'], // settings.json 의 PostCompact 매핑은 호출처 책임
  botSessionOnly: true,
  description: 'PostCompact: turn counter 리셋 (compact 완료 후)',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const cwd = payload.cwd ?? '';
    const botId = compactBotIdFromCwd(cwd);
    if (!botId) return PASS;
    const counterPath = path.join(semoStateDir(), botId, 'turn-counter');
    let prev = 0;
    if (fs.existsSync(counterPath)) {
      try {
        prev = parseInt(fs.readFileSync(counterPath, 'utf8').trim(), 10) || 0;
      } catch {
        /* ignore */
      }
    }
    try {
      fs.mkdirSync(path.dirname(counterPath), { recursive: true });
      fs.writeFileSync(counterPath, '0');
    } catch {
      return PASS;
    }
    appendAutoCompactLog(`[${botId}] compact_completed, counter_reset (was ${prev})`);
    return PASS;
  },
};

interface CompactSendCommand {
  /** compact 트리거 시 호출. 실패 시 throw 또는 false 반환. */
  send(botId: string): Promise<boolean>;
}

class CmuxCompactSender implements CompactSendCommand {
  async send(botId: string): Promise<boolean> {
    try {
      const { execFileSync } = await import('node:child_process');
      const id = execFileSync('cmux', ['identify'], { timeout: 5000, encoding: 'utf8' });
      const info = JSON.parse(id) as { caller?: { workspace_ref?: string; surface_ref?: string } };
      const ws = info.caller?.workspace_ref;
      const surface = info.caller?.surface_ref;
      if (!ws || !surface) {
        appendAutoCompactLog(`[${botId}] cmux identify missing ws/surface`);
        return false;
      }
      execFileSync('cmux', ['send', '--workspace', ws, '--surface', surface, '/compact\n'], {
        timeout: 5000,
      });
      appendAutoCompactLog(`[${botId}] cmux send /compact success (ws=${ws}, surface=${surface})`);
      return true;
    } catch (err) {
      appendAutoCompactLog(`[${botId}] cmux send error: ${(err as Error).message}`);
      return false;
    }
  }
}

class NoopCompactSender implements CompactSendCommand {
  async send(botId: string): Promise<boolean> {
    appendAutoCompactLog(`[${botId}] compact-sender disabled (no-op)`);
    return false;
  }
}

function defaultCompactSender(): CompactSendCommand {
  // env 로 명시적 비활성 가능 — Codex 권고: cli core 에 cmux 강한 의존 회피
  if (process.env.SEMO_AUTOCOMPACT_DISABLE === '1') return new NoopCompactSender();
  return new CmuxCompactSender();
}

function makeAutoCompactCounterGuard(sender: CompactSendCommand): HookGuard {
  return {
    name: 'auto-compact-counter',
    triggers: ['Stop'],
    botSessionOnly: true,
    description: '턴 카운터 증가 + threshold 도달 시 compact 트리거 (cmux 옵션)',
    async evaluate(payload: HookPayload | null): Promise<HookResult> {
      if (!payload) return PASS;
      const cwd = payload.cwd ?? '';
      const botId = compactBotIdFromCwd(cwd);
      if (!botId) return PASS;

      const threshold = loadAutoCompactThreshold(botId);
      const counterPath = path.join(semoStateDir(), botId, 'turn-counter');
      let counter = 0;
      if (fs.existsSync(counterPath)) {
        try {
          counter = parseInt(fs.readFileSync(counterPath, 'utf8').trim(), 10) || 0;
        } catch {
          /* ignore */
        }
      }
      counter += 1;
      try {
        fs.mkdirSync(path.dirname(counterPath), { recursive: true });
        fs.writeFileSync(counterPath, String(counter));
      } catch {
        return PASS;
      }

      const warningAt = Math.floor(threshold * 0.8);
      const remaining = threshold - counter;
      if (counter === warningAt) {
        appendAutoCompactLog(
          `[${botId}] warning: ${remaining}턴 후 auto-compact 예정 (현재 ${counter}/${threshold})`,
        );
        return {
          exitCode: 0,
          level: 'warn',
          message: JSON.stringify({
            decision: 'approve',
            additionalContext: `[AUTO-COMPACT] compact가 ${remaining}턴 후 실행됩니다. 보존할 컨텍스트가 있으면 ${path.dirname(counterPath)}/compact-context.md에 저장하세요.`,
          }),
        };
      }
      if (counter >= threshold) {
        appendAutoCompactLog(
          `[${botId}] threshold=${threshold}, turns=${counter}, action=compact_sent`,
        );
        await sender.send(botId);
      }
      return PASS;
    },
  };
}

function makeContextRouterGuard(confPath: string): HookGuard {
  return {
    name: 'context-router',
    triggers: ['UserPromptSubmit'],
    botSessionOnly: false,
    description: '사용자 메시지 키워드 → KB/GFP/INFRA 컨텍스트 힌트 주입',
    async evaluate(payload: HookPayload | null): Promise<HookResult> {
      if (!payload) return PASS;
      const msg = (payload.user_message as string | undefined) ?? '';
      const cwd = payload.cwd ?? '';
      if (!msg) return PASS;
      const isBot = BOT_CWD_RE.test(cwd);
      const categories = loadContextRouterConf(confPath);
      const hintsToPrint: string[] = [];
      for (const [cat, kws] of categories) {
        if (kws.length === 0) continue;
        // sh: re.escape 후 join → 변경 (정규식 special char 보존)
        const pattern = new RegExp(
          kws.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
          'i',
        );
        if (!pattern.test(msg)) continue;
        if (cat === 'KB' && !isBot) continue;
        const hint = CONTEXT_HINTS[cat];
        if (hint) hintsToPrint.push(hint);
      }
      if (hintsToPrint.length === 0) return PASS;
      return {
        exitCode: 0,
        level: 'pass',
        message: hintsToPrint.join('\n'),
      };
    },
  };
}

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
  gateway.register(KB_FIRST_GUARD);
  gateway.register(DECISION_REMINDER_GUARD);
  gateway.register(makeContextRouterGuard(defaultContextRouterConfPath()));
  gateway.register(SKILL_MIRROR_GUARD);
  gateway.register(DESTRUCTIVE_GUARD);
  gateway.register(makeCommitmentGuard(checkActiveCommitments));
  gateway.register(COMPACT_RESET_GUARD);
  gateway.register(makeAutoCompactCounterGuard(defaultCompactSender()));
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
