import { describe, expect, it } from 'vitest';
import type { EmbeddingProvider } from '@team-semicolon/semo-common';
import { TenantKbService } from '../lib/tenant-kb.js';
import type { TenantContext } from '../types.js';

class StubEmbedding implements EmbeddingProvider {
  readonly id = 'stub:test';
  readonly dim = 4;
  embed = async (_text: string) => [0.1, 0.2, 0.3, 0.4];
  embedBatch = async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3, 0.4]);
}

class CapturingPool {
  calls: Array<{ sql: string; params: unknown[] }> = [];

  async query(sql: string, params: unknown[]) {
    this.calls.push({ sql, params });
    return { rows: [] };
  }
}

const tenantCtx: TenantContext = {
  kind: 'tenant',
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  scopes: ['kb:read'],
};

describe('TenantKbService search isolation', () => {
  it('does not expose all platform-global KB rows by default', async () => {
    const pool = new CapturingPool();
    const service = new TenantKbService(
      pool as unknown as ConstructorParameters<typeof TenantKbService>[0],
      new StubEmbedding(),
    );

    await service.search(tenantCtx, 'hello', { topK: 10 });

    const sql = pool.calls[0].sql;
    expect(sql).toContain('tenant_id = $2');
    expect(sql).toContain("scope = 'platform-global'");
    expect(sql).toContain("metadata->>'tenant_visible' = 'true'");
  });

  it('ownOnly search excludes platform-global rows entirely', async () => {
    const pool = new CapturingPool();
    const service = new TenantKbService(
      pool as unknown as ConstructorParameters<typeof TenantKbService>[0],
      new StubEmbedding(),
    );

    await service.search(tenantCtx, 'hello', { topK: 10, ownOnly: true });

    const sql = pool.calls[0].sql;
    expect(sql).toContain('tenant_id = $2');
    expect(sql).not.toContain("scope = 'platform-global'");
    expect(sql).not.toContain('tenant_visible');
  });
});
