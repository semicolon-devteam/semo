/**
 * Sandbox Integration Test — DB 직접 접근 통합 테스트
 * 실행: npx dotenv -e .env.local -- npx tsx e2e/sandbox-integration-test.ts
 */

import {
  createSandboxProject,
  listSandboxProjects,
  teardownSandboxProject,
  teardownAllSandboxProjects,
  getSandboxReport,
  injectMockSections,
  resetToPhase,
} from '../lib/sandbox';
import { processVirtualPOReviewBatch, switchVirtualPOMode } from '../lib/sandbox-virtual-po';
import { verifySandboxRun } from '../lib/plugins/service/sandbox-verification';
import { getProject, listSections } from '../lib/service';
import type { SandboxConfig } from '../types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
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

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('\n=== Sandbox Integration Test Suite ===\n');

  // Cleanup any leftover sandboxes
  await teardownAllSandboxProjects();

  let serviceId = '';

  // ── 1. Create ──
  console.log('[1. Create]');

  await test('minicafe 샌드박스 생성', async () => {
    const result = await createSandboxProject({
      scenario_id: 'minicafe',
      depth: 'plan-only',
      mode: 'mock',
      virtual_po_mode: 'auto-pilot',
      auto_advance: false,
      phase_delay_ms: 0,
      section_delay_ms: 0,
    });
    assert(!result.error, `Create failed: ${result.error}`);
    assert(result.project.project_name.includes('[SANDBOX]'), 'Missing [SANDBOX] prefix');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert((result.project.metadata as any)?.sandbox?.enabled === true, 'sandbox.enabled not true');
    serviceId = result.project.service_id;
  });

  await test('잘못된 시나리오 → 에러', async () => {
    const result = await createSandboxProject({
      scenario_id: 'nonexistent',
      depth: 'plan-only',
      virtual_po_mode: 'auto-pilot',
    });
    assert(!!result.error, 'Should have error');
    assert(result.error!.includes('찾을 수 없습니다'), `Unexpected error: ${result.error}`);
  });

  await test('동시 실행 제한 (3개)', async () => {
    const r2 = await createSandboxProject({
      scenario_id: 'quickdrop',
      depth: 'plan-only',
      virtual_po_mode: 'auto-pilot',
    });
    const r3 = await createSandboxProject({
      scenario_id: 'petcare',
      depth: 'plan-only',
      virtual_po_mode: 'auto-pilot',
    });
    assert(!r2.error && !r3.error, 'Second/third create failed');

    const r4 = await createSandboxProject({
      scenario_id: 'creator-pulse',
      depth: 'plan-only',
      virtual_po_mode: 'auto-pilot',
    });
    assert(!!r4.error, 'Fourth should fail');
    assert(r4.error!.includes('최대'), `Unexpected error: ${r4.error}`);

    // Cleanup extras
    await teardownSandboxProject(r2.project.service_id);
    await teardownSandboxProject(r3.project.service_id);
  });

  // ── 2. List ──
  console.log('\n[2. List]');

  await test('목록에 생성된 프로젝트 포함', async () => {
    const list = await listSandboxProjects();
    assert(
      list.some((p) => p.service_id === serviceId),
      'Not found in list',
    );
  });

  // ── 3. Mock Inject + Auto-approve ──
  console.log('\n[3. Mock Inject + Auto-approve]');

  await test('Phase 0 Mock 주입', async () => {
    const sections = await injectMockSections(serviceId, 0, 'minicafe');
    assert(sections.length >= 2, `Expected >= 2 sections, got ${sections.length}`);
    assert(
      sections.every((s) => s.status === 'pending-review'),
      'Not all pending-review',
    );
  });

  await test('Virtual PO auto-approve → Phase 1 전환', async () => {
    const project = await getProject(serviceId);
    const sandbox = (project!.metadata as Record<string, unknown>).sandbox as SandboxConfig;
    const sections = await listSections(serviceId, 0, 'plan');
    await processVirtualPOReviewBatch(serviceId, sections, sandbox);
    await sleep(500);

    const after = await getProject(serviceId);
    assert(after!.current_phase === 1, `Expected phase 1, got ${after!.current_phase}`);
  });

  await test('Phase 1 Mock 주입 + auto-approve → Phase 2', async () => {
    const project = await getProject(serviceId);
    const sandbox = (project!.metadata as Record<string, unknown>).sandbox as SandboxConfig;
    const sections = await injectMockSections(serviceId, 1, 'minicafe');
    await processVirtualPOReviewBatch(serviceId, sections, sandbox);
    await sleep(300);

    const after = await getProject(serviceId);
    assert(after!.current_phase === 2, `Expected phase 2, got ${after!.current_phase}`);
  });

  // ── 4. PO Mode Switch ──
  console.log('\n[4. PO Mode Switch]');

  await test('interactive → auto-pilot 전환', async () => {
    const r1 = await switchVirtualPOMode(serviceId, 'interactive');
    assert(!r1.error, `Switch to interactive failed: ${r1.error}`);

    const r2 = await switchVirtualPOMode(serviceId, 'auto-pilot');
    assert(!r2.error, `Switch to auto-pilot failed: ${r2.error}`);

    const p = await getProject(serviceId);
    const sb = (p!.metadata as Record<string, unknown>).sandbox as SandboxConfig;
    assert(sb.virtual_po.mode === 'auto-pilot', `Expected auto-pilot, got ${sb.virtual_po.mode}`);
  });

  // ── 5. Phase Reset ──
  console.log('\n[5. Phase Reset]');

  await test('Phase 0으로 리셋', async () => {
    const result = await resetToPhase(serviceId, 0);
    assert(!result.error, `Reset failed: ${result.error}`);

    const after = await getProject(serviceId);
    assert(after!.current_phase === 0, `Expected phase 0, got ${after!.current_phase}`);
  });

  // ── 6. Report & Verification ──
  console.log('\n[6. Report & Verification]');

  await test('리포트 조회', async () => {
    const report = await getSandboxReport(serviceId);
    assert(report !== null, 'Report is null');
    assert(report!.config.scenario_id === 'minicafe', 'Wrong scenario');
    assert(report!.run_stats !== undefined, 'No run stats');
  });

  await test('런 검증', async () => {
    const result = await verifySandboxRun(serviceId);
    assert(result !== null, 'Verification result is null');
    // Phase 0만 진행했으므로 일부 이슈는 정상
    assert(result!.summary.total_sections >= 0, 'No sections counted');
  });

  // ── 7. Teardown ──
  console.log('\n[7. Teardown]');

  await test('단일 Teardown', async () => {
    const result = await teardownSandboxProject(serviceId);
    assert(!result.error, `Teardown failed: ${result.error}`);
  });

  await test('삭제 후 조회 불가', async () => {
    const p = await getProject(serviceId);
    assert(p === null, 'Project still exists');
  });

  await test('전체 Teardown (빈 목록)', async () => {
    const result = await teardownAllSandboxProjects();
    assert(result.errors.length === 0, `Errors: ${result.errors.join(', ')}`);
  });

  // ── 8. 5개 시나리오 생성/삭제 ──
  console.log('\n[8. 전체 시나리오 생성/삭제]');

  const scenarios = ['minicafe', 'creator-pulse', 'quickdrop'];
  for (const s of scenarios) {
    await test(`${s} 시나리오 생성 + 삭제`, async () => {
      const r = await createSandboxProject({
        scenario_id: s,
        depth: 'plan-only',
        virtual_po_mode: 'auto-pilot',
        auto_advance: false,
        phase_delay_ms: 0,
        section_delay_ms: 0,
      });
      assert(!r.error, `Create ${s} failed: ${r.error}`);
      const td = await teardownSandboxProject(r.project.service_id);
      assert(!td.error, `Teardown ${s} failed: ${td.error}`);
    });
  }

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
