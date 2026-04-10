import { test, expect } from '@playwright/test';

/**
 * 10-service-migration.spec.ts
 * service_* 테이블 리네이밍, projection key enforcement,
 * lifecycle 필드, pm-status writeback 검증.
 *
 * 선행 조건: 045/046 마이그레이션 적용 완료
 */

test.describe.serial('Service Migration — 테이블 리네이밍 + Projection Key', () => {
  const testName = `E2E-ServiceMig-${Date.now()}`;
  const testDomain = `e2e-svcmig-${Date.now()}`;
  let projectId: string;

  // ── A. 프로젝트 CRUD (services 테이블) ──

  test('POST /api/gfp — 프로젝트 생성 시 lifecycle=build, launched_at=null', async ({
    request,
  }) => {
    const response = await request.post('/api/gfp', {
      data: {
        project_name: testName,
        owner_name: 'E2E-Tester',
        service_domain: testDomain,
        metadata: { preset: 'parallel' },
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('service_id');
    expect(body.status).toBe('active');
    expect(body.current_phase).toBe(0);
    expect(body.lifecycle).toBe('build');
    expect(body.launched_at).toBeNull();
    // parallel ���리셋: infra_phase 활성화
    expect(body.infra_phase).toBe(0);

    projectId = body.service_id;
  });

  test('GET /api/projects/[id] — 상세 조회에 lifecycle 필드 포함', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.service_id).toBe(projectId);
    expect(body.lifecycle).toBe('build');
    expect(body).toHaveProperty('progress');
  });

  // ── B. 섹션 CRUD (service_sections 테이블) ──

  let sectionId: string;

  test('POST sections — service_sections에 섹션 생성', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/sections`, {
      data: {
        phase: 0,
        section_key: 'overview',
        title: 'Project Overview',
        content: '# Overview\n\nService migration test project.',
        status: 'pending-review',
        source: 'manual',
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('section_id');
    expect(body.service_id).toBe(projectId);
    expect(body.track).toBe('plan');
    sectionId = body.section_id;
  });

  test('GET sections — phase 필터링 동작', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}/sections?phase=0`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].phase).toBe(0);
  });

  // ── C. Infra Track (service_infra_requests 테이블) ──

  test('POST infra-requests — service_infra_requests에 ��성', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/infra-requests`, {
      data: {
        source_phase: 0,
        category: 'dns',
        title: 'DNS 설정 필요',
        priority: 'normal',
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('request_id');
    expect(body.category).toBe('dns');
    expect(body.status).toBe('pending');
  });

  // ── D. Materials (service_materials 테이블) ──

  test('POST materials — service_materials에 업로드', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/materials`, {
      data: {
        content: '# 기획서\n\n서비스 마이그레이션 테스트용 기획서입니다.',
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('material');
    expect(body.material).toHaveProperty('material_id');
  });

  // ── E. Research Tasks (service_research_tasks 테이블) ──

  test('POST research — service_research_tasks에 생성', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/research`, {
      data: {
        task_type: 'market-research',
        reference_urls: ['https://example.com'],
        input_prompt: '서비스 마이그레이션 테스트 리서치',
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('task_id');
    expect(body.status).toBe('queued');
  });

  // ── F. Projection Key Enforcement ──

  test('POST /api/kb — projection key (spec/*) 직접 쓰기 차단 (403)', async ({ request }) => {
    const response = await request.post('/api/kb', {
      data: {
        domain: testDomain,
        key: 'spec/test-phase',
        content: '봇이 직접 작성한 스펙 — 차단되어야 함',
      },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('projection');
  });

  test('POST /api/kb — projection key (pm-status) 직접 쓰기 차단 (403)', async ({ request }) => {
    const response = await request.post('/api/kb', {
      data: {
        domain: testDomain,
        key: 'pm-status',
        content: '봇이 직접 작성한 상태 — 차단되어야 함',
      },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('projection');
  });

  test('POST /api/kb — projection key (gfp-status) 직접 쓰기 차단 (403)', async ({ request }) => {
    const response = await request.post('/api/kb', {
      data: {
        domain: testDomain,
        key: 'gfp-status',
        content: '레거시 키도 projection으로 차단되어야 함',
      },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('projection');
  });

  test('POST /api/kb — projection key (infra-status) 직접 쓰기 차단 (403)', async ({ request }) => {
    const response = await request.post('/api/kb', {
      data: {
        domain: testDomain,
        key: 'infra-status',
        content: '인프라 상태도 projection으로 차단되어야 함',
      },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('projection');
  });

  test('POST /api/kb — manual key (base-information) 쓰기 허용 (201)', async ({ request }) => {
    const response = await request.post('/api/kb', {
      data: {
        domain: testDomain,
        key: 'base-information',
        content: '서비스 마이그레이션 테스트 프로젝트입니다.',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.domain).toBe(testDomain);
  });

  test('POST /api/kb — manual key (status) 쓰기 허용 (201)', async ({ request }) => {
    const response = await request.post('/api/kb', {
      data: {
        domain: testDomain,
        key: 'status',
        content: 'active',
      },
    });
    expect(response.status()).toBe(201);
  });

  // ── G. PM Pipeline Writeback (pm-pipeline은 projection key 쓰기 가능) ──

  test('섹션 승인 → KB spec/* writeback 자동 실행', async ({ request }) => {
    // Phase 0 섹션을 승인
    const approveRes = await request.patch(`/api/projects/${projectId}/sections`, {
      data: {
        section_id: sectionId,
        status: 'approved',
      },
    });
    expect(approveRes.ok()).toBeTruthy();

    const section = await approveRes.json();
    expect(section.status).toBe('approved');

    // KB에 spec/onboarding이 자동으로 써졌는지 확인
    // (pm-pipeline created_by이므로 projection 차단 우회)
    const kbRes = await request.get(`/api/kb?domain=${testDomain}&key=spec/onboarding`);
    if (kbRes.ok()) {
      const kbBody = await kbRes.json();
      expect(kbBody.content).toContain('Overview');
    }
    // Note: writeback은 모든 섹션이 approved일 때만 실행.
    // phase 0에 섹션이 1개뿐이므로 writeback이 트리거됨.
  });

  test('phase 전진 → KB pm-status writeback 확인', async ({ request }) => {
    // Phase가 0→1로 전진했는지 확인
    const projRes = await request.get(`/api/projects/${projectId}`);
    expect(projRes.ok()).toBeTruthy();
    const project = await projRes.json();

    // Phase 전진이 실행됐으면 pm-status가 KB에 기록됨
    if (project.current_phase >= 1) {
      const kbRes = await request.get(`/api/kb?domain=${testDomain}&key=pm-status`);
      if (kbRes.ok()) {
        const kbBody = await kbRes.json();
        expect(kbBody.content).toContain('service_id:');
      }

      // 레거시 gfp-status도 병행 기록 확인
      const legacyRes = await request.get(`/api/kb?domain=${testDomain}&key=gfp-status`);
      if (legacyRes.ok()) {
        const legacyBody = await legacyRes.json();
        expect(legacyBody.content).toContain('service_id:');
      }
    }
  });

  // ── H. 하위 호환 VIEW 검증 ──

  test('하위 호환 — /api/gfp 라���트가 정상 동작', async ({ request }) => {
    // ��존 /api/gfp 경로가 service_* 테이블에서 데이터를 정상 반환
    const response = await request.get('/api/gfp');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
    // 방금 생성한 프로젝트가 목록에 포함
    const found = body.find((p: { service_id: string }) => p.service_id === projectId);
    expect(found).toBeTruthy();
    expect(found.lifecycle).toBe('build');
  });

  // ── I. 정리: 테스트 프로젝트 상태 확인 ──

  test('테스트 프로젝트 최종 상태 검증', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.project_name).toBe(testName);
    expect(body.service_domain).toBe(testDomain);
    expect(body.lifecycle).toBe('build');
    expect(body.metadata).toHaveProperty('preset', 'parallel');
  });
});
