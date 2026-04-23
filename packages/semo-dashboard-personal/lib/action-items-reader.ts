import 'server-only';
import type { ActionItem, TeamMember } from '@team-semicolon/dashboard-ui';
import { opsDb } from './ops-db';
import { readTeamMembers } from './team-members-scanner';

export interface ActionItemListPayload {
  items: ActionItem[];
  teamMembers: TeamMember[];
  stats: { total: number; open: number; completed: number };
}

interface Row {
  action_item_id: string;
  owner_domain: string;
  target_domain: string | null;
  iteration_id: string | null;
  description: string;
  assignee: string | null;
  deadline: string | null;
  status: string;
  priority: string;
  category: string | null;
  source: string;
  related_url: string | null;
  sort_order: number;
  completed_at: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

// SQLite 는 `datetime('now')` (UTC) 로 저장됨. ISO 로 정규화해 클라에 내려준다.
function toIso(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? raw : d.toISOString();
}

// metadata TEXT 는 PG 쪽에서 JSONB 였으나 SQLite 로 오면서 TEXT 가 되어 클라이언트가
// 임의 JSON 을 넣을 수 있다. 신뢰 경계 바깥이므로 다음을 차단한다:
//   1) `__proto__` / `constructor` / `prototype` 키 (prototype pollution)
//   2) null prototype 으로 객체 생성 (상속 체인 제거)
//   3) 중첩 깊이 8 초과 (stack 폭주 방지)
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;

// NOTE: JSON.parse 결과(plain data graph, cycle 없음) 전용. 순환 참조를 포함한 값을
// 넣으면 MAX_DEPTH 도달 전에 스택 오버플로우가 날 수 있다. 다른 입력에 재사용하려면
// WeakSet 기반 cycle guard 를 추가할 것.
function sanitize(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v, depth + 1));
  }
  const out = Object.create(null) as Record<string, unknown>;
  for (const k of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = sanitize((value as Record<string, unknown>)[k], depth + 1);
  }
  return out;
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return Object.create(null);
    return sanitize(parsed, 0) as Record<string, unknown>;
  } catch {
    return Object.create(null);
  }
}

function rowToItem(r: Row): ActionItem {
  const status = (
    r.status === 'completed' || r.status === 'cancelled' ? r.status : 'open'
  ) as ActionItem['status'];
  const priority = (
    ['low', 'normal', 'high', 'urgent'].includes(r.priority) ? r.priority : 'normal'
  ) as ActionItem['priority'];
  return {
    action_item_id: r.action_item_id,
    owner_domain: r.owner_domain,
    target_domain: r.target_domain,
    iteration_id: r.iteration_id,
    description: r.description,
    assignee: r.assignee,
    deadline: r.deadline,
    status,
    priority,
    category: r.category,
    source: r.source,
    related_url: r.related_url,
    sort_order: r.sort_order,
    completed_at: toIso(r.completed_at),
    metadata: parseMetadata(r.metadata),
    created_at: toIso(r.created_at) ?? new Date().toISOString(),
    updated_at: toIso(r.updated_at) ?? new Date().toISOString(),
  };
}

// 프로세스 내 캐시 — migration 이후 drop 시나리오 없음.
let tableExistsCache: boolean | null = null;
function tableExists(): boolean {
  if (tableExistsCache !== null) return tableExistsCache;
  const db = opsDb();
  if (!db) return false;
  try {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='action_items'`)
      .get() as { name?: string } | undefined;
    tableExistsCache = !!row?.name;
    return tableExistsCache;
  } catch {
    return false;
  }
}

const EMPTY: ActionItemListPayload = {
  items: [],
  teamMembers: [],
  stats: { total: 0, open: 0, completed: 0 },
};

export function readActionItems(): ActionItemListPayload {
  const db = opsDb();
  if (!db) return EMPTY;
  if (!tableExists()) return EMPTY;
  try {
    const rows = db
      .prepare(
        `SELECT action_item_id, owner_domain, target_domain, iteration_id, description,
                assignee, deadline, status, priority, category, source, related_url,
                sort_order, completed_at, metadata, created_at, updated_at
         FROM action_items
         ORDER BY sort_order ASC, created_at DESC`,
      )
      .all() as Row[];
    const items = rows.map(rowToItem);

    let open = 0;
    let completed = 0;
    for (const it of items) {
      if (it.status === 'open') open += 1;
      else if (it.status === 'completed') completed += 1;
    }
    return {
      items,
      teamMembers: readTeamMembers(),
      stats: { total: items.length, open, completed },
    };
  } catch (err) {
    console.warn('[action-items-reader] query failed:', (err as Error).message);
    return EMPTY;
  }
}
