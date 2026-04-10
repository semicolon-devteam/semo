/**
 * Sandbox Smoke Test — 프로덕션 배포 검증용
 * 실행: npx tsx e2e/sandbox-smoke-test.ts
 */

const BASE = process.env.BASE_URL || 'https://semo.semi-colon.space';
let passed = 0;
let failed = 0;
const failures: string[] = [];

async function assert(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  ❌ ${name} — ${msg}`);
  }
}

function expect(val: unknown) {
  return {
    toBe(expected: unknown) {
      if (val !== expected) throw new Error(`Expected ${expected}, got ${val}`);
    },
    toBeTruthy() {
      if (!val) throw new Error(`Expected truthy, got ${val}`);
    },
    toContain(sub: string) {
      if (typeof val !== 'string' || !val.includes(sub))
        throw new Error(`Expected "${val}" to contain "${sub}"`);
    },
    toHaveProperty(key: string) {
      if (typeof val !== 'object' || val === null || !(key in val))
        throw new Error(`Expected property "${key}" in ${JSON.stringify(val)}`);
    },
  };
}

async function api(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${BASE}${path}`, opts);
}

async function run() {
  console.log(`\n=== Sandbox Smoke Test (${BASE}) ===\n`);
  let serviceId = '';

  // ── Sandbox CRUD ──
  console.log('[Sandbox CRUD]');

  await assert('POST /api/projects/sandbox — 샌드박스 생성', async () => {
    const res = await api('POST', '/api/projects/sandbox', {
      scenario_id: 'minicafe',
      depth: 'plan-only',
      virtual_po_mode: 'auto-pilot',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project_name).toContain('[SANDBOX]');
    expect(body.metadata?.sandbox?.enabled).toBe(true);
    serviceId = body.service_id;
  });

  await assert('GET /api/projects/sandbox — 목록 조회', async () => {
    const res = await api('GET', '/api/projects/sandbox');
    expect(res.ok).toBeTruthy();
    const body = await res.json();
    const found = body.find((p: { service_id: string }) => p.service_id === serviceId);
    expect(found).toBeTruthy();
  });

  await assert('POST /api/projects/sandbox — 잘못된 시나리오 400', async () => {
    const res = await api('POST', '/api/projects/sandbox', {
      scenario_id: 'nonexistent',
      depth: 'plan-only',
      virtual_po_mode: 'auto-pilot',
    });
    expect(res.status).toBe(400);
  });

  // ── Advance ──
  console.log('\n[Sandbox Advance]');

  await assert('advance-phase — Mock 주입', async () => {
    const res = await api('POST', '/api/projects/sandbox/advance', {
      service_id: serviceId,
      action: 'advance-phase',
    });
    expect(res.ok).toBeTruthy();
  });

  await assert('approve-all-pending — 전체 승인', async () => {
    const res = await api('POST', '/api/projects/sandbox/advance', {
      service_id: serviceId,
      action: 'approve-all-pending',
    });
    expect(res.ok).toBeTruthy();
  });

  await assert('switch-po-mode → interactive', async () => {
    const res = await api('POST', '/api/projects/sandbox/advance', {
      service_id: serviceId,
      action: 'switch-po-mode',
      po_mode: 'interactive',
    });
    expect(res.ok).toBeTruthy();
    const body = await res.json();
    expect(body.message).toContain('interactive');
  });

  await assert('reset-to-phase 0', async () => {
    const res = await api('POST', '/api/projects/sandbox/advance', {
      service_id: serviceId,
      action: 'reset-to-phase',
      target_phase: 0,
    });
    expect(res.ok).toBeTruthy();
  });

  // ── Report ──
  console.log('\n[Sandbox Report]');

  await assert('GET /api/projects/sandbox/report', async () => {
    const res = await api('GET', `/api/projects/sandbox/report?service_id=${serviceId}`);
    expect(res.ok).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('project');
    expect(body).toHaveProperty('config');
    expect(body).toHaveProperty('verification');
    expect(body.config.scenario_id).toContain('minicafe');
  });

  // ── Teardown ──
  console.log('\n[Sandbox Teardown]');

  await assert('DELETE — 단일 Teardown', async () => {
    const res = await api('DELETE', `/api/projects/sandbox?service_id=${serviceId}`);
    expect(res.ok).toBeTruthy();
  });

  await assert('삭제 후 목록에서 제거됨', async () => {
    const res = await api('GET', '/api/projects/sandbox');
    const body = await res.json();
    const found = body.find((p: { service_id: string }) => p.service_id === serviceId);
    expect(!found).toBeTruthy();
  });

  // ── GFP→Service 리다이렉트 ──
  console.log('\n[GFP→Service 리다이렉트]');

  await assert('/api/projects/ → 307 리다이렉트', async () => {
    const res = await fetch(`${BASE}/api/gfp`, { redirect: 'manual' });
    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/api/projects');
  });

  await assert('/api/projects/ 정상 동작', async () => {
    const res = await api('GET', '/api/projects');
    expect(res.ok).toBeTruthy();
  });

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
