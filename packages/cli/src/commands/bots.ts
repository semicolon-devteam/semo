/**
 * semo bots — 봇 상태 관리
 *
 * Actual semo.bot_status schema:
 *   bot_id, name, emoji, role, last_active, session_count, workspace_path, status, synced_at
 *
 * Actual semo.bot_sessions schema:
 *   bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync } from 'child_process';
import {
  getPool,
  closeConnection,
  isDbConnected,
  getDelegations,
  getActiveSkills,
} from '../database';
import {
  auditBot,
  auditBotFromDb,
  auditBotDb,
  auditBotKb,
  mergeDbChecks,
  fixBot,
  fixBotFromDb,
  syncBotFromDb,
  auditSkillStructure,
  loadCheckDefs,
  storeAuditResults,
  formatAuditSlack,
  BotAuditResult,
  WorkspaceStandardRow,
} from './audit';
import { getCronJobStats } from './context';
import { resolveBotWorkspace, SEMO_WORKSPACES } from '../paths';
import { registerBotsFactoryCommands } from './bots-factory';
import { registerInboxPumpCommand } from './inbox-pump';
import { registerBotsServiceCommand } from './bots-service';

// ============================================================
// Types (matches actual DB schema)
// ============================================================

interface BotStatus {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  status: string | null;
  last_active: string | null;
  session_count: number;
  workspace_path: string | null;
  synced_at: string | null;
  /** bot_commitments.updated_at MAX — 실제 활동 SoT (table 의 last_active 는 SOUL.md mtime). */
  last_commit_at?: string | null;
  /** 24h 내 commitment 개수. */
  commit_count_24h?: number;
  /**
   * derived 표시 상태 (table 의 status 컬럼 무시):
   *   active(<=1h) | recent(<=24h) | idle(>24h) | none
   */
  derived_status?: 'active' | 'recent' | 'idle' | 'none';
}

interface BotSession {
  bot_id: string;
  session_key: string;
  label: string | null;
  kind: string | null;
  chat_type: string | null;
  last_activity: string | null;
  message_count: number;
}

// ============================================================
// SOUL.md / IDENTITY.md parser (v2.0: SOUL.md 우선)
// ============================================================

interface BotIdentity {
  name: string | null;
  emoji: string | null;
  role: string | null;
}

function parseIdentityMd(content: string): BotIdentity {
  // v1 호환: IDENTITY.md 또는 SOUL.md에서 Name/Emoji/Role 파싱
  const nameMatch = content.match(/(?:\*\*)?Name:(?:\*\*)?\s*(.+)/i);
  const emojiMatch = content.match(/(?:\*\*)?Emoji:(?:\*\*)?\s*(\S+)/i);
  const roleMatch = content.match(/(?:\*\*)?(?:Creature|Role|직책):(?:\*\*)?\s*(.+)/i);

  const name = nameMatch ? nameMatch[1].trim() : null;
  const emoji = emojiMatch ? emojiMatch[1].trim() : null;
  const role = roleMatch ? roleMatch[1].trim() : null;

  return {
    name: name && name.length <= 100 ? name : null,
    emoji: emoji && emoji.length <= 10 ? emoji : null,
    role: role && role.length <= 100 ? role : null,
  };
}

export function parseSoulIdentity(content: string, botId: string): BotIdentity {
  // v2.0: SOUL.md 첫 줄 "# {name} — SOUL[.md]" 또는 "# {name}" 패턴.
  // 이전 regex 가 ".md" 뒤를 처리 못해 name 에 " — SOUL.md" 가 흡수되던 버그 수정.
  const titleMatch = content.match(/^#\s+(.+?)(?:\s*[—–-]\s*SOUL(?:\.md)?)?\s*$/m);
  const name = titleMatch ? titleMatch[1].trim() : botId;

  // ## R&R 또는 ## Identity 아래 첫 줄에서 역할 추출
  const rrMatch = content.match(/##\s*R&R\s*\n+(?:>\s*)?(.+)/i);
  const role = rrMatch ? rrMatch[1].trim().substring(0, 100) : null;

  // 이모지 추출 우선순위:
  //  1) ## Identity 블록 내 ":shortcode:" (Slack 표준 — :brain: :shield: :hatching_chick: 등)
  //  2) ## Identity 블록 내 unicode emoji
  //  3) (제거) 본문 전체 검색 — ⚠/❌ 같은 검증 경고 prefix 가 잘못 잡히는 케이스 방지
  const identitySection = content.match(/##\s*Identity[\s\S]*?(?=\n##\s|$)/i)?.[0] ?? '';

  let emoji: string | null = null;
  const shortcodeMatch = identitySection.match(/(:[a-z0-9_+-]+:)/i);
  if (shortcodeMatch) {
    emoji = shortcodeMatch[1];
  } else {
    const unicodeMatch = identitySection.match(/([\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}])/u);
    if (unicodeMatch) emoji = unicodeMatch[1];
  }

  return { name, emoji, role };
}

// ============================================================
// Bot workspace scanner
// ============================================================

interface ScannedBot {
  botId: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  lastActive: Date | null;
  workspacePath: string;
}

/**
 * SEMO_WORKSPACES (~/.semo/workspaces/) 디렉토리를 enumerate 해서 봇 ID 목록 반환.
 * 봇 이름 하드코딩 금지 (NON-NEGOTIABLE) — FS 가 운영 SoT, KB ontology 와 정합.
 * 새 봇 추가는 디렉토리 생성으로 자동 감지.
 */
/** S2: pump-stats.json 형식 (inbox-pump.ts writePumpStats 와 정합). */
interface PumpStats {
  bot_id: string;
  pending: number;
  sent: number;
  skipped_busy: number;
  skipped_dead: number;
  last_pane_state?: 'idle' | 'busy' | 'dead';
  last_pane_state_at?: string;
  last_sent_at?: string;
  pump_alive_at: string;
}

function loadPumpStats(botIds: string[]): Map<string, PumpStats> {
  const out = new Map<string, PumpStats>();
  const mboxDir = process.env.SEMO_MAILBOX_DIR ?? path.join(os.homedir(), '.semo', 'mailbox');
  for (const bot of botIds) {
    const p = path.join(mboxDir, bot, 'pump-stats.json');
    if (!fs.existsSync(p)) continue;
    try {
      out.set(bot, JSON.parse(fs.readFileSync(p, 'utf8')) as PumpStats);
    } catch {
      // skip
    }
  }
  return out;
}

function discoverBotIds(): string[] {
  if (!fs.existsSync(SEMO_WORKSPACES)) return [];
  try {
    return fs
      .readdirSync(SEMO_WORKSPACES, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function scanBotWorkspaces(_semoSystemDir?: string): ScannedBot[] {
  const bots: ScannedBot[] = [];

  for (const botId of discoverBotIds()) {
    const botDir = resolveBotWorkspace(botId);
    if (!fs.existsSync(botDir)) continue;

    // Most recent file mtime
    let lastActive: Date | null = null;
    try {
      const times = getAllFileMtimes(botDir);
      if (times.length > 0) {
        lastActive = new Date(Math.max(...times.map((t) => t.getTime())));
      }
    } catch {
      /* skip */
    }

    // v2.0: SOUL.md에서 Identity 파싱 (IDENTITY.md fallback)
    let identity: BotIdentity = { name: null, emoji: null, role: null };
    const soulPath = path.join(botDir, 'SOUL.md');
    const identityPath = path.join(botDir, 'IDENTITY.md');
    if (fs.existsSync(soulPath)) {
      try {
        identity = parseSoulIdentity(fs.readFileSync(soulPath, 'utf-8'), botId);
      } catch {
        /* skip */
      }
    } else if (fs.existsSync(identityPath)) {
      try {
        identity = parseIdentityMd(fs.readFileSync(identityPath, 'utf-8'));
      } catch {
        /* skip */
      }
    }

    bots.push({ botId, ...identity, lastActive, workspacePath: botDir });
  }

  return bots;
}

function getAllFileMtimes(dir: string, depth = 0): Date[] {
  if (depth > 2) return [];
  const times: Date[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        times.push(fs.statSync(fullPath).mtime);
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        times.push(...getAllFileMtimes(fullPath, depth + 1));
      }
    }
  } catch {
    /* skip */
  }
  return times;
}

// ============================================================
// Workspace files sync → bot_workspace_files
// ============================================================

import * as crypto from 'crypto';

const BINARY_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.bmp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.7z',
  '.rar',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.db',
  '.sqlite',
  '.sqlite3',
]);
const MAX_FILE_SIZE = 512 * 1024; // 512KB

/**
 * SOUL.md 파싱 결과(ScannedBot)를 KB `{bot_id}/identity` 엔트리에 반영.
 *
 * 비전(2026-04-29 reus 결정): KB 엔트리가 "어느 봇이 어떤 역할을 한다"의 SoT.
 * Agent Factory CUD 와 SOUL.md 변경 모두 → KB 자동 동기화 → 라우터가 KB 기반으로 의도 매칭.
 *
 * agents 도메인 schema 의 identity 키 hint:
 *   YAML: name, emoji, tagline, role, agent_type (orchestrator|specialist)
 *
 * 직접 kbUpsert(pool) 사용 — `semo kb upsert` 명령과 동일한 경로 (PG 공식, 임베딩 자동 생성,
 * 스키마 검증 포함). portable adapter (KbStore) 가 PG 어댑터 미설치 환경에서 실패하는 것 회피.
 * 도메인이 ontology 에 미등록된 경우는 kbUpsert 가 자체 검증 → error 반환.
 */
export async function syncBotIdentitiesToKb(
  scanned: ScannedBot[],
): Promise<{ synced: number; errors: string[] }> {
  if (scanned.length === 0) return { synced: 0, errors: [] };

  const { kbUpsert } = await import('../kb.js');
  const pool = getPool();
  let synced = 0;
  const errors: string[] = [];
  for (const bot of scanned) {
    if (!bot.name && !bot.emoji && !bot.role) continue;
    const lines: string[] = [];
    lines.push(`name: ${bot.name ?? bot.botId}`);
    if (bot.emoji) lines.push(`emoji: ${bot.emoji}`);
    if (bot.role) lines.push(`role: ${bot.role}`);
    try {
      const r = await kbUpsert(pool, {
        domain: bot.botId,
        key: 'identity',
        content: lines.join('\n'),
        created_by: 'semo-bots-sync',
      });
      if (r.success) synced++;
      else errors.push(`${bot.botId}: ${r.error?.slice(0, 100) ?? 'unknown'}`);
    } catch (err) {
      errors.push(`${bot.botId}: ${(err as Error).message.slice(0, 100)}`);
    }
  }
  return { synced, errors };
}

export async function syncWorkspaceFiles(
  client: {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
  },
  botId: string,
  workspaceDir: string,
): Promise<number> {
  const files: { relPath: string; content: string; hash: string; size: number }[] = [];

  function scan(dir: string, relBase: string, depth: number) {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

      // Skip symlinks
      try {
        if (fs.lstatSync(fullPath).isSymbolicLink()) continue;
      } catch {
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath, relPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTS.has(ext)) continue;

        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }
        if (stat.size > MAX_FILE_SIZE) continue;

        let content: string;
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }

        // Skip files with NULL bytes (binary masquerading as text)
        if (content.includes('\0')) continue;

        const hash = crypto.createHash('sha256').update(content).digest('hex');
        files.push({ relPath, content, hash, size: stat.size });
      }
    }
  }

  scan(workspaceDir, '', 0);

  let upserted = 0;
  for (const f of files) {
    const result = await client.query(
      `INSERT INTO semo.bot_workspace_files (bot_id, file_path, content, file_size, file_hash, synced_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (bot_id, file_path) DO UPDATE SET
         content   = EXCLUDED.content,
         file_size = EXCLUDED.file_size,
         file_hash = EXCLUDED.file_hash,
         synced_at = NOW()
       WHERE semo.bot_workspace_files.file_hash IS DISTINCT FROM EXCLUDED.file_hash`,
      [botId, f.relPath, f.content, f.size, f.hash],
    );
    if (result.rowCount && result.rowCount > 0) {
      upserted++;
    }
  }

  // Delete files in DB but not on disk (for this bot_id)
  const dbFiles = await client.query(
    `SELECT file_path FROM semo.bot_workspace_files WHERE bot_id = $1`,
    [botId],
  );
  const diskPaths = new Set(files.map((f) => f.relPath));
  for (const row of dbFiles.rows as { file_path: string }[]) {
    if (!diskPaths.has(row.file_path)) {
      await client.query(
        `DELETE FROM semo.bot_workspace_files WHERE bot_id = $1 AND file_path = $2`,
        [botId, row.file_path],
      );
    }
  }

  return files.length;
}

// ============================================================
// Command registration
// ============================================================

// ── 봇 프로필 캐시 정리 (DB-driven 전환 P0) ──────────────────────────────
// 설계: docs/superpowers/specs/2026-06-04-db-driven-bot-architecture-design.md
// 재생성 가능 캐시(.bak/completions/*-last-rendered/update-check/오래된 로그)만 대상.
// SoT(openclaw.json/agent-spec/identity/cron) · 시크릿(auth/credential/device) · 메모리 · mailbox
// · .openclaw/ 미러(auth 포함)는 **절대 미삭제**(이중 가드). dry-run 기본.
interface CacheTarget {
  path: string;
  bytes: number;
  kind: string;
}

function pathSizeBytes(p: string): number {
  try {
    const st = fs.statSync(p);
    if (!st.isDirectory()) return st.size;
    let total = 0;
    for (const e of fs.readdirSync(p)) total += pathSizeBytes(path.join(p, e));
    return total;
  } catch {
    return 0;
  }
}

const CACHE_PROTECTED_SUBSTR = [
  'identity',
  'auth',
  'credential',
  'secret',
  'memory',
  'device',
  '.openclaw/',
  '/mailbox',
  'cron/jobs.json',
];
function isCacheProtected(p: string): boolean {
  const low = p.toLowerCase();
  return CACHE_PROTECTED_SUBSTR.some((s) => low.includes(s.toLowerCase()));
}

function humanBytes(n: number): string {
  if (n < 1024) return n + 'B';
  if (n < 1048576) return (n / 1024).toFixed(1) + 'K';
  if (n < 1073741824) return (n / 1048576).toFixed(1) + 'M';
  return (n / 1073741824).toFixed(2) + 'G';
}

function classifyBotCacheTargets(botId: string): CacheTarget[] {
  const profile = path.join(os.homedir(), `.openclaw-${botId}`);
  if (!fs.existsSync(profile)) return [];
  const out: CacheTarget[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(profile);
  } catch {
    return [];
  }
  const push = (p: string, kind: string) => {
    if (!isCacheProtected(p) && fs.existsSync(p))
      out.push({ path: p, bytes: pathSizeBytes(p), kind });
  };

  // 1) config 백업 *.bak* — .last-good 과 가장 최근 1개는 안전망으로 보존
  const baks = entries
    .filter((e) => /\.bak($|[.\-])/.test(e) && !e.includes('last-good'))
    .map((e) => {
      let m = 0;
      try {
        m = fs.statSync(path.join(profile, e)).mtimeMs;
      } catch {
        /* ignore */
      }
      return { e, m };
    })
    .sort((a, b) => b.m - a.m);
  baks.slice(1).forEach(({ e }) => push(path.join(profile, e), 'config-backup'));

  // 2) *-last-rendered.json (렌더 아티팩트)
  entries
    .filter((e) => e.includes('last-rendered'))
    .forEach((e) => push(path.join(profile, e), 'render-artifact'));

  // 3) completions/ (쉘 자동완성 — 재생성)
  push(path.join(profile, 'completions'), 'completions');

  // 4) update-check.json (버전 체크 캐시)
  push(path.join(profile, 'update-check.json'), 'version-cache');

  // 5) logs/*.log 중 7일+ 오래된 것만
  const logs = path.join(profile, 'logs');
  if (fs.existsSync(logs)) {
    const weekAgo = Date.now() - 7 * 86_400_000;
    try {
      for (const e of fs.readdirSync(logs)) {
        const p = path.join(logs, e);
        try {
          const st = fs.statSync(p);
          if (st.isFile() && /\.log(\.|$)/.test(e) && st.mtimeMs < weekAgo) {
            push(p, 'old-log');
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }
  return out.filter((t) => !isCacheProtected(t.path));
}

// ── DB-driven 식별자 렌더 (P1/P2) ──────────────────────────────────
// bot_status(name/emoji) = SoT. OpenClaw 프로필 base openclaw.json 의 ui.assistant 를
// DB 에서 머지 렌더(secrets/그 외 전부 보존). 단일 편집점은 `semo bots set`.
//
// emoji 포맷: DB 는 Slack 숏코드(:art:) 저장(slack_icon_emoji 와 동일 표현),
// OpenClaw ui.assistant.avatar 는 유니코드. 매핑 없으면 기존 로컬 avatar 보존.
const EMOJI_SHORTCODE_MAP: Record<string, string> = {
  ':art:': '🎨',
  ':chart_with_upwards_trend:': '📈',
  ':shield:': '🛡️',
  ':mag:': '🔍',
  ':clipboard:': '📋',
  ':brain:': '🧠',
  ':hammer_and_wrench:': '🛠️',
  ':robot_face:': '🤖',
  ':gear:': '⚙️',
  ':bust_in_silhouette:': '👤',
  ':building_construction:': '🏗️',
};
function resolveEmoji(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (t.startsWith(':') && t.endsWith(':')) return EMOJI_SHORTCODE_MAP[t]; // 매핑 없으면 undefined → 보존
  return t; // 이미 유니코드
}

interface OpenclawAssistant {
  name?: string;
  avatar?: string;
  [k: string]: unknown;
}
interface OpenclawConfigShape {
  ui?: { assistant?: OpenclawAssistant; [k: string]: unknown };
  [k: string]: unknown;
}
interface IdentityRenderResult {
  botId: string;
  profileExists: boolean;
  nameChange?: { from: string | null; to: string };
  avatarFill?: { to: string };
  avatarDrift?: { local: string; db: string }; // 불일치 — render 는 변경 안 함(리포트만)
  metaChange?: { from: string | null; to: string }; // agent-spec.meta.json displayName
  changed: boolean;
}

interface AgentSpecMetaShape {
  semo?: { displayName?: string; [k: string]: unknown };
  [k: string]: unknown;
}

// base openclaw.json 에 식별자 머지. name=DB SoT(있으면). avatar 는 누락분만 채움(fill);
// forceAvatar=true(=`set --emoji`)면 불일치도 덮어씀. secrets/그 외 키 전부 보존.
function renderBotIdentity(
  botId: string,
  dbName: string | null,
  dbEmoji: string | null,
  opts: { apply: boolean; forceAvatar?: boolean },
): IdentityRenderResult {
  const ocPath = path.join(os.homedir(), `.openclaw-${botId}`, 'openclaw.json');
  const res: IdentityRenderResult = {
    botId,
    profileExists: fs.existsSync(ocPath),
    changed: false,
  };
  if (!res.profileExists) return res;
  let oc: OpenclawConfigShape;
  try {
    oc = JSON.parse(fs.readFileSync(ocPath, 'utf8')) as OpenclawConfigShape;
  } catch {
    res.profileExists = false;
    return res;
  }
  oc.ui = oc.ui ?? {};
  oc.ui.assistant = oc.ui.assistant ?? {};
  const cur = oc.ui.assistant;

  if (dbName && cur.name !== dbName) {
    res.nameChange = { from: cur.name ?? null, to: dbName };
    cur.name = dbName;
    res.changed = true;
  }

  const dbAvatar = resolveEmoji(dbEmoji);
  if (dbAvatar) {
    if (cur.avatar == null || cur.avatar === '') {
      res.avatarFill = { to: dbAvatar };
      cur.avatar = dbAvatar;
      res.changed = true;
    } else if (cur.avatar !== dbAvatar) {
      if (opts.forceAvatar) {
        res.avatarFill = { to: dbAvatar };
        cur.avatar = dbAvatar;
        res.changed = true;
      } else {
        res.avatarDrift = { local: cur.avatar, db: dbAvatar }; // 무단 변경 방지
      }
    }
  }

  // openclaw.json 쓰기 (name/avatar 변경 시). meta 변경은 아래에서 별도 게이트.
  if (res.changed && opts.apply) {
    let mode = 0o600;
    try {
      mode = fs.statSync(ocPath).mode & 0o777;
    } catch {
      /* keep default */
    }
    const tmp = ocPath + '.tmp-render';
    fs.writeFileSync(tmp, JSON.stringify(oc, null, 2) + '\n', { mode });
    fs.renameSync(tmp, ocPath); // atomic
  }

  // agent-spec.meta.json 의 displayName 도 DB name 으로 동기 (DB-rendered 메타 — 드리프트 방지).
  // 이 블록이 openclaw.json 쓰기 뒤에 와야 meta-only 변경이 openclaw 쓰기를 잘못 트리거하지 않음.
  if (dbName) {
    const metaPath = path.join(os.homedir(), `.openclaw-${botId}`, 'agent-spec.meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as AgentSpecMetaShape;
        meta.semo = meta.semo ?? {};
        if (meta.semo.displayName !== dbName) {
          res.metaChange = { from: meta.semo.displayName ?? null, to: dbName };
          res.changed = true;
          if (opts.apply) {
            meta.semo.displayName = dbName;
            const mtmp = metaPath + '.tmp-render';
            fs.writeFileSync(mtmp, JSON.stringify(meta, null, 2) + '\n');
            fs.renameSync(mtmp, metaPath);
          }
        }
      } catch {
        /* meta 파싱 실패 — skip */
      }
    }
  }
  return res;
}

// render/set 대상 봇 목록: 로컬 ~/.openclaw-* 프로필 ∩ DB bot_status (내부 봇).
function listRenderableBotIds(): string[] {
  try {
    return fs
      .readdirSync(os.homedir())
      .filter((d) => d.startsWith('.openclaw-') && !d.includes('shared'))
      .map((d) => d.replace(/^\.openclaw-/, ''));
  } catch {
    return [];
  }
}

export function registerBotsCommands(program: Command): void {
  const botsCmd = program.command('bots').description('봇 상태 조회 및 관리 (semo.bot_status)');

  // Agent Factory (create / delete / show) — SemoBot 진입점
  registerBotsFactoryCommands(botsCmd);
  registerInboxPumpCommand(botsCmd);
  registerBotsServiceCommand(botsCmd);

  // ── semo bots clean-cache (DB-driven 전환 P0) ──────────────────────
  botsCmd
    .command('clean-cache')
    .description(
      '봇 OpenClaw 프로필의 재생성 가능 캐시 정리 (dry-run 기본; --apply로 실삭제). SoT/시크릿/메모리/mailbox/.openclaw 미러는 절대 미삭제.',
    )
    .option('--bot <id>', '특정 봇')
    .option('--all', '모든 ~/.openclaw-* 봇')
    .option('--apply', '실제 삭제 (기본은 dry-run)')
    .action(async (opts: { bot?: string; all?: boolean; apply?: boolean }) => {
      let bots: string[] = [];
      if (opts.bot) bots = [opts.bot];
      else if (opts.all) {
        try {
          bots = fs
            .readdirSync(os.homedir())
            .filter((d) => d.startsWith('.openclaw-') && !d.includes('shared'))
            .map((d) => d.replace(/^\.openclaw-/, ''));
        } catch {
          /* ignore */
        }
      } else {
        console.error(chalk.red('✗ --bot <id> 또는 --all 필요'));
        process.exit(1);
      }
      let grandTotal = 0;
      let grandCount = 0;
      for (const botId of bots) {
        const targets = classifyBotCacheTargets(botId);
        if (!targets.length) {
          console.log(chalk.gray(`  ${botId}: 정리 대상 없음`));
          continue;
        }
        const sum = targets.reduce((a, t) => a + t.bytes, 0);
        grandTotal += sum;
        grandCount += targets.length;
        console.log(
          chalk.cyan(
            `\n${botId} — ${targets.length}건, ${humanBytes(sum)} ${opts.apply ? '삭제' : '(dry-run)'}`,
          ),
        );
        const byKind: Record<string, { n: number; b: number }> = {};
        for (const t of targets) {
          (byKind[t.kind] ??= { n: 0, b: 0 }).n++;
          byKind[t.kind].b += t.bytes;
        }
        for (const [k, v] of Object.entries(byKind)) {
          console.log(`  ${k}: ${v.n}건 ${humanBytes(v.b)}`);
        }
        if (opts.apply) {
          for (const t of targets) {
            if (isCacheProtected(t.path)) continue; // 이중 가드
            try {
              fs.rmSync(t.path, { recursive: true, force: true });
            } catch (e) {
              console.warn(chalk.yellow(`  skip ${t.path}: ${(e as Error).message}`));
            }
          }
        }
      }
      console.log(
        chalk[opts.apply ? 'green' : 'yellow'](
          `\n총 ${grandCount}건 ${humanBytes(grandTotal)} ${opts.apply ? '삭제 완료' : 'dry-run (--apply 로 실제 삭제)'}`,
        ),
      );
      process.exit(0);
    });

  // ── semo bots render (DB 식별자 → OpenClaw 프로필, P1/P2) ───────────
  botsCmd
    .command('render')
    .description(
      'DB(bot_status) 식별자를 OpenClaw 프로필 openclaw.json 에 머지 렌더 (dry-run 기본; --apply). name=DB SoT, avatar 누락분 채움(불일치는 리포트만). secrets/그 외 config 전부 보존.',
    )
    .option('--bot <id>', '특정 봇')
    .option('--all', '로컬 프로필 ∩ DB 내부 봇 전체')
    .option('--apply', '실제 파일 수정 (기본은 dry-run)')
    .action(async (opts: { bot?: string; all?: boolean; apply?: boolean }) => {
      let botIds: string[] = [];
      if (opts.bot) botIds = [opts.bot];
      else if (opts.all) botIds = listRenderableBotIds();
      else {
        console.error(chalk.red('✗ --bot <id> 또는 --all 필요'));
        process.exit(1);
      }
      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }
      try {
        const pool = getPool();
        const r = await pool.query<{ bot_id: string; name: string | null; emoji: string | null }>(
          `SELECT bot_id, name, emoji FROM semo.bot_status WHERE bot_id = ANY($1)`,
          [botIds],
        );
        const dbMap = new Map(r.rows.map((row) => [row.bot_id, row]));
        let changes = 0;
        let drifts = 0;
        for (const botId of botIds) {
          const row = dbMap.get(botId);
          if (!row) {
            console.log(chalk.gray(`  ${botId}: DB bot_status 없음 — skip`));
            continue;
          }
          const res = renderBotIdentity(botId, row.name, row.emoji, {
            apply: !!opts.apply,
          });
          if (!res.profileExists) {
            console.log(chalk.gray(`  ${botId}: 로컬 프로필 없음/파싱 실패 — skip`));
            continue;
          }
          const parts: string[] = [];
          if (res.nameChange)
            parts.push(
              `name ${JSON.stringify(res.nameChange.from)} → ${JSON.stringify(res.nameChange.to)}`,
            );
          if (res.avatarFill) parts.push(`avatar 채움 → ${res.avatarFill.to}`);
          if (res.metaChange) parts.push(`meta.displayName → ${res.metaChange.to}`);
          if (res.changed) changes++;
          if (parts.length) {
            console.log(
              `  ${chalk.cyan(botId)}: ${parts.join(', ')} ${opts.apply ? chalk.green('[적용]') : chalk.yellow('(dry-run)')}`,
            );
          } else {
            console.log(chalk.gray(`  ${botId}: 변경 없음 (이미 동기)`));
          }
          if (res.avatarDrift) {
            drifts++;
            console.log(
              chalk.yellow(
                `     ⚠ avatar 드리프트: 로컬 ${res.avatarDrift.local} ≠ DB ${res.avatarDrift.db} (render 는 변경 안 함; \`semo bots set ${botId} --emoji ...\` 로 확정)`,
              ),
            );
          }
        }
        console.log(
          chalk[opts.apply ? 'green' : 'yellow'](
            `\n${changes}건 ${opts.apply ? '적용 완료' : 'dry-run (--apply 로 실제 수정)'}${drifts ? ` · 드리프트 ${drifts}건 미해결` : ''}`,
          ),
        );
      } catch (err) {
        console.log(chalk.red(`❌ 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
      process.exit(0);
    });

  // ── semo bots set (DB 식별자 수정 + 자동 재렌더, 단일 편집점) ────────
  botsCmd
    .command('set <bot_id>')
    .description('DB(bot_status) 식별자 수정 후 자동 재렌더. 닉네임/이모지 변경은 이 명령 하나.')
    .option('--name <name>', '표시 이름(닉네임)')
    .option('--emoji <emoji>', 'emoji (Slack 숏코드 :x: 또는 유니코드)')
    .action(async (botId: string, opts: { name?: string; emoji?: string }) => {
      if (!opts.name && !opts.emoji) {
        console.error(chalk.red('✗ --name 또는 --emoji 중 하나 이상 필요'));
        process.exit(1);
      }
      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }
      try {
        const pool = getPool();
        const client = await pool.connect();
        // 기존 값 조회 — slack_username/slack_icon_emoji 동기 판단(의도적 분리는 보존).
        const prev = await client.query<{
          name: string | null;
          slack_username: string | null;
          emoji: string | null;
          slack_icon_emoji: string | null;
        }>(
          `SELECT name, slack_username, emoji, slack_icon_emoji FROM semo.bot_status WHERE bot_id = $1`,
          [botId],
        );
        if (prev.rowCount === 0) {
          client.release();
          console.log(chalk.red(`❌ bot_status 에 ${botId} 없음`));
          process.exit(1);
        }
        const prevName = prev.rows[0].name;
        const prevSlackU = prev.rows[0].slack_username;
        const prevEmoji = prev.rows[0].emoji;
        const prevSlackIcon = prev.rows[0].slack_icon_emoji;
        const sets: string[] = [];
        const vals: unknown[] = [botId];
        if (opts.name) {
          vals.push(opts.name);
          sets.push(`name = $${vals.length}`);
          // slack_username 이 기존 name 과 동기였거나 비어있으면 함께 갱신(Slack 표시명 = 식별자).
          if (prevSlackU == null || prevSlackU === prevName) {
            vals.push(opts.name);
            sets.push(`slack_username = $${vals.length}`);
          }
        }
        if (opts.emoji) {
          vals.push(opts.emoji);
          sets.push(`emoji = $${vals.length}`);
          // slack_icon_emoji 가 기존 emoji 와 동기였거나 비어있으면 함께 갱신(분리된 경우 보존).
          if (prevSlackIcon == null || prevSlackIcon === prevEmoji) {
            vals.push(opts.emoji);
            sets.push(`slack_icon_emoji = $${vals.length}`);
          }
        }
        const up = await client.query(
          `UPDATE semo.bot_status SET ${sets.join(', ')}, synced_at = NOW() WHERE bot_id = $1
           RETURNING name, emoji, slack_username`,
          vals,
        );
        client.release();
        if (up.rowCount === 0) {
          console.log(chalk.red(`❌ bot_status 에 ${botId} 없음`));
          process.exit(1);
        }
        const { name, emoji, slack_username } = up.rows[0] as {
          name: string | null;
          emoji: string | null;
          slack_username: string | null;
        };
        console.log(
          chalk.green(
            `✔ DB 업데이트: ${botId} name=${JSON.stringify(name)} emoji=${JSON.stringify(emoji)} slack_username=${JSON.stringify(slack_username)}`,
          ),
        );
        // 자동 재렌더 (emoji 명시 시 드리프트도 덮어씀). meta.displayName 도 함께 동기.
        const res = renderBotIdentity(botId, name, emoji, {
          apply: true,
          forceAvatar: !!opts.emoji,
        });
        if (!res.profileExists) {
          console.log(chalk.yellow(`  로컬 프로필 없음 — DB 만 갱신됨 (런타임이 DB 읽으면 충분)`));
        } else if (res.changed) {
          const parts: string[] = [];
          if (res.nameChange) parts.push(`name → ${res.nameChange.to}`);
          if (res.avatarFill) parts.push(`avatar → ${res.avatarFill.to}`);
          if (res.metaChange) parts.push(`meta.displayName → ${res.metaChange.to}`);
          console.log(chalk.green(`  재렌더 적용: ${parts.join(', ')}`));
        } else {
          console.log(chalk.gray(`  로컬 이미 동기 — 재렌더 변경 없음`));
        }
      } catch (err) {
        console.log(chalk.red(`❌ 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
      process.exit(0);
    });

  // ── semo bots worker (serve-worker durable 관리, P3 수렴 도구) ─────────
  // reviewclaw 하드코딩 forever-loop 스크립트를 봇 무관하게 일반화. serve-worker 엔진
  // (runtime serve)은 advisory lock 으로 봇당 1워커 보장 — 이 명령은 durable 래퍼만 관리.
  botsCmd
    .command('worker <bot_id>')
    .description(
      'serve-worker(mailbox→dispatch) durable 관리 — start/stop/status. config.serve_worker_enabled 봇의 워커를 봇 무관하게 기동(휘발성 /tmp 스크립트 대체).',
    )
    .option('--start', 'durable forever-loop 워커 기동 (detached)')
    .option('--stop', '워커 정지 (래퍼 + serve 프로세스)')
    .option(
      '--max-message-age-ms <n>',
      'stale-guard 임계값(ms). consumed-marker 가 재처리를 막으므로 이 값은 ancient orphan 드레인 전용 — 실 트래픽 드롭 방지 위해 기본 1h(60min=600000 아님). 0=off',
      '3600000',
    )
    .action(
      async (
        botId: string,
        opts: { start?: boolean; stop?: boolean; maxMessageAgeMs?: string },
      ) => {
        const repoRoot = process.cwd();
        const entry = path.join(repoRoot, 'packages/cli/src/index.ts');
        const scriptPath = path.join(os.homedir(), '.semo', 'scripts', `${botId}-worker.sh`);
        const logPath = path.join(os.homedir(), '.semo', 'logs', `${botId}-worker.log`);
        const matchPat = `runtime serve --bot ${botId}`;
        const findServe = (): string[] => {
          try {
            return execSync(`pgrep -f ${JSON.stringify(matchPat)}`, { encoding: 'utf8' })
              .trim()
              .split('\n')
              .filter(Boolean);
          } catch {
            return []; // pgrep no-match → exit 1
          }
        };

        // config 조회 (serve_worker_enabled / host_kind)
        let cfg: Record<string, unknown> = {};
        if (await isDbConnected()) {
          try {
            const r = await getPool().query<{ config: Record<string, unknown> | null }>(
              `SELECT config FROM semo.bot_status WHERE bot_id = $1`,
              [botId],
            );
            cfg = r.rows[0]?.config ?? {};
          } catch {
            /* ignore */
          }
        }
        const enabled = String(cfg.serve_worker_enabled ?? '') === 'true';
        const hostKind = (cfg.host_kind as string) ?? 'claude-code';

        if (opts.stop) {
          const running = findServe();
          try {
            execSync(`pkill -f ${JSON.stringify(scriptPath)}`, { stdio: 'ignore' }); // 래퍼 먼저
          } catch {
            /* 래퍼 없을 수 있음 */
          }
          for (const pid of running) {
            try {
              process.kill(Number(pid), 'SIGTERM');
            } catch {
              /* ignore */
            }
          }
          console.log(
            running.length
              ? chalk.green(`✔ ${botId} 워커 정지 (${running.length} serve proc + 래퍼)`)
              : chalk.gray(`  ${botId}: 실행 중인 serve 없음 (래퍼만 정리 시도)`),
          );
          await closeConnection();
          process.exit(0);
        }

        if (opts.start) {
          if (!enabled) {
            console.log(
              chalk.yellow(
                `⚠ ${botId}: config.serve_worker_enabled != 'true' — DB config 에서 먼저 활성화 필요.`,
              ),
            );
            await closeConnection();
            process.exit(1);
          }
          if (findServe().length) {
            console.log(
              chalk.gray(`  ${botId}: 이미 실행 중 (advisory lock 보유) — skip(중복 방지).`),
            );
            await closeConnection();
            process.exit(0);
          }
          if (!fs.existsSync(entry)) {
            console.log(
              chalk.red(`✗ ${entry} 없음 — repo 루트에서 실행 필요 (현재 cwd=${repoRoot}).`),
            );
            await closeConnection();
            process.exit(1);
          }
          const script =
            [
              '#!/bin/bash',
              `cd ${JSON.stringify(repoRoot)}`,
              'set -a && source ~/.claude/semo/.env && set +a',
              'while true; do',
              `  npx tsx packages/cli/src/index.ts runtime serve --bot ${botId} \\`,
              `    --max-message-age-ms ${Number(opts.maxMessageAgeMs ?? 3600000)} --timeout-ms 120000 --interval-ms 3000`,
              `  echo "[${botId}-worker $(date +%H:%M:%S)] serve exited, restart in 3s"`,
              '  sleep 3',
              'done',
            ].join('\n') + '\n';
          fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
          fs.mkdirSync(path.dirname(logPath), { recursive: true });
          fs.writeFileSync(scriptPath, script, { mode: 0o755 });
          const out = fs.openSync(logPath, 'a');
          const child = spawn('bash', [scriptPath], {
            detached: true,
            stdio: ['ignore', out, out],
          });
          child.unref();
          console.log(
            chalk.green(
              `✔ ${botId} serve-worker 기동 (host=${hostKind}, pid ${child.pid})\n  script: ${scriptPath}\n  log: ${logPath}`,
            ),
          );
          await closeConnection();
          process.exit(0);
        }

        // default: status
        const running = findServe();
        console.log(chalk.cyan(`${botId} serve-worker 상태`));
        console.log(
          `  config.serve_worker_enabled: ${enabled ? chalk.green('true') : chalk.gray(String(cfg.serve_worker_enabled ?? '(미설정)'))}`,
        );
        console.log(`  host_kind: ${hostKind}`);
        console.log(
          `  실행 중 serve proc: ${running.length ? chalk.green(running.join(', ')) : chalk.gray('없음')}`,
        );
        console.log(
          `  durable script: ${fs.existsSync(scriptPath) ? scriptPath : chalk.gray('(미생성)')}`,
        );
        await closeConnection();
        process.exit(0);
      },
    );

  // ── semo bots routing-audit ────────────────────────────────
  // S1 (Codex 권고): hint suggested_bot vs 최종 escalation target 불일치 추출.
  // 사용자 재질문 ambiguity 는 별개 metric (이번 명령에 미포함).
  botsCmd
    .command('routing-audit')
    .description('routing_hint vs escalation 결과 mismatch 추출 (kb delegation 키워드 보강 cycle)')
    .option('--since <duration>', '기간 (예: 7d, 24h, 1h)', '7d')
    .option('--mismatch-only', 'hint != escalation target 만 표시')
    .option('--format <type>', 'table | json', 'table')
    .action(async (opts: { since: string; mismatchOnly?: boolean; format: string }) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('✗ DB 연결 실패'));
        process.exit(1);
      }
      const intervalMatch = opts.since.match(/^(\d+)([hdm])$/);
      if (!intervalMatch) {
        console.error(chalk.red('✗ --since 형식: 7d / 24h / 30m'));
        process.exit(1);
      }
      const [, n, unit] = intervalMatch;
      const intervalSql = unit === 'd' ? `${n} days` : unit === 'h' ? `${n} hours` : `${n} minutes`;

      const pool = getPool();
      // 1. routing_hint 있는 commitment 조회
      const r = await pool.query(
        `SELECT
             c.id,
             c.bot_id AS landed_bot,
             c.pipeline_context->'routing_hint'->>'suggested_bot_id' AS suggested_bot,
             c.pipeline_context->'routing_hint'->>'score' AS score,
             c.pipeline_context->>'route_reason' AS reason,
             c.pipeline_context->>'channel' AS channel,
             c.pipeline_context->>'thread_ts' AS thread_ts,
             c.title,
             c.created_at::text AS created_at
           FROM semo.bot_commitments c
           WHERE c.pipeline_context->'routing_hint' IS NOT NULL
             AND c.created_at > NOW() - INTERVAL '${intervalSql}'
           ORDER BY c.created_at DESC`,
      );

      // 2. 각 commitment 의 outbox escalation 찾기 — landed_bot 의 outbox.jsonl 에서
      //    같은 thread_ts 의 type='escalation' 추출
      const mboxDir = process.env.SEMO_MAILBOX_DIR ?? path.join(os.homedir(), '.semo', 'mailbox');
      interface AuditRow {
        created: string;
        channel: string | null;
        suggested: string | null;
        landed: string;
        actual: string | null;
        score: string | null;
        title: string;
        mismatch: boolean;
        reason: string | null;
      }
      const audit: AuditRow[] = [];
      for (const c of r.rows) {
        const outboxPath = path.join(mboxDir, c.landed_bot, 'outbox.jsonl');
        let actual: string | null = null;
        let escalationReason: string | null = null;
        if (fs.existsSync(outboxPath)) {
          for (const line of fs.readFileSync(outboxPath, 'utf8').split('\n')) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === 'escalation' && msg.thread_id === c.thread_ts && msg.target_bot_id) {
                actual = msg.target_bot_id;
                escalationReason = msg.escalation_reason ?? null;
                break;
              }
            } catch {
              // skip
            }
          }
        }
        const mismatch = actual !== null && actual !== c.suggested_bot;
        if (opts.mismatchOnly && !mismatch) continue;
        audit.push({
          created: new Date(c.created_at).toLocaleString('ko-KR'),
          channel: c.channel,
          suggested: c.suggested_bot,
          landed: c.landed_bot,
          actual,
          score: c.score,
          title: (c.title ?? '').slice(0, 40),
          mismatch,
          reason: escalationReason ? escalationReason.slice(0, 80) : null,
        });
      }

      if (opts.format === 'json') {
        console.log(JSON.stringify(audit, null, 2));
      } else {
        console.log(
          chalk.cyan.bold(
            `\n📊 routing-audit (since ${opts.since}, ${audit.length}건${opts.mismatchOnly ? ', mismatch only' : ''})\n`,
          ),
        );
        if (audit.length === 0) {
          console.log(chalk.green('  ✓ 매칭 결과 없음'));
        } else {
          console.log(
            chalk.gray(
              '  hint→landed→actual                    score  title                                     created',
            ),
          );
          console.log(chalk.gray('  ' + '─'.repeat(120)));
          for (const a of audit) {
            const flow = `${(a.suggested ?? '-').padEnd(12)} → ${a.landed.padEnd(10)} → ${(a.actual ?? '∅').padEnd(12)}`;
            const flowColored = a.mismatch ? chalk.red(flow) : chalk.green(flow);
            console.log(
              `  ${flowColored} ${(a.score ?? '-').padStart(3)}    ${a.title.padEnd(40)}  ${a.created}`,
            );
            if (a.reason) console.log(chalk.gray(`    └ ${a.reason}`));
          }
          const matched = audit.filter((a) => !a.mismatch && a.actual).length;
          const mismatched = audit.filter((a) => a.mismatch).length;
          const noEscalation = audit.filter((a) => !a.actual).length;
          console.log();
          console.log(
            chalk.gray(
              `  총 ${audit.length}건 (matched: ${matched}, mismatched: ${mismatched}, no-escalation: ${noEscalation})\n`,
            ),
          );
        }
      }
      await closeConnection();
    });

  // ── semo bots reembed-kb ────────────────────────────────────
  // 임베딩 누락 자동 백필 — agent factory 가 raw SQL seed 후 별 트랜잭션 kbUpsert 호출이
  // 실패한 경우 보상 작업. 또는 운영 중 임베딩이 빠진 entry 발견 시 일괄 재생성.
  botsCmd
    .command('reembed-kb')
    .description('agents 도메인의 임베딩 누락 KB entry 일괄 재 kbUpsert (임베딩 자동 생성)')
    .option(
      '--keys <csv>',
      '대상 키 (csv, 기본: identity,delegation,status,slack-profile)',
      'identity,delegation,status,slack-profile',
    )
    .option('--bot <id>', '특정 봇만 처리 (기본: 전체 active 봇)')
    .option('--dry-run', '대상 entry 만 표시 (실 upsert X)')
    .action(async (opts: { keys: string; bot?: string; dryRun?: boolean }) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('✗ DB 연결 실패'));
        process.exit(1);
      }
      const keys = opts.keys
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const pool = getPool();
      const whereBot = opts.bot ? 'AND kb.domain = $2' : '';
      const params: unknown[] = [keys];
      if (opts.bot) params.push(opts.bot);
      const r = await pool.query(
        `SELECT kb.domain, kb.key, kb.sub_key, kb.content
         FROM semo.knowledge_base kb
         JOIN semo.ontology o ON o.domain = kb.domain
         JOIN semo.bot_status bs ON bs.bot_id = kb.domain
         WHERE o.entity_type = 'agents'
           AND kb.key = ANY($1::text[])
           AND kb.embedding IS NULL
           AND bs.status != 'retired'
           ${whereBot}
         ORDER BY kb.domain, kb.key`,
        params,
      );
      console.log(
        chalk.cyan.bold(
          `\n🔄 reembed-kb — 누락 ${r.rows.length}개 entry${opts.dryRun ? ' (dry-run)' : ''}\n`,
        ),
      );
      if (r.rows.length === 0) {
        console.log(chalk.green('  ✓ 임베딩 누락 entry 없음'));
        await closeConnection();
        return;
      }
      if (opts.dryRun) {
        for (const row of r.rows) {
          console.log(
            `  ${row.domain.padEnd(15)} ${row.key}${row.sub_key ? '/' + row.sub_key : ''}`,
          );
        }
        await closeConnection();
        return;
      }
      const { kbUpsert } = await import('../kb.js');
      let success = 0;
      const failures: string[] = [];
      for (const row of r.rows) {
        try {
          const result = await kbUpsert(pool, {
            domain: row.domain,
            key: row.key,
            sub_key: row.sub_key,
            content: row.content,
            created_by: 'semo-bots-reembed',
          });
          if (result.success) {
            success++;
            console.log(chalk.green(`  ✓ [${row.domain}] ${row.key}`));
          } else {
            failures.push(`${row.domain}/${row.key}: ${result.error}`);
          }
        } catch (err) {
          failures.push(`${row.domain}/${row.key}: ${(err as Error).message.slice(0, 80)}`);
        }
      }
      console.log(
        chalk.cyan(
          `\n결과: ${success}/${r.rows.length} 성공${failures.length > 0 ? `, 실패 ${failures.length}` : ''}`,
        ),
      );
      failures.slice(0, 5).forEach((f) => console.log(chalk.red(`  ✗ ${f}`)));
      await closeConnection();
    });

  // ── semo bots status ────────────────────────────────────────
  botsCmd
    .command('status')
    .description('모든 봇의 현재 상태 조회')
    .option('--status <filter>', '상태 필터 (online|offline)')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('봇 상태 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        // bot_commitments LEFT JOIN — 실제 활동 SoT.
        // table.status / table.last_active 는 SOUL.md mtime 기반이라 stale.
        // derived_status 는 commit_at 기준: <=1h active, <=24h recent, else idle.
        let query = `
          SELECT
            bs.bot_id, bs.name, bs.emoji, bs.role, bs.status,
            bs.last_active::text, bs.session_count, bs.workspace_path, bs.synced_at::text,
            agg.last_commit_at::text AS last_commit_at,
            COALESCE(agg.commit_count_24h, 0)::int AS commit_count_24h,
            CASE
              WHEN agg.last_commit_at > NOW() - INTERVAL '1 hour'  THEN 'active'
              WHEN agg.last_commit_at > NOW() - INTERVAL '24 hours' THEN 'recent'
              WHEN agg.last_commit_at IS NULL                      THEN 'none'
              ELSE 'idle'
            END AS derived_status
          FROM semo.bot_status bs
          LEFT JOIN (
            SELECT bot_id,
                   MAX(updated_at) AS last_commit_at,
                   COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') AS commit_count_24h
            FROM semo.bot_commitments
            GROUP BY bot_id
          ) agg ON agg.bot_id = bs.bot_id
        `;
        const params: string[] = [];
        if (options.status) {
          // active|recent|idle|none 필터로 해석.
          query += ` WHERE CASE
              WHEN agg.last_commit_at > NOW() - INTERVAL '1 hour'  THEN 'active'
              WHEN agg.last_commit_at > NOW() - INTERVAL '24 hours' THEN 'recent'
              WHEN agg.last_commit_at IS NULL                      THEN 'none'
              ELSE 'idle'
            END = $1`;
          params.push(options.status);
        }
        query += ' ORDER BY agg.last_commit_at DESC NULLS LAST, bs.bot_id';

        const result = await client.query(query, params);
        client.release();

        const bots: BotStatus[] = result.rows;
        spinner.stop();

        // S2: pump-stats.json join — inbox-pump 활동 메트릭 (sent/skipped/dead/pending).
        const pumpStats = loadPumpStats(bots.map((b) => b.bot_id));

        if (options.format === 'json') {
          console.log(
            JSON.stringify(
              bots.map((b) => ({ ...b, pump_stats: pumpStats.get(b.bot_id) ?? null })),
              null,
              2,
            ),
          );
        } else {
          console.log(chalk.cyan.bold('\n🤖 봇 상태 (commitments + inbox-pump 기반)\n'));

          if (bots.length === 0) {
            console.log(chalk.yellow('  봇 상태 데이터가 없습니다.'));
            console.log(chalk.gray("  'semo bots sync'로 초기 데이터를 적재하세요."));
          } else {
            console.log(
              chalk.gray(
                '  봇              이름                  활동      24h  pane    pending sent skip-d  마지막 활동',
              ),
            );
            console.log(chalk.gray('  ' + '─'.repeat(110)));
            for (const b of bots) {
              const statusIcon =
                b.derived_status === 'active'
                  ? chalk.green('🟢 act ')
                  : b.derived_status === 'recent'
                    ? chalk.yellow('🟡 rcnt')
                    : b.derived_status === 'idle'
                      ? chalk.gray('⚫ idle')
                      : chalk.gray('⚪ none');
              const lastActive = b.last_commit_at
                ? new Date(b.last_commit_at).toLocaleString('ko-KR')
                : '-';
              const displayName = `${b.emoji || ''} ${b.name || b.bot_id}`.trim();
              const cnt24 = String(b.commit_count_24h ?? 0).padStart(3);
              const ps = pumpStats.get(b.bot_id);
              const pane = ps?.last_pane_state ?? '-';
              const paneColored =
                pane === 'idle'
                  ? chalk.green(pane.padEnd(6))
                  : pane === 'busy'
                    ? chalk.yellow(pane.padEnd(6))
                    : pane === 'dead'
                      ? chalk.red(pane.padEnd(6))
                      : chalk.gray(pane.toString().padEnd(6));
              const pending = String(ps?.pending ?? '-').padStart(4);
              const sent = String(ps?.sent ?? '-').padStart(4);
              const skipDead = String(ps?.skipped_dead ?? '-').padStart(4);
              console.log(
                `  ${b.bot_id.padEnd(16)}${displayName.padEnd(22)}${String(statusIcon).padEnd(8)}${cnt24}  ${paneColored} ${pending}  ${sent} ${skipDead}    ${lastActive}`,
              );
            }
          }

          console.log();
          const active = bots.filter((b) => b.derived_status === 'active').length;
          const recent = bots.filter((b) => b.derived_status === 'recent').length;
          const pumpAlive = Array.from(pumpStats.values()).filter(
            (ps) => Date.now() - new Date(ps.pump_alive_at).getTime() < 60_000,
          ).length;
          console.log(
            chalk.gray(
              `  총 ${bots.length}개 봇 (active: ${active}, recent24h: ${recent}, inbox-pump alive: ${pumpAlive})\n`,
            ),
          );
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots sessions ──────────────────────────────────────
  botsCmd
    .command('sessions')
    .description('봇 세션 히스토리 조회')
    .option('--bot <name>', '특정 봇만')
    .option('--limit <n>', '최대 조회 수', '20')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('세션 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, session_key, label, kind, chat_type,
                 last_activity::text, message_count
          FROM semo.bot_sessions
        `;
        const params: (string | number)[] = [];
        let idx = 1;

        if (options.bot) {
          query += ` WHERE bot_id = $${idx++}`;
          params.push(options.bot);
        }
        query += ` ORDER BY last_activity DESC NULLS LAST LIMIT $${idx++}`;
        params.push(parseInt(options.limit));

        const result = await client.query(query, params);
        client.release();

        const sessions: BotSession[] = result.rows;
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(sessions, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n📋 봇 세션 히스토리\n'));
          if (sessions.length === 0) {
            console.log(chalk.yellow('  세션 데이터가 없습니다.'));
          } else {
            for (const s of sessions) {
              const lastActivity = s.last_activity
                ? new Date(s.last_activity).toLocaleString('ko-KR')
                : '-';
              console.log(
                chalk.cyan(`  ${s.bot_id}`) +
                  chalk.gray(` [${s.session_key}]`) +
                  (s.label ? chalk.white(` "${s.label}"`) : '') +
                  chalk.gray(` ${lastActivity} (${s.message_count}msg)`),
              );
            }
          }
          console.log();
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots sync ──────────────────────────────────────────
  botsCmd
    .command('sync')
    .description('bot-workspaces/ 스캔 → semo.bot_status DB upsert + KB identity 동기화')
    .option('--dry-run', '실제 upsert 없이 미리보기')
    .option('--skip-kb', 'KB identity 동기화 건너뛰기 (raw bot_status 만 갱신)')
    .action(async (options) => {
      const spinner = ora('bot-workspaces 스캔 중...').start();
      const bots = scanBotWorkspaces();

      if (bots.length === 0) {
        spinner.warn('봇 워크스페이스가 없습니다.');
        return;
      }

      spinner.text = `${bots.length}개 봇 발견`;

      if (options.dryRun) {
        spinner.stop();
        console.log(chalk.cyan.bold('\n[dry-run] 감지된 봇:\n'));
        for (const bot of bots) {
          const display = [bot.emoji, bot.name].filter(Boolean).join(' ') || bot.botId;
          console.log(
            chalk.gray(`  ${bot.botId.padEnd(16)}`) +
              chalk.white(display.padEnd(24)) +
              chalk.gray(bot.lastActive?.toLocaleString('ko-KR') || '-'),
          );
        }
        console.log();
        return;
      }

      spinner.text = `${bots.length}개 봇 DB 반영 중...`;

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      const pool = getPool();
      const client = await pool.connect();
      let upserted = 0;
      const errors: string[] = [];

      try {
        await client.query('BEGIN');

        spinner.text = `${bots.length}개 봇 DB 반영 중...`;

        for (const bot of bots) {
          try {
            const detectedStatus = 'offline';
            await client.query(
              `INSERT INTO semo.bot_status
                 (bot_id, name, emoji, role, status, last_active, workspace_path, synced_at)
               VALUES ($1, $2, $3, $4, $7, $5, $6, NOW())
               ON CONFLICT (bot_id) DO UPDATE SET
                 name           = COALESCE(EXCLUDED.name, semo.bot_status.name),
                 emoji          = COALESCE(EXCLUDED.emoji, semo.bot_status.emoji),
                 role           = COALESCE(EXCLUDED.role, semo.bot_status.role),
                 status         = EXCLUDED.status,
                 last_active    = CASE
                   WHEN EXCLUDED.last_active IS NOT NULL
                     AND (semo.bot_status.last_active IS NULL
                          OR EXCLUDED.last_active > semo.bot_status.last_active)
                   THEN EXCLUDED.last_active
                   ELSE semo.bot_status.last_active
                 END,
                 workspace_path = EXCLUDED.workspace_path,
                 synced_at      = NOW()`,
              [
                bot.botId,
                bot.name,
                bot.emoji,
                bot.role,
                bot.lastActive?.toISOString() || null,
                bot.workspacePath,
                detectedStatus,
              ],
            );
            upserted++;
          } catch (err) {
            errors.push(`${bot.botId}: ${err}`);
          }
        }

        await client.query('COMMIT');
        spinner.succeed(`bots sync 완료: ${upserted}개 봇 업서트`);
        if (errors.length > 0) {
          errors.forEach((e) => console.log(chalk.red(`  ❌ ${e}`)));
        }

        // Cron jobs — DB 카운트 표시 (파일 sync 제거됨, Phase 4-A)
        try {
          const cronStats = await getCronJobStats(pool);
          if (cronStats.jobs > 0) {
            console.log(
              chalk.green(`  → 크론잡: ${cronStats.bots}개 봇, ${cronStats.jobs}개 잡 (DB SoT)`),
            );
          }
        } catch {
          // 비치명적
        }

        // Audit piggyback — sync 후 자동 audit 실행
        try {
          console.log(chalk.gray('  → audit 실행 중...'));
          let auditResults = await Promise.all(
            bots.map((b) => auditBotFromDb(b.workspacePath, b.botId, pool)),
          );
          // KB 도메인 체크 merge (팀 레벨 — 한 번 조회 후 전체 적용)
          const kbChecks = await auditBotKb(pool);
          auditResults = auditResults.map((r) => mergeDbChecks(r, kbChecks));
          const auditClient = await pool.connect();
          await storeAuditResults(auditResults, auditClient);
          auditClient.release();
          const good = auditResults.filter((r) => r.rating === 'GOOD').length;
          console.log(chalk.green(`  → audit 완료: ${auditResults.length}개 봇 (GOOD: ${good})`));
        } catch {
          console.log(chalk.yellow('  ⚠ audit 저장 실패 (무시)'));
        }

        // Files piggyback — 워크스페이스 파일 → bot_workspace_files 동기화
        try {
          console.log(chalk.gray('  → files sync 실행 중...'));
          const filesClient = await pool.connect();
          try {
            let totalFiles = 0;
            for (const bot of bots) {
              totalFiles += await syncWorkspaceFiles(filesClient, bot.botId, bot.workspacePath);
            }
            // Shared files
            const sharedDir = path.join(os.homedir(), '.semo', 'shared');
            if (fs.existsSync(sharedDir)) {
              totalFiles += await syncWorkspaceFiles(filesClient, '_shared', sharedDir);
            }
            console.log(chalk.green(`  → files sync 완료: ${totalFiles}개 파일`));
          } finally {
            filesClient.release();
          }
        } catch (filesErr) {
          console.log(chalk.yellow(`  ⚠ files sync 실패 (무시): ${filesErr}`));
        }

        // KB identity piggyback — SOUL.md 파싱 결과 → KB {bot_id}/identity (라우팅 SoT)
        // 봇 이름 하드코딩 없음 — bot_status 와 동일한 scanned 결과 사용.
        if (!options.skipKb) {
          try {
            console.log(chalk.gray('  → KB identity sync 실행 중...'));
            const kbResult = await syncBotIdentitiesToKb(bots);
            if (kbResult.errors.length === 0) {
              console.log(
                chalk.green(`  → KB identity sync 완료: ${kbResult.synced}/${bots.length}개 봇`),
              );
            } else {
              console.log(
                chalk.yellow(
                  `  ⚠ KB identity sync 부분 실패: ${kbResult.synced}/${bots.length} (errors: ${kbResult.errors.length})`,
                ),
              );
              kbResult.errors.slice(0, 3).forEach((e) => console.log(chalk.gray(`     ${e}`)));
            }
          } catch (kbErr) {
            console.log(chalk.yellow(`  ⚠ KB identity sync 실패 (무시): ${kbErr}`));
          }
        }
      } catch (err) {
        await client.query('ROLLBACK');
        spinner.fail(`sync 실패: ${err}`);
        process.exit(1);
      } finally {
        client.release();
        await closeConnection();
      }
    });

  // ── semo bots audit ───────────────────────────────────────────
  botsCmd
    .command('audit')
    .description('봇 워크스페이스 표준 구조 audit')
    .option('--format <type>', '출력 형식 (table|json|slack)', 'table')
    .option('--fix', '누락 파일/디렉토리 자동 생성 (DB fix_action 활용)')
    .option('--sync', 'DB required 항목 proactive 보장 (누락 파일 생성)')
    .option('--force', 'delete fix_action 실행 허용 (--fix와 함께 사용)')
    .option('--no-db', 'DB 저장 건너뛰기')
    .option('--local', '~/.claude/semo/bots/ 로컬 미러 audit')
    .action(async (options) => {
      const home = process.env.HOME || os.homedir();

      const isLocal = options.local === true;
      const sourceLabel = isLocal ? '~/.claude/semo/bots/' : '~/.semo/workspaces/*/';
      const spinner = ora(`bot-workspaces audit 중... (${sourceLabel})`).start();

      const botEntries: { botId: string; botDir: string }[] = [];

      if (isLocal) {
        // 로컬 미러: ~/.claude/semo/bots/{botId}/
        const semoBotsDir = path.join(home, '.claude', 'semo', 'bots');
        if (fs.existsSync(semoBotsDir)) {
          const dirs = fs
            .readdirSync(semoBotsDir)
            .filter((f) => fs.statSync(path.join(semoBotsDir, f)).isDirectory());
          for (const botId of dirs) {
            botEntries.push({ botId, botDir: path.join(semoBotsDir, botId) });
          }
        }
      } else {
        for (const botId of discoverBotIds()) {
          const botDir = resolveBotWorkspace(botId);
          if (fs.existsSync(botDir)) {
            botEntries.push({ botId, botDir });
          }
        }
      }

      if (botEntries.length === 0) {
        spinner.warn('봇 워크스페이스가 없습니다.');
        return;
      }

      // Run audit — try DB-based rules first, fallback to hardcoded
      let results: BotAuditResult[];
      const dbConnected = await isDbConnected();
      let dbRules: WorkspaceStandardRow[] = [];

      if (dbConnected) {
        const pool = getPool();
        try {
          const { rows } = await loadCheckDefs(pool);
          dbRules = rows;
        } catch {
          /* DB rules load failed, will use fallback */
        }
        results = await Promise.all(
          botEntries.map(({ botId, botDir }) => auditBotFromDb(botDir, botId, pool)),
        );
      } else {
        results = botEntries.map(({ botId, botDir }) => auditBot(botDir, botId));
      }

      // Merge skill structure checks into results
      for (let i = 0; i < results.length; i++) {
        const skillChecks = auditSkillStructure(botEntries[i].botDir, botEntries[i].botId);
        if (skillChecks.length > 0) {
          results[i] = mergeDbChecks(results[i], skillChecks);
        }
      }

      spinner.stop();

      // --sync: DB required 항목 proactive 보장
      if (options.sync && dbRules.length > 0) {
        let totalCreated = 0;
        const allViolations: string[] = [];
        for (const { botId, botDir } of botEntries) {
          const botSpecificRules = dbRules.filter((row) => {
            if (row.bot_scope === 'all') return true;
            if (row.bot_scope === 'include') return row.bot_ids.includes(botId);
            if (row.bot_scope === 'exclude') return !row.bot_ids.includes(botId);
            return true;
          });
          const { created, violations } = syncBotFromDb(botDir, botId, botSpecificRules);
          if (created > 0) {
            console.log(chalk.green(`  ✔ ${botId}: ${created}개 항목 동기화 생성`));
            totalCreated += created;
          }
          allViolations.push(...violations.map((v) => `${botId}: ${v}`));
        }
        if (totalCreated > 0) {
          console.log(chalk.green(`\n총 ${totalCreated}개 동기화`));
        }
        if (allViolations.length > 0) {
          console.log(chalk.yellow(`\n⚠ content_rules 위반 (보고만):`));
          for (const v of allViolations) {
            console.log(chalk.yellow(`  - ${v}`));
          }
        }
        // Re-audit after sync
        if (totalCreated > 0) {
          if (dbConnected) {
            const pool = getPool();
            results = await Promise.all(
              botEntries.map(({ botId, botDir }) => auditBotFromDb(botDir, botId, pool)),
            );
          } else {
            results = botEntries.map(({ botId, botDir }) => auditBot(botDir, botId));
          }
          for (let i = 0; i < results.length; i++) {
            const skillChecks = auditSkillStructure(botEntries[i].botDir, botEntries[i].botId);
            if (skillChecks.length > 0) {
              results[i] = mergeDbChecks(results[i], skillChecks);
            }
          }
        }
      }

      // --fix
      if (options.fix) {
        let totalFixed = 0;
        for (const r of results) {
          const botDir = isLocal
            ? path.join(home, '.claude', 'semo', 'bots', r.botId)
            : resolveBotWorkspace(r.botId);

          let fixed: number;
          if (dbRules.length > 0) {
            // DB-based fix
            const botSpecificRules = dbRules.filter((row) => {
              if (row.bot_scope === 'all') return true;
              if (row.bot_scope === 'include') return row.bot_ids.includes(r.botId);
              if (row.bot_scope === 'exclude') return !row.bot_ids.includes(r.botId);
              return true;
            });
            const result = fixBotFromDb(botDir, r.botId, r.checks, botSpecificRules, {
              force: options.force,
            });
            fixed = result.fixed;
            if (result.skipped.length > 0) {
              for (const s of result.skipped) {
                console.log(chalk.yellow(`  ⚠ ${r.botId}: ${s}`));
              }
            }
          } else {
            // Fallback to hardcoded fix
            fixed = fixBot(botDir, r.botId, r.checks);
          }

          if (fixed > 0) {
            console.log(chalk.green(`  ✔ ${r.botId}: ${fixed}개 파일/디렉토리 수정`));
            totalFixed += fixed;
          }
        }
        if (totalFixed > 0) {
          console.log(chalk.green(`\n총 ${totalFixed}개 수정`));
          // Re-audit after fix
          if (dbConnected) {
            const pool = getPool();
            results = await Promise.all(
              botEntries.map(({ botId, botDir }) => auditBotFromDb(botDir, botId, pool)),
            );
          } else {
            results = botEntries.map(({ botId, botDir }) => auditBot(botDir, botId));
          }
          for (let i = 0; i < results.length; i++) {
            const skillChecks = auditSkillStructure(botEntries[i].botDir, botEntries[i].botId);
            if (skillChecks.length > 0) {
              results[i] = mergeDbChecks(results[i], skillChecks);
            }
          }
        }
      }

      // DB sync checks + store
      if (options.db !== false) {
        const connected = await isDbConnected();
        if (connected) {
          const pool = getPool();

          // Merge DB sync checks into results
          try {
            for (let i = 0; i < results.length; i++) {
              const dbChecks = await auditBotDb(results[i].botId, pool);
              results[i] = mergeDbChecks(results[i], dbChecks);
            }
          } catch (err) {
            console.log(chalk.yellow(`  ⚠ DB sync 체크 실패: ${err}`));
          }

          // Merge KB domain checks (team-level — 한 번 조회 후 전체 적용)
          try {
            const kbChecks = await auditBotKb(pool);
            for (let i = 0; i < results.length; i++) {
              results[i] = mergeDbChecks(results[i], kbChecks);
            }
          } catch (err) {
            console.log(chalk.yellow(`  ⚠ KB 도메인 체크 실패: ${err}`));
          }

          // Store results (separate try — table may not exist yet)
          try {
            const client = await pool.connect();
            try {
              await storeAuditResults(results, client);
            } finally {
              client.release();
            }
          } catch {
            // bot_workspace_audits table may not exist — silent skip
          }

          await closeConnection();
        } else {
          await closeConnection();
        }
      }

      // Output
      if (options.format === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else if (options.format === 'slack') {
        console.log(formatAuditSlack(results));
      } else {
        console.log(chalk.cyan.bold('\n🔍 Bot Workspace Audit\n'));
        console.log(chalk.gray('  봇              Score  Rating       Passed'));
        console.log(chalk.gray('  ' + '─'.repeat(55)));

        for (const r of results) {
          const ratingColor =
            r.rating === 'GOOD'
              ? chalk.green
              : r.rating === 'NEEDS-WORK'
                ? chalk.yellow
                : chalk.red;
          const passed = r.checks.filter((c) => c.passed).length;
          console.log(
            `  ${r.botId.padEnd(16)}${String(r.score).padStart(3)}%   ${ratingColor(r.rating.padEnd(12))} ${passed}/${r.checks.length}`,
          );
        }

        const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
        const good = results.filter((r) => r.rating === 'GOOD').length;
        console.log(chalk.gray(`\n  ${results.length}개 봇, 평균 ${avgScore}%, GOOD: ${good}개\n`));
      }
    });

  // ── semo bots seed ──────────────────────────────────────────
  botsCmd
    .command('seed')
    .description('[deprecated] 스킬/에이전트 SoT는 DB 직접 관리로 전환됨')
    .action(async () => {
      console.log(chalk.yellow("\n⚠ 'semo bots seed'는 더 이상 사용되지 않습니다."));
      console.log(
        chalk.gray(
          '  스킬/에이전트 SoT는 DB(skill_definitions, agent_definitions)로 이전되었습니다.',
        ),
      );
      console.log(chalk.gray('  수정은 직접 DB UPDATE 또는 마이그레이션을 사용하세요.\n'));
    });

  // ── semo bots cron ──────────────────────────────────────────
  const cronCmd = botsCmd.command('cron').description('봇 크론잡 조회 및 동기화');

  cronCmd
    .command('list')
    .description('DB에서 봇 크론잡 조회')
    .option('--bot <name>', '특정 봇만')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('크론잡 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, job_id, name, schedule, enabled,
                 last_run::text, next_run::text, session_target, synced_at::text
          FROM semo.bot_cron_jobs
        `;
        const params: string[] = [];
        if (options.bot) {
          query += ' WHERE bot_id = $1';
          params.push(options.bot);
        }
        query += ' ORDER BY bot_id, name';

        const result = await client.query(query, params);
        client.release();
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n⏰ 봇 크론잡\n'));

          if (result.rows.length === 0) {
            console.log(chalk.yellow('  크론잡 데이터가 없습니다.'));
            console.log(
              chalk.gray("  'semo bots cron sync' 또는 'semo context sync'로 동기화하세요."),
            );
          } else {
            let currentBot = '';
            for (const row of result.rows) {
              if (row.bot_id !== currentBot) {
                currentBot = row.bot_id;
                console.log(chalk.white.bold(`  ${currentBot}`));
              }
              const status = row.enabled ? chalk.green('●') : chalk.red('○');
              const nextRun = row.next_run ? new Date(row.next_run).toLocaleString('ko-KR') : '-';
              console.log(`    ${status} ${(row.name || row.job_id).padEnd(30)} next: ${nextRun}`);
            }
          }

          console.log();
          const enabledCount = result.rows.filter((r: any) => r.enabled).length;
          console.log(chalk.gray(`  총 ${result.rows.length}개 잡 (활성: ${enabledCount}개)\n`));
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  cronCmd
    .command('sync')
    .description('[deprecated] → semo cron import 사용')
    .action(async () => {
      console.log(chalk.yellow('⚠️  [deprecated] 파일 기반 크론 sync는 제거되었습니다.'));
      console.log(
        chalk.yellow(
          '   기존 파일에서 임포트: semo cron import ~/.semo/workspaces/{bot}/cron/jobs.json',
        ),
      );
      console.log(
        chalk.yellow(
          '   새 잡 생성: semo cron create --bot {id} --name {name} --schedule "cron:..."',
        ),
      );
      console.log(chalk.yellow('   DB 조회: semo cron list'));
    });

  // ── semo bots delegation ─────────────────────────────────────
  botsCmd
    .command('delegation')
    .description('봇 간 위임 매트릭스 조회')
    .option('--bot <name>', '특정 봇의 위임 관계만')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('위임 매트릭스 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const delegations = await getDelegations(options.bot || undefined);
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(delegations, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n🔗 봇 위임 매트릭스\n'));

          if (delegations.length === 0) {
            console.log(chalk.yellow('  위임 데이터가 없습니다.'));
            console.log(chalk.gray("  'semo bots seed'로 위임 매트릭스를 시딩하세요."));
          } else {
            let currentFrom = '';
            for (const d of delegations) {
              if (d.from_bot_id !== currentFrom) {
                currentFrom = d.from_bot_id;
                console.log(chalk.white.bold(`  ${currentFrom}`));
              }
              const domains = d.domains.join(', ');
              console.log(
                chalk.gray(`    → ${d.to_bot_id.padEnd(14)}`) +
                  chalk.white(`[${d.delegation_type}] `) +
                  chalk.cyan(domains) +
                  chalk.gray(` (via ${d.method})`),
              );
            }
          }

          console.log();
          console.log(chalk.gray(`  총 ${delegations.length}개 위임 관계\n`));
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots skill-deploy ──────────────────────────────────
  botsCmd
    .command('skill-deploy')
    .description('DB skill_definitions → 봇 워크스페이스 SKILL.md 역배포')
    .option('--bot <botId>', '특정 봇에만 배포')
    .option('--dry-run', '파일 쓰기 없이 계획만 출력')
    .option('--force', '기존 SKILL.md와 내용이 달라도 덮어쓰기')
    .action(async (options) => {
      const spinner = ora('스킬 배포 준비 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const skills = await getActiveSkills();
        spinner.succeed(`활성 스킬 ${skills.length}개 조회 완료`);

        // Filter skills that have bot_ids assigned and content
        const deployable = skills.filter(
          (s) => s.bot_ids && s.bot_ids.length > 0 && s.content && s.content.trim(),
        );

        if (deployable.length === 0) {
          console.log(chalk.yellow('배포 가능한 스킬이 없습니다.'));
          return;
        }

        // Build (skill, botId) pairs
        type Action = 'CREATE' | 'OVERWRITE' | 'SKIP_SAME' | 'SKIP_EXISTS';
        interface DeployEntry {
          skillName: string;
          botId: string;
          action: Action;
          filePath: string;
          content: string;
        }

        const entries: DeployEntry[] = [];

        for (const skill of deployable) {
          const targetBots = options.bot
            ? skill.bot_ids.filter((b: string) => b === options.bot)
            : skill.bot_ids;

          for (const botId of targetBots) {
            const wsDir = resolveBotWorkspace(botId);
            const skillDir = path.join(wsDir, 'skills', skill.name);
            const filePath = path.join(skillDir, 'SKILL.md');

            let action: Action;
            if (!fs.existsSync(filePath)) {
              action = 'CREATE';
            } else {
              const existing = fs.readFileSync(filePath, 'utf-8');
              if (existing === skill.content) {
                action = 'SKIP_SAME';
              } else if (options.force) {
                action = 'OVERWRITE';
              } else {
                action = 'SKIP_EXISTS';
              }
            }

            entries.push({
              skillName: skill.name,
              botId,
              action,
              filePath,
              content: skill.content,
            });
          }
        }

        // Summary table
        const actionColor: Record<Action, (s: string) => string> = {
          CREATE: chalk.green,
          OVERWRITE: chalk.yellow,
          SKIP_SAME: chalk.gray,
          SKIP_EXISTS: chalk.cyan,
        };

        console.log('\n' + chalk.bold('배포 계획:'));
        console.log('─'.repeat(70));
        for (const e of entries) {
          const tag = actionColor[e.action](e.action.padEnd(12));
          console.log(`  ${tag} ${e.botId}/${e.skillName}`);
        }
        console.log('─'.repeat(70));

        const creates = entries.filter((e) => e.action === 'CREATE').length;
        const overwrites = entries.filter((e) => e.action === 'OVERWRITE').length;
        const skipSame = entries.filter((e) => e.action === 'SKIP_SAME').length;
        const skipExists = entries.filter((e) => e.action === 'SKIP_EXISTS').length;
        console.log(
          `  CREATE: ${creates}  OVERWRITE: ${overwrites}  동일: ${skipSame}  스킵(--force 필요): ${skipExists}`,
        );

        if (options.dryRun) {
          console.log(chalk.yellow('\n--dry-run: 파일 쓰기를 건너뜁니다.'));
          return;
        }

        const toWrite = entries.filter((e) => e.action === 'CREATE' || e.action === 'OVERWRITE');
        if (toWrite.length === 0) {
          console.log(chalk.green('\n변경할 파일이 없습니다.'));
          return;
        }

        // Write files
        const writeSpinner = ora(`SKILL.md ${toWrite.length}개 배포 중...`).start();
        for (const e of toWrite) {
          const dir = path.dirname(e.filePath);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(e.filePath, e.content, 'utf-8');
        }
        writeSpinner.succeed(`SKILL.md ${toWrite.length}개 배포 완료`);

        // Sync workspace files for affected bots
        const affectedBots = [...new Set(toWrite.map((e) => e.botId))];
        const pool = getPool();
        const client = await pool.connect();
        try {
          for (const botId of affectedBots) {
            const wsDir = resolveBotWorkspace(botId);
            if (fs.existsSync(wsDir)) {
              const syncSpinner = ora(`${botId} 워크스페이스 DB 싱크 중...`).start();
              const count = await syncWorkspaceFiles(client, botId, wsDir);
              syncSpinner.succeed(`${botId} 워크스페이스 싱크 완료 (${count}개 파일 갱신)`);
            }
          }
        } finally {
          client.release();
        }

        console.log(chalk.green(`\n✔ 스킬 역배포 완료`));
      } catch (err) {
        spinner.isSpinning && spinner.fail('스킬 배포 실패');
        console.error(chalk.red(`❌ ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots set-status ─────────────────────────────────────
  botsCmd
    .command('set-status <bot_id> <status>')
    .description('봇 온라인 상태 수동 설정 (online|offline)')
    .action(async (botId: string, status: string) => {
      if (status !== 'online' && status !== 'offline') {
        console.log(chalk.red("❌ status는 'online' 또는 'offline'만 가능합니다."));
        process.exit(1);
      }

      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();
        await client.query(
          `INSERT INTO semo.bot_status (bot_id, status, synced_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (bot_id) DO UPDATE SET
             status = EXCLUDED.status,
             synced_at = NOW()`,
          [botId, status],
        );
        client.release();
        console.log(chalk.green(`✔ ${botId} → ${status}`));
      } catch (err) {
        console.log(chalk.red(`❌ 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
