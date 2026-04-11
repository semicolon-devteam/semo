import { test, expect } from '@playwright/test';

test.describe.serial('Sandbox API — 생성, 목록, 리포트, Phase 진행, Teardown', () => {
  let serviceId: string;

  test('POST /api/projects/sandbox — 샌드박스 생성 (minicafe, plan-only, auto-pilot)', async ({
    request,
  }) => {
    const response = await request.post('/api/projects/sandbox', {
      data: {
        scenario_id: 'minicafe',
        depth: 'plan-only',
        virtual_po_mode: 'auto-pilot',
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('service_id');
    expect(body.project_name).toContain('[SANDBOX]');
    expect(body.project_name).toContain('MiniCafe');
    expect(body.metadata?.sandbox?.enabled).toBe(true);
    expect(body.metadata?.sandbox?.scenario_id).toBe('minicafe');
    expect(body.metadata?.sandbox?.depth).toBe('plan-only');
    expect(body.metadata?.sandbox?.virtual_po?.mode).toBe('auto-pilot');
    serviceId = body.service_id;
  });

  test('GET /api/projects/sandbox — 샌드박스 목록에 생성된 프로젝트 포함', async ({ request }) => {
    const response = await request.get('/api/projects/sandbox');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
    const found = body.find((p: { service_id: string }) => p.service_id === serviceId);
    expect(found).toBeTruthy();
    expect(found.metadata?.sandbox?.enabled).toBe(true);
  });

  test('POST /api/projects/sandbox — 동시 실행 제한 (3개 초과 시 400)', async ({ request }) => {
    // 2개 추가 생성
    const res2 = await request.post('/api/projects/sandbox', {
      data: { scenario_id: 'quickdrop', depth: 'plan-only', virtual_po_mode: 'auto-pilot' },
    });
    expect(res2.ok()).toBeTruthy();

    const res3 = await request.post('/api/projects/sandbox', {
      data: { scenario_id: 'petcare', depth: 'plan-only', virtual_po_mode: 'auto-pilot' },
    });
    expect(res3.ok()).toBeTruthy();

    // 4번째 → 제한
    const res4 = await request.post('/api/projects/sandbox', {
      data: { scenario_id: 'creator-pulse', depth: 'plan-only', virtual_po_mode: 'auto-pilot' },
    });
    expect(res4.status()).toBe(400);
    const errBody = await res4.json();
    expect(errBody.error).toContain('최대');

    // 추가 2개 정리
    const list = await (await request.get('/api/projects/sandbox')).json();
    for (const p of list) {
      if (p.service_id !== serviceId) {
        await request.delete(`/api/projects/sandbox?service_id=${p.service_id}`);
      }
    }
  });

  test('POST /api/projects/sandbox — 잘못된 시나리오 400', async ({ request }) => {
    const response = await request.post('/api/projects/sandbox', {
      data: { scenario_id: 'nonexistent', depth: 'plan-only', virtual_po_mode: 'auto-pilot' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('찾을 수 없습니다');
  });

  test('POST /api/projects/sandbox/advance — Phase 진행 (advance-phase)', async ({ request }) => {
    const response = await request.post('/api/projects/sandbox/advance', {
      data: { service_id: serviceId, action: 'advance-phase' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.phase).toBe(1);
  });

  test('POST /api/projects/sandbox/advance — 전체 승인 (approve-all-pending)', async ({
    request,
  }) => {
    const response = await request.post('/api/projects/sandbox/advance', {
      data: { service_id: serviceId, action: 'approve-all-pending' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('approved');
  });

  test('POST /api/projects/sandbox/advance — PO 모드 전환', async ({ request }) => {
    const response = await request.post('/api/projects/sandbox/advance', {
      data: { service_id: serviceId, action: 'switch-po-mode', po_mode: 'interactive' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.message).toContain('interactive');
  });

  test('POST /api/projects/sandbox/advance — Phase 리셋', async ({ request }) => {
    const response = await request.post('/api/projects/sandbox/advance', {
      data: { service_id: serviceId, action: 'reset-to-phase', target_phase: 0 },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.current_phase).toBe(0);
  });

  test('GET /api/projects/sandbox/report — 런 리포트 조회', async ({ request }) => {
    const response = await request.get(`/api/projects/sandbox/report?service_id=${serviceId}`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('project');
    expect(body).toHaveProperty('config');
    expect(body).toHaveProperty('sections_by_phase');
    expect(body).toHaveProperty('run_stats');
    expect(body).toHaveProperty('verification');
    expect(body.config.scenario_id).toBe('minicafe');
  });

  test('DELETE /api/projects/sandbox — 단일 Teardown', async ({ request }) => {
    const response = await request.delete(`/api/projects/sandbox?service_id=${serviceId}`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.message).toContain('정리 완료');

    // 삭제 확인
    const list = await (await request.get('/api/projects/sandbox')).json();
    const found = list.find((p: { service_id: string }) => p.service_id === serviceId);
    expect(found).toBeFalsy();
  });

  test('DELETE /api/projects/sandbox?all=true — 전체 Teardown', async ({ request }) => {
    // 2개 생성
    await request.post('/api/projects/sandbox', {
      data: { scenario_id: 'minicafe', depth: 'plan-only', virtual_po_mode: 'auto-pilot' },
    });
    await request.post('/api/projects/sandbox', {
      data: { scenario_id: 'quickdrop', depth: 'plan-only', virtual_po_mode: 'auto-pilot' },
    });

    const response = await request.delete('/api/projects/sandbox?all=true');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.count).toBeGreaterThanOrEqual(2);

    // 전체 삭제 확인
    const list = await (await request.get('/api/projects/sandbox')).json();
    expect(list.length).toBe(0);
  });
});

test.describe.serial('Sandbox Empty Mode — 시나리오 없이 생성, 내보내기, Teardown', () => {
  let emptyServiceId: string;

  test('POST /api/projects/sandbox — empty 모드 생성 (project_name + initial_description)', async ({
    request,
  }) => {
    const response = await request.post('/api/projects/sandbox', {
      data: {
        project_name: 'E2E Empty Test',
        initial_description: '테스트용 빈 샌드박스 프로젝트',
        depth: 'plan-only',
        virtual_po_mode: 'interactive',
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('service_id');
    expect(body.project_name).toContain('[SANDBOX]');
    expect(body.project_name).toContain('E2E Empty Test');
    expect(body.metadata?.sandbox?.enabled).toBe(true);
    expect(body.metadata?.sandbox?.scenario_id).toBeUndefined();
    expect(body.metadata?.sandbox?.initial_description).toBe('테스트용 빈 샌드박스 프로젝트');
    expect(body.metadata?.sandbox?.mode).toBe('live');
    emptyServiceId = body.service_id;
  });

  test('GET /api/projects/sandbox — empty 모드 프로젝트가 목록에 포함', async ({ request }) => {
    const response = await request.get('/api/projects/sandbox');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const found = body.find((p: { service_id: string }) => p.service_id === emptyServiceId);
    expect(found).toBeTruthy();
    expect(found.metadata?.sandbox?.mode).toBe('live');
  });

  test('POST /api/projects/sandbox — scenario_id도 project_name도 없으면 400', async ({
    request,
  }) => {
    const response = await request.post('/api/projects/sandbox', {
      data: { depth: 'plan-only', virtual_po_mode: 'auto-pilot' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('project_name');
  });

  test('GET /api/projects/sandbox/report — empty 모드 리포트 (검증 통과)', async ({ request }) => {
    const response = await request.get(`/api/projects/sandbox/report?service_id=${emptyServiceId}`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('project');
    expect(body).toHaveProperty('config');
    expect(body.config.scenario_id).toBeUndefined();
    // empty 모드에서는 expected_section_counts 검증이 없으므로 항상 passed
    expect(body.verification.passed).toBe(true);
  });

  test('GET /api/projects/sandbox/export — 내보내기 JSON', async ({ request }) => {
    const response = await request.get(`/api/projects/sandbox/export?service_id=${emptyServiceId}`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('exported_at');
    expect(body).toHaveProperty('project');
    expect(body).toHaveProperty('sandbox_config');
    expect(body).toHaveProperty('run_stats');
    expect(body).toHaveProperty('sections_detail');
    expect(body.sandbox_config.scenario_id).toBeNull();
    expect(body.sandbox_config.initial_description).toBe('테스트용 빈 샌드박스 프로젝트');
  });

  test('DELETE /api/projects/sandbox — empty 모드 Teardown', async ({ request }) => {
    const response = await request.delete(`/api/projects/sandbox?service_id=${emptyServiceId}`);
    expect(response.ok()).toBeTruthy();

    const list = await (await request.get('/api/projects/sandbox')).json();
    const found = list.find((p: { service_id: string }) => p.service_id === emptyServiceId);
    expect(found).toBeFalsy();
  });
});

test.describe.serial('GFP→Service 리네이밍 검증', () => {
  test('/api/projects/ → /api/projects/ 리다이렉트 (307)', async ({ request }) => {
    const response = await request.get('/api/gfp', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toContain('/api/projects/');
  });

  test('/api/projects/ 정상 동작', async ({ request }) => {
    const response = await request.get('/api/projects');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('프로젝트 생성 시 service_id 반환 (gfp_id 아님)', async ({ request }) => {
    const response = await request.post('/api/projects', {
      data: {
        project_name: `Rename-Test-${Date.now()}`,
        owner_name: 'E2E-Tester',
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('service_id');
    expect(body).not.toHaveProperty('gfp_id');

    // Cleanup
    const { query } = await import('../../lib/db');
    await query('DELETE FROM semo.services WHERE service_id = $1', [body.service_id]);
  });

  test('Sandbox 프로젝트가 일반 목록에서 필터 가능', async ({ request }) => {
    // 샌드박스 생성
    const sandboxRes = await request.post('/api/projects/sandbox', {
      data: { scenario_id: 'minicafe', depth: 'plan-only', virtual_po_mode: 'auto-pilot' },
    });
    const sandbox = await sandboxRes.json();

    // 일반 목록에서 sandbox 프로젝트도 보이지만 metadata로 구분 가능
    const listRes = await request.get('/api/projects');
    const allProjects = await listRes.json();
    const sandboxProject = allProjects.find(
      (p: { service_id: string }) => p.service_id === sandbox.service_id,
    );
    expect(sandboxProject).toBeTruthy();
    expect(sandboxProject.metadata?.sandbox?.enabled).toBe(true);

    // Cleanup
    await request.delete(`/api/projects/sandbox?service_id=${sandbox.service_id}`);
  });
});
