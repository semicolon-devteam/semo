import { test, expect } from '@playwright/test';

/**
 * GFP 병렬 트랙 E2E 테스트
 *
 * 테스트 흐름:
 * 1. parallel 프리셋 프로젝트 생성
 * 2. Phase 0 섹션 생성/승인 → 포크 트리거
 * 3. Track A/B 섹션 분리 확인
 * 4. 인프라 요구사항 CRUD
 * 5. Track B 승인 → infra_phase 전진
 * 6. Phase 9 핸드오프 게이트 (Track B 미완 블로킹)
 * 7. 전체 완료
 */
test.describe.serial('GFP Parallel Tracks — 병렬 트랙 전체 플로우', () => {
  let projectId: string;
  const phase0SectionIds: string[] = [];
  let infraSectionId: string;
  let infraRequestId: string;

  // ── 1. 프로젝트 생성 ──

  test('parallel 프리셋 프로젝트 생성 → infra_phase=0', async ({ request }) => {
    const res = await request.post('/api/gfp', {
      data: {
        project_name: `E2E-Parallel-${Date.now()}`,
        owner_name: 'E2E-Tester',
        owner_contact: 'e2e@test.com',
        metadata: { preset: 'parallel' },
      },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.current_phase).toBe(0);
    expect(body.infra_phase).toBe(0);
    expect(body.status).toBe('active');
    projectId = body.service_id;
  });

  test('standard 프리셋 프로젝트는 infra_phase=null', async ({ request }) => {
    const res = await request.post('/api/gfp', {
      data: {
        project_name: `E2E-Standard-${Date.now()}`,
        owner_name: 'E2E-Tester',
        metadata: { preset: 'standard' },
      },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.infra_phase).toBeNull();

    // 정리: 이 프로젝트는 더 이상 사용하지 않음
  });

  // ── 2. Track 필터 기본 동작 ──

  test('track=plan 섹션 조회 — 빈 배열', async ({ request }) => {
    const res = await request.get(`/api/gfp/${projectId}/sections?track=plan`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBe(0);
  });

  test('track=infra 섹션 조회 — 빈 배열', async ({ request }) => {
    const res = await request.get(`/api/gfp/${projectId}/sections?track=infra`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.length).toBe(0);
  });

  // ── 3. Phase 0 섹션 (plan track) ──

  test('Phase 0 plan 섹션 생성 — source: semiclaw', async ({ request }) => {
    const sections = [
      { key: 'identity', title: '프로젝트 정체성', ordinal: 0 },
      { key: 'setup-context', title: '초기 맥락 메모', ordinal: 1 },
    ];

    for (const sec of sections) {
      const res = await request.post(`/api/gfp/${projectId}/sections`, {
        data: {
          phase: 0,
          section_key: sec.key,
          title: sec.title,
          content: `# ${sec.title}\n\nE2E test content`,
          ordinal: sec.ordinal,
          status: 'pending-review',
          source: 'semiclaw',
          track: 'plan',
        },
      });
      expect(res.status()).toBe(201);

      const body = await res.json();
      expect(body.track).toBe('plan');
      expect(body.source).toBe('semiclaw');
      phase0SectionIds.push(body.section_id);
    }
  });

  test('Phase 0 plan 섹션만 조회됨', async ({ request }) => {
    const res = await request.get(`/api/gfp/${projectId}/sections?phase=0&track=plan`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.length).toBe(2);
    for (const sec of body) {
      expect(sec.track).toBe('plan');
      expect(sec.phase).toBe(0);
    }
  });

  // ── 4. Phase 0 포크 트리거 ──

  test('Phase 0 전체 승인 → current_phase=1 (포크 트리거)', async ({ request }) => {
    // 모든 Phase 0 섹션 승인
    for (const secId of phase0SectionIds) {
      const res = await request.patch(`/api/gfp/${projectId}/sections`, {
        data: { section_id: secId, status: 'approved' },
      });
      expect(res.ok()).toBeTruthy();
    }

    // 프로젝트 상태 확인
    const proj = await request.get(`/api/gfp/${projectId}`);
    const body = await proj.json();
    expect(body.current_phase).toBe(1);    // Track A → Phase 1
    expect(body.infra_phase).toBe(0);       // Track B 유지
  });

  // ── 5. 인프라 요구사항 CRUD ──

  test('POST infra-requests — 인프라 요구사항 생성', async ({ request }) => {
    const res = await request.post(`/api/gfp/${projectId}/infra-requests`, {
      data: {
        source_phase: 1,
        category: 'oauth',
        title: 'E2E: 카카오 OAuth',
        description: '카카오 소셜 로그인 연동 필요',
        priority: 'high',
      },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.category).toBe('oauth');
    expect(body.status).toBe('pending');
    expect(body.priority).toBe('high');
    infraRequestId = body.request_id;
  });

  test('POST infra-requests — 잘못된 카테고리 400', async ({ request }) => {
    const res = await request.post(`/api/gfp/${projectId}/infra-requests`, {
      data: {
        source_phase: 1,
        category: 'invalid-category',
        title: 'Bad request',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST infra-requests — 필수 필드 누락 400', async ({ request }) => {
    const res = await request.post(`/api/gfp/${projectId}/infra-requests`, {
      data: { source_phase: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('GET infra-requests — 목록 조회', async ({ request }) => {
    const res = await request.get(`/api/gfp/${projectId}/infra-requests`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].request_id).toBe(infraRequestId);
  });

  test('PATCH infra-requests — 상태 업데이트 (acknowledged)', async ({ request }) => {
    const res = await request.patch(`/api/gfp/${projectId}/infra-requests`, {
      data: { request_id: infraRequestId, status: 'acknowledged' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('acknowledged');
  });

  test('PATCH infra-requests — 상태 업데이트 (completed)', async ({ request }) => {
    const res = await request.patch(`/api/gfp/${projectId}/infra-requests`, {
      data: { request_id: infraRequestId, status: 'completed' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('completed');
  });

  test('PATCH infra-requests — 잘못된 상태 400', async ({ request }) => {
    const res = await request.patch(`/api/gfp/${projectId}/infra-requests`, {
      data: { request_id: infraRequestId, status: 'invalid' },
    });
    expect(res.status()).toBe(400);
  });

  // ── 6. Track B (infra) 섹션 생성/승인 → infra_phase 전진 ──

  test('Infra Phase 0 섹션 생성 — source: infraclaw', async ({ request }) => {
    const res = await request.post(`/api/gfp/${projectId}/sections`, {
      data: {
        phase: 0,
        section_key: 'repo-setup',
        title: '레포 세팅',
        content: '# Repo Setup\n\nGitHub repo + CI/CD configured.',
        status: 'pending-review',
        source: 'infraclaw',
        track: 'infra',
      },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.track).toBe('infra');
    infraSectionId = body.section_id;
  });

  test('동일 section_key가 plan/infra 각각 존재 가능', async ({ request }) => {
    // plan에도 'repo-setup' 키로 생성 가능 (track이 다르므로 UNIQUE 충돌 없음)
    const res = await request.post(`/api/gfp/${projectId}/sections`, {
      data: {
        phase: 0,
        section_key: 'repo-setup',
        title: '레포 참조 (기획)',
        content: 'Plan track reference',
        status: 'draft',
        source: 'manual',
        track: 'plan',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.track).toBe('plan');
  });

  test('track=infra 필터로 infra 섹션만 조회', async ({ request }) => {
    const res = await request.get(`/api/gfp/${projectId}/sections?phase=0&track=infra`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].track).toBe('infra');
    expect(body[0].section_key).toBe('repo-setup');
  });

  test('Infra Phase 0 승인 → infra_phase=1', async ({ request }) => {
    const res = await request.patch(`/api/gfp/${projectId}/sections`, {
      data: { section_id: infraSectionId, status: 'approved' },
    });
    expect(res.ok()).toBeTruthy();

    const proj = await request.get(`/api/gfp/${projectId}`);
    const body = await proj.json();
    expect(body.infra_phase).toBe(1);
  });

  // ── 7. Track B Phase 1, 2 완료 시뮬레이션 ──

  test('Infra Phase 1 → 2 전진', async ({ request }) => {
    // Infra Phase 1 섹션
    const res1 = await request.post(`/api/gfp/${projectId}/sections`, {
      data: {
        phase: 1,
        section_key: 'oauth-setup',
        title: 'OAuth 연동',
        content: 'OAuth integration done',
        status: 'pending-review',
        source: 'infraclaw',
        track: 'infra',
      },
    });
    expect(res1.status()).toBe(201);
    const sec1 = await res1.json();

    // 승인
    await request.patch(`/api/gfp/${projectId}/sections`, {
      data: { section_id: sec1.section_id, status: 'approved' },
    });

    const proj1 = await request.get(`/api/gfp/${projectId}`);
    const body1 = await proj1.json();
    expect(body1.infra_phase).toBe(2);
  });

  test('Infra Phase 2 완료 → infra_phase=3 (완료 상태)', async ({ request }) => {
    // Infra Phase 2 섹션
    const res2 = await request.post(`/api/gfp/${projectId}/sections`, {
      data: {
        phase: 2,
        section_key: 'verification',
        title: '검증',
        content: 'All infra verified',
        status: 'pending-review',
        source: 'infraclaw',
        track: 'infra',
      },
    });
    expect(res2.status()).toBe(201);
    const sec2 = await res2.json();

    await request.patch(`/api/gfp/${projectId}/sections`, {
      data: { section_id: sec2.section_id, status: 'approved' },
    });

    const proj2 = await request.get(`/api/gfp/${projectId}`);
    const body2 = await proj2.json();
    expect(body2.infra_phase).toBe(3); // > 2 means completed
  });

  // ── 8. Track A Phase 1~8 빠르게 통과 ──

  test('Track A Phase 1~8 빠르게 진행', async ({ request }) => {
    for (let phase = 1; phase <= 8; phase++) {
      // 섹션 생성
      const res = await request.post(`/api/gfp/${projectId}/sections`, {
        data: {
          phase,
          section_key: `e2e-section-p${phase}`,
          title: `E2E Phase ${phase}`,
          content: `Phase ${phase} content`,
          status: 'pending-review',
          source: 'planclaw',
          track: 'plan',
        },
      });
      expect(res.status()).toBe(201);
      const sec = await res.json();

      // 승인
      const approveRes = await request.patch(`/api/gfp/${projectId}/sections`, {
        data: { section_id: sec.section_id, status: 'approved' },
      });
      expect(approveRes.ok()).toBeTruthy();
    }

    // current_phase가 9에 도달
    const proj = await request.get(`/api/gfp/${projectId}`);
    const body = await proj.json();
    expect(body.current_phase).toBe(9);
  });

  // ── 9. Phase 9 핸드오프 게이트 ──

  test('Phase 9 승인 — Track B 완료 → 프로젝트 completed', async ({ request }) => {
    // Phase 9 섹션
    const res = await request.post(`/api/gfp/${projectId}/sections`, {
      data: {
        phase: 9,
        section_key: 'final-checklist',
        title: 'Final Checklist',
        content: 'All done',
        status: 'pending-review',
        source: 'planclaw',
        track: 'plan',
      },
    });
    expect(res.status()).toBe(201);
    const sec = await res.json();

    // 승인 → Track B도 완료이므로 프로젝트 completed
    const approveRes = await request.patch(`/api/gfp/${projectId}/sections`, {
      data: { section_id: sec.section_id, status: 'approved' },
    });
    expect(approveRes.ok()).toBeTruthy();

    const proj = await request.get(`/api/gfp/${projectId}`);
    const body = await proj.json();
    expect(body.status).toBe('completed');
  });
});

// ── 핸드오프 게이트 블로킹 테스트 (별도 프로젝트) ──

test.describe.serial('GFP Handoff Gate — Track B 미완 블로킹', () => {
  let projectId: string;

  test('parallel 프로젝트 생성', async ({ request }) => {
    const res = await request.post('/api/gfp', {
      data: {
        project_name: `E2E-Gate-${Date.now()}`,
        owner_name: 'E2E-Tester',
        metadata: { preset: 'parallel' },
      },
    });
    expect(res.status()).toBe(201);
    projectId = (await res.json()).service_id;
  });

  test('Phase 0~8 빠르게 통과 (infra 미완)', async ({ request }) => {
    for (let phase = 0; phase <= 8; phase++) {
      const sec = await request.post(`/api/gfp/${projectId}/sections`, {
        data: {
          phase,
          section_key: `gate-test-p${phase}`,
          title: `Gate P${phase}`,
          content: `Content ${phase}`,
          status: 'pending-review',
          source: 'planclaw',
          track: 'plan',
        },
      });
      const secBody = await sec.json();
      await request.patch(`/api/gfp/${projectId}/sections`, {
        data: { section_id: secBody.section_id, status: 'approved' },
      });
    }
  });

  test('Phase 9 승인 — Track B 미완 → warning 반환, status 유지', async ({ request }) => {
    const sec = await request.post(`/api/gfp/${projectId}/sections`, {
      data: {
        phase: 9,
        section_key: 'final',
        title: 'Final',
        content: 'Done',
        status: 'pending-review',
        source: 'planclaw',
        track: 'plan',
      },
    });
    const secBody = await sec.json();

    const approveRes = await request.patch(`/api/gfp/${projectId}/sections`, {
      data: { section_id: secBody.section_id, status: 'approved' },
    });
    expect(approveRes.ok()).toBeTruthy();

    const body = await approveRes.json();
    expect(body.warning).toContain('Track B');

    // 프로젝트 여전히 active
    const proj = await request.get(`/api/gfp/${projectId}`);
    const projBody = await proj.json();
    expect(projBody.status).toBe('active');
  });
});

// ── 하위 호환 테스트 ──

test.describe('GFP Backward Compatibility — 기존 프로젝트 호환', () => {
  test('track 미지정 섹션은 plan 기본값', async ({ request }) => {
    const projRes = await request.post('/api/gfp', {
      data: {
        project_name: `E2E-Compat-${Date.now()}`,
        owner_name: 'E2E-Tester',
      },
    });
    const proj = await projRes.json();

    // track 미지정으로 섹션 생성
    const secRes = await request.post(`/api/gfp/${proj.service_id}/sections`, {
      data: {
        phase: 0,
        section_key: 'compat-test',
        title: 'Compat',
        content: 'Test',
        status: 'draft',
        source: 'manual',
      },
    });
    expect(secRes.status()).toBe(201);
    const sec = await secRes.json();
    expect(sec.track).toBe('plan');
  });

  test('프리셋 미지정 프로젝트는 infra_phase=null', async ({ request }) => {
    const projRes = await request.post('/api/gfp', {
      data: {
        project_name: `E2E-NoPreset-${Date.now()}`,
        owner_name: 'E2E-Tester',
      },
    });
    const proj = await projRes.json();
    expect(proj.infra_phase).toBeNull();
  });
});
