import { describe, it, expect } from 'vitest';
import type { Pool } from 'pg';
import {
  generateTenantToken,
  hashToken,
  parseBearer,
  isTenantToken,
  TENANT_TOKEN_PREFIX,
  TenantCredentialResolver,
} from '../lib/tenant-credentials.js';

describe('tenant token helpers', () => {
  it('generateTenantToken produces sck_{slug}_ token with matching hash', () => {
    const { token, tokenHash, tokenPrefix } = generateTenantToken('acme');
    expect(token.startsWith(`${TENANT_TOKEN_PREFIX}acme_`)).toBe(true);
    expect(isTenantToken(token)).toBe(true);
    expect(tokenHash).toBe(hashToken(token));
    expect(token.startsWith(tokenPrefix)).toBe(true);
    expect(tokenPrefix.length).toBeLessThan(token.length); // prefix is not the full token
  });

  it('two tokens for same slug differ (random)', () => {
    expect(generateTenantToken('acme').token).not.toBe(generateTenantToken('acme').token);
  });

  it('parseBearer extracts token, case-insensitive, else null', () => {
    expect(parseBearer('Bearer abc123')).toBe('abc123');
    expect(parseBearer('bearer   xyz')).toBe('xyz');
    expect(parseBearer('Token abc')).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
    expect(parseBearer('')).toBeNull();
  });
});

// 가짜 pool: query 호출 기록 + 지정 행 반환.
function fakePool(rows: unknown[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = (async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (/^\s*SELECT/i.test(sql)) return { rows };
    return { rows: [] }; // UPDATE last_used_at
  }) as unknown as Pool['query'];
  return { calls, query };
}

describe('TenantCredentialResolver', () => {
  const NOW = 1_000_000;
  const activeRow = {
    tenant_id: '11111111-1111-1111-1111-111111111111',
    tenant_slug: 'acme',
    scopes: ['kb:read', 'kb:write'],
    expires_at: null,
  };

  it('resolves active credential to tenant context', async () => {
    const pool = fakePool([activeRow]);
    const r = new TenantCredentialResolver(pool, { now: () => NOW });
    const ctx = await r.resolve('sck_acme_token');
    expect(ctx).not.toBeNull();
    expect(ctx!.kind).toBe('tenant');
    expect(ctx!.tenantId).toBe(activeRow.tenant_id);
    expect(ctx!.tenantSlug).toBe('acme');
    expect(ctx!.scopes).toEqual(['kb:read', 'kb:write']);
  });

  it('returns null when no row', async () => {
    const pool = fakePool([]);
    const r = new TenantCredentialResolver(pool, { now: () => NOW });
    expect(await r.resolve('sck_acme_nope')).toBeNull();
  });

  it('does NOT cache null results (re-queries each time)', async () => {
    const pool = fakePool([]); // no row → null
    const r = new TenantCredentialResolver(pool, { now: () => NOW, cacheTtlMs: 30_000 });
    await r.resolve('sck_acme_nope');
    await r.resolve('sck_acme_nope');
    const selects = pool.calls.filter((c) => /^\s*SELECT/i.test(c.sql));
    expect(selects).toHaveLength(2); // null not cached → both hit DB
  });

  it('returns null when expired', async () => {
    const pool = fakePool([{ ...activeRow, expires_at: new Date(NOW - 1000).toISOString() }]);
    const r = new TenantCredentialResolver(pool, { now: () => NOW });
    expect(await r.resolve('sck_acme_old')).toBeNull();
  });

  it('caches resolution (no repeat SELECT within TTL)', async () => {
    const pool = fakePool([activeRow]);
    const r = new TenantCredentialResolver(pool, { now: () => NOW, cacheTtlMs: 30_000 });
    await r.resolve('sck_acme_token');
    await r.resolve('sck_acme_token');
    const selects = pool.calls.filter((c) => /^\s*SELECT/i.test(c.sql));
    expect(selects).toHaveLength(1);
  });

  it('invalidate forces re-query', async () => {
    const pool = fakePool([activeRow]);
    const r = new TenantCredentialResolver(pool, { now: () => NOW, cacheTtlMs: 30_000 });
    await r.resolve('sck_acme_token');
    r.invalidate('sck_acme_token');
    await r.resolve('sck_acme_token');
    const selects = pool.calls.filter((c) => /^\s*SELECT/i.test(c.sql));
    expect(selects).toHaveLength(2);
  });
});
