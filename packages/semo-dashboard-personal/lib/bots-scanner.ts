import 'server-only';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Bot } from '@team-semicolon/dashboard-ui';
import { opsDb } from './ops-db';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

function semoHome(): string {
  return process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
}

function workspacesDir(): string {
  return path.join(semoHome(), 'workspaces');
}

// IDENTITY.md 템플릿 placeholder 감지:
//   - `_(pick something…)_`  — 이탤릭 감싼 힌트
//   - `_something_`           — 전체 이탤릭
//   - `TODO`/`TBD`/`N/A`      — 플레인 텍스트 플레이스홀더
//   - `-`                     — 대시 플레이스홀더
// 매치 시 빈 값으로 취급해 호출측 fallback(botId, '🤖', 'Bot')로 넘김.
const PLAIN_PLACEHOLDERS = new Set(['todo', 'tbd', 'n/a', 'na', '-', '—']);
function cleanPlaceholder(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (t.startsWith('_(')) return '';
  if (/^_.*_$/.test(t)) return '';
  if (PLAIN_PLACEHOLDERS.has(t.toLowerCase())) return '';
  return t;
}

export function parseIdentity(
  content: string,
  botId: string,
): { name: string; emoji: string; role: string } {
  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(\S+)/);
  const roleMatch = content.match(/\*\*(?:Creature|Role|직책):\*\*\s*(.+)/);
  const name = cleanPlaceholder(nameMatch?.[1] ?? '') || botId;
  const emoji = cleanPlaceholder(emojiMatch?.[1] ?? '') || '🤖';
  const role = cleanPlaceholder(roleMatch?.[1] ?? '') || 'Bot';
  return { name, emoji, role };
}

function readIdentityFile(botDir: string): string {
  const identityPath = path.join(botDir, 'IDENTITY.md');
  try {
    return fs.readFileSync(identityPath, 'utf8');
  } catch {
    return '';
  }
}

interface OpsRow {
  bot_id: string;
  last_active: string | null;
  active_recent: string | null;
  seat_count: number;
}

function loadOpsStats(botIds: string[]): Map<string, OpsRow> {
  const db = opsDb();
  const map = new Map<string, OpsRow>();
  if (!db || botIds.length === 0) return map;
  try {
    const placeholders = botIds.map(() => '?').join(',');
    // active_recent = 'active' commitment 의 최근 updated_at 만 집계.
    // 이 값이 ONLINE_THRESHOLD 내면 online — 스테일 active 는 offline 취급.
    const commitRows = db
      .prepare(
        `SELECT bot_id,
                MAX(updated_at) AS last_active,
                MAX(CASE WHEN status = 'active' THEN updated_at END) AS active_recent
         FROM bot_commitments
         WHERE bot_id IN (${placeholders})
         GROUP BY bot_id`,
      )
      .all(...botIds) as {
      bot_id: string;
      last_active: string | null;
      active_recent: string | null;
    }[];
    const seatRows = db
      .prepare(
        `SELECT current_bot_id AS bot_id, COUNT(*) AS seat_count
         FROM bot_seats
         WHERE current_bot_id IN (${placeholders})
         GROUP BY current_bot_id`,
      )
      .all(...botIds) as { bot_id: string; seat_count: number }[];
    const seatMap = new Map(seatRows.map((r) => [r.bot_id, r.seat_count]));
    for (const row of commitRows) {
      map.set(row.bot_id, {
        bot_id: row.bot_id,
        last_active: row.last_active,
        active_recent: row.active_recent,
        seat_count: seatMap.get(row.bot_id) ?? 0,
      });
    }
    for (const [botId, count] of seatMap) {
      if (!map.has(botId)) {
        map.set(botId, {
          bot_id: botId,
          last_active: null,
          active_recent: null,
          seat_count: count,
        });
      }
    }
  } catch (err) {
    console.warn('[bots-scanner] ops query failed:', (err as Error).message);
  }
  return map;
}

// SEMO CLI 는 `datetime('now')` (UTC default) 로 INSERT 한다고 가정.
// `datetime('now','localtime')` 경로가 생기면 이 변환이 +/-9h 어긋난다.
function toIsoOrNow(sqliteUtcDatetime: string | null): string {
  if (!sqliteUtcDatetime) return new Date().toISOString();
  const d = new Date(sqliteUtcDatetime.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function scanBots(): Bot[] {
  const root = workspacesDir();
  if (!fs.existsSync(root)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (err) {
    console.warn('[bots-scanner] readdir failed:', (err as Error).message);
    return [];
  }
  const botIds = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();

  const opsByBot = loadOpsStats(botIds);
  const now = Date.now();

  return botIds.map((botId): Bot => {
    const botDir = path.join(root, botId);
    const identity = parseIdentity(readIdentityFile(botDir), botId);
    const ops = opsByBot.get(botId);
    const lastActiveIso = toIsoOrNow(ops?.last_active ?? null);
    const activeRecentMs = ops?.active_recent
      ? new Date(toIsoOrNow(ops.active_recent)).getTime()
      : null;
    const hasRecentActivity = activeRecentMs != null && now - activeRecentMs < ONLINE_THRESHOLD_MS;
    return {
      id: botId,
      name: identity.name,
      emoji: identity.emoji,
      role: identity.role,
      status: hasRecentActivity ? 'online' : 'offline',
      lastActive: lastActiveIso,
      sessionCount: ops?.seat_count ?? 0,
      workspacePath: botDir,
    };
  });
}
