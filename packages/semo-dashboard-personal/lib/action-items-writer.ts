import 'server-only';
import * as crypto from 'crypto';
import { opsDbWritable, ensureSchema } from './ops-db-writable';

export interface CreateInput {
  owner_domain: string;
  target_domain?: string | null;
  description: string;
  assignee?: string | null;
  deadline?: string | null;
}

export interface UpdateInput {
  description?: string;
  assignee?: string | null;
  deadline?: string | null;
  status?: 'open' | 'completed';
}

export type WriteError =
  | { kind: 'schema_missing' }
  | { kind: 'db_unavailable' }
  | { kind: 'not_found' }
  | { kind: 'invalid_input'; message: string }
  | { kind: 'db_error'; message: string };

export type WriteResult<T> = { ok: true; value: T } | { ok: false; error: WriteError };

function nowUtcIso(): string {
  // SQLite datetime('now') 포맷과 통일: 'YYYY-MM-DD HH:MM:SS' (UTC).
  return new Date().toISOString().replace('T', ' ').replace(/\..+$/, '');
}

function validDeadline(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function createActionItem(input: CreateInput): WriteResult<{ action_item_id: string }> {
  if (!ensureSchema()) return { ok: false, error: { kind: 'schema_missing' } };
  const db = opsDbWritable();
  if (!db) return { ok: false, error: { kind: 'db_unavailable' } };

  const owner = input.owner_domain?.trim();
  const desc = input.description?.trim();
  if (!owner) return { ok: false, error: { kind: 'invalid_input', message: 'owner_domain 필수' } };
  if (!desc) return { ok: false, error: { kind: 'invalid_input', message: 'description 필수' } };
  if (input.deadline && !validDeadline(input.deadline)) {
    return { ok: false, error: { kind: 'invalid_input', message: 'deadline 형식 YYYY-MM-DD' } };
  }

  const id = crypto.randomUUID();
  const now = nowUtcIso();
  try {
    db.prepare(
      `INSERT INTO action_items
       (action_item_id, owner_domain, target_domain, description, assignee, deadline,
        status, priority, source, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', 'normal', 'manual', '{}', ?, ?)`,
    ).run([
      id,
      owner,
      input.target_domain ?? null,
      desc,
      input.assignee ?? null,
      input.deadline ?? null,
      now,
      now,
    ]);
    return { ok: true, value: { action_item_id: id } };
  } catch (err) {
    return { ok: false, error: { kind: 'db_error', message: (err as Error).message } };
  }
}

export function updateActionItem(id: string, input: UpdateInput): WriteResult<void> {
  if (!ensureSchema()) return { ok: false, error: { kind: 'schema_missing' } };
  const db = opsDbWritable();
  if (!db) return { ok: false, error: { kind: 'db_unavailable' } };

  if (input.deadline !== undefined && input.deadline !== null && !validDeadline(input.deadline)) {
    return { ok: false, error: { kind: 'invalid_input', message: 'deadline 형식 YYYY-MM-DD' } };
  }
  if (input.status !== undefined && input.status !== 'open' && input.status !== 'completed') {
    return { ok: false, error: { kind: 'invalid_input', message: 'status 는 open|completed' } };
  }

  const now = nowUtcIso();
  const sets: string[] = [];
  const params: Array<string | null> = [];

  if (input.description !== undefined) {
    const d = input.description.trim();
    if (!d)
      return { ok: false, error: { kind: 'invalid_input', message: 'description 공백 불가' } };
    sets.push('description = ?');
    params.push(d);
  }
  if (input.assignee !== undefined) {
    sets.push('assignee = ?');
    params.push(input.assignee ?? null);
  }
  if (input.deadline !== undefined) {
    sets.push('deadline = ?');
    params.push(input.deadline ?? null);
  }
  if (input.status !== undefined) {
    sets.push('status = ?');
    params.push(input.status);
    // open→completed 전이에서만 completed_at 세팅, completed→open 전이엔 NULL 복귀.
    sets.push('completed_at = ?');
    params.push(input.status === 'completed' ? now : null);
  }

  if (sets.length === 0) {
    return { ok: false, error: { kind: 'invalid_input', message: '변경 필드 없음' } };
  }

  sets.push('updated_at = ?');
  params.push(now);
  params.push(id);

  try {
    const stmt = db.prepare(`UPDATE action_items SET ${sets.join(', ')} WHERE action_item_id = ?`);
    const info = stmt.run(params);
    if (info.changes === 0) return { ok: false, error: { kind: 'not_found' } };
    return { ok: true, value: undefined };
  } catch (err) {
    return { ok: false, error: { kind: 'db_error', message: (err as Error).message } };
  }
}

export function deleteActionItem(id: string): WriteResult<void> {
  if (!ensureSchema()) return { ok: false, error: { kind: 'schema_missing' } };
  const db = opsDbWritable();
  if (!db) return { ok: false, error: { kind: 'db_unavailable' } };

  try {
    const info = db.prepare(`DELETE FROM action_items WHERE action_item_id = ?`).run(id);
    if (info.changes === 0) return { ok: false, error: { kind: 'not_found' } };
    return { ok: true, value: undefined };
  } catch (err) {
    return { ok: false, error: { kind: 'db_error', message: (err as Error).message } };
  }
}

export function errorToResponse(err: WriteError): {
  status: number;
  body: { error: string; message?: string };
} {
  switch (err.kind) {
    case 'schema_missing':
      return {
        status: 503,
        body: {
          error: 'schema_missing',
          message: 'action_items 테이블 없음. `semo migrate-sqlite` 실행 필요',
        },
      };
    case 'db_unavailable':
      return {
        status: 503,
        body: { error: 'db_unavailable', message: 'ops.db 파일을 열 수 없음' },
      };
    case 'not_found':
      return { status: 404, body: { error: 'not_found' } };
    case 'invalid_input':
      return { status: 400, body: { error: 'invalid_input', message: err.message } };
    case 'db_error':
      return { status: 500, body: { error: 'db_error', message: err.message } };
    default: {
      // WriteError 의 kind 가 추가되면 컴파일러가 여기서 잡아준다.
      const _exhaustive: never = err;
      void _exhaustive;
      return { status: 500, body: { error: 'unknown' } };
    }
  }
}
