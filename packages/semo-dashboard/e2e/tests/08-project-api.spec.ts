import { test, expect } from '@playwright/test';

// 순차 실행 필수 — 프로젝트 생성 → 섹션 → 콜백 순서 의존
test.describe.serial('GFP API — 프로젝트 CRUD + 섹션 승인/거절 + 콜백', () => {
  let projectId: string;
  let sectionId: string;
  let taskId: string;

  test('GET /api/gfp — 프로젝트 목록 조회', async ({ request }) => {
    const response = await request.get('/api/gfp');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('POST /api/gfp — 프로젝트 생성', async ({ request }) => {
    const response = await request.post('/api/gfp', {
      data: {
        project_name: `E2E-Test-${Date.now()}`,
        owner_name: 'E2E-Tester',
        owner_contact: 'e2e@test.com',
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('service_id');
    expect(body.status).toBe('active');
    expect(body.current_phase).toBe(0);
    projectId = body.service_id;
  });

  test('POST /api/gfp — 필수 필드 누락 시 400', async ({ request }) => {
    const response = await request.post('/api/gfp', {
      data: { project_name: 'No Owner' },
    });
    expect(response.status()).toBe(400);
  });

  test('GET /api/projects/[id] — 프로젝트 상세 + progress', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.service_id).toBe(projectId);
    expect(body).toHaveProperty('progress');
    expect(Array.isArray(body.progress)).toBeTruthy();
  });

  test('PATCH /api/projects/[id] — 프로젝트 수정', async ({ request }) => {
    const response = await request.patch(`/api/projects/${projectId}`, {
      data: { current_phase: 1 },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.current_phase).toBe(1);
  });

  test('GET /api/projects/nonexistent — 없는 프로젝트 404', async ({ request }) => {
    const response = await request.get('/api/projects/00000000-0000-0000-0000-000000000000');
    expect(response.status()).toBe(404);
  });

  // ── Sections ──

  test('POST /api/projects/[id]/sections — 섹션 생성', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/sections`, {
      data: {
        phase: 0,
        section_key: 'overview',
        title: 'Project Overview',
        content: '# Overview\n\nThis is a test project.',
        status: 'pending-review',
        source: 'manual',
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.section_key).toBe('overview');
    expect(body.status).toBe('pending-review');
    sectionId = body.section_id;
  });

  test('POST /api/projects/[id]/sections — 두 번째 섹션 생성', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/sections`, {
      data: {
        phase: 0,
        section_key: 'core-value',
        title: 'Core Value',
        content: '## Core Value\n\nSolving X problem.',
        status: 'pending-review',
        source: 'planclaw',
        ordinal: 1,
      },
    });
    expect(response.ok()).toBeTruthy();
  });

  test('GET /api/projects/[id]/sections?phase=0 — 섹션 목록', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}/sections?phase=0`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.length).toBe(2);
    expect(body[0].phase).toBe(0);
  });

  test('POST /api/projects/[id]/sections — 필수 필드 누락 시 400', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/sections`, {
      data: { phase: 0 },
    });
    expect(response.status()).toBe(400);
  });

  test('PATCH /api/projects/[id]/sections — 섹션 거절 (reviewer_note)', async ({ request }) => {
    const response = await request.patch(`/api/projects/${projectId}/sections`, {
      data: {
        section_id: sectionId,
        status: 'rejected',
        reviewer_note: 'KPI 정의가 누락되었습니다.',
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('rejected');
    expect(body.reviewer_note).toContain('KPI');
  });

  test('PATCH /api/projects/[id]/sections — 섹션 승인', async ({ request }) => {
    const response = await request.patch(`/api/projects/${projectId}/sections`, {
      data: {
        section_id: sectionId,
        status: 'approved',
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('approved');
  });

  test('PATCH /api/projects/[id]/sections — section_id 누락 시 400', async ({ request }) => {
    const response = await request.patch(`/api/projects/${projectId}/sections`, {
      data: { status: 'approved' },
    });
    expect(response.status()).toBe(400);
  });

  // ── 콘텐츠 업데이트 ──

  test('PATCH /api/projects/[id]/sections — 콘텐츠 업데이트 (action: update-content)', async ({
    request,
  }) => {
    const response = await request.patch(`/api/projects/${projectId}/sections`, {
      data: {
        section_id: sectionId,
        action: 'update-content',
        content: '# Updated Overview\n\nRegenerated by PlanClaw.',
        status: 'pending-review',
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.content).toContain('Regenerated by PlanClaw');
    expect(body.status).toBe('pending-review');
  });

  // ── Callback API ──

  test('POST /api/projects/callback — section-regeneration 콜백', async ({ request }) => {
    const response = await request.post('/api/projects/callback', {
      data: {
        type: 'section-regeneration',
        section_id: sectionId,
        content: '# Regenerated\n\nPlanClaw이 거절 사유를 반영하여 재생성한 내용.',
        bot_id: 'planclaw',
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBeTruthy();
    expect(body.section.status).toBe('pending-review');
    expect(body.section.content).toContain('Regenerated');
  });

  test('POST /api/projects/callback — 필수 필드 누락 시 400', async ({ request }) => {
    const response = await request.post('/api/projects/callback', {
      data: { type: 'section-regeneration', bot_id: 'planclaw' },
    });
    expect(response.status()).toBe(400);
  });

  test('POST /api/projects/callback — 존재하지 않는 섹션 404', async ({ request }) => {
    const response = await request.post('/api/projects/callback', {
      data: {
        type: 'section-regeneration',
        section_id: '00000000-0000-0000-0000-000000000000',
        content: 'test',
        bot_id: 'planclaw',
      },
    });
    expect(response.status()).toBe(404);
  });

  test('POST /api/projects/callback — 알 수 없는 타입 400', async ({ request }) => {
    const response = await request.post('/api/projects/callback', {
      data: { type: 'unknown-type', bot_id: 'test' },
    });
    expect(response.status()).toBe(400);
  });

  // ── Research ──

  test('POST /api/projects/[id]/research — 리서치 작업 생성', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/research`, {
      data: {
        task_type: 'competitor-analysis',
        reference_urls: ['https://example.com'],
        input_prompt: 'Analyze competitor UX patterns for e2e test',
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.task_type).toBe('competitor-analysis');
    taskId = body.task_id;
  });

  test('GET /api/projects/[id]/research — 리서치 목록', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}/research`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/projects/callback — research-result 콜백', async ({ request }) => {
    const response = await request.post('/api/projects/callback', {
      data: {
        type: 'research-result',
        task_id: taskId,
        result: '## Competitor Analysis\n\n- Feature A: 차별점\n- Feature B: UX 개선 제안',
        bot_id: 'growthclaw',
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBeTruthy();
    expect(body.task.status).toBe('completed');
    expect(body.task.result).toContain('Competitor Analysis');
  });

  test('POST /api/projects/callback — research-result 존재하지 않는 task 404', async ({
    request,
  }) => {
    const response = await request.post('/api/projects/callback', {
      data: {
        type: 'research-result',
        task_id: '00000000-0000-0000-0000-000000000000',
        result: 'test',
        bot_id: 'growthclaw',
      },
    });
    expect(response.status()).toBe(404);
  });

  // ── Materials ──

  test('POST /api/projects/[id]/materials — 기획안 업로드', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/materials`, {
      data: {
        content:
          '# 기존 기획안\n\n## 사용자 정의\n교회/교역자/성도\n\n## 문제 정의\n매칭 플랫폼 부재',
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('material');
    expect(body).toHaveProperty('sections_created');
  });

  test('GET /api/projects/[id]/materials — 기획안 목록', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}/materials`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  // ── Progress ──

  test('GET /api/projects/[id] — progress에 Phase 0 반영 확인', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}`);
    const body = await response.json();

    const phase0 = body.progress.find((p: { phase: number }) => p.phase === 0);
    if (phase0) {
      expect(phase0.total).toBeGreaterThanOrEqual(2);
    }
  });

  // ── 필터링 ──

  test('GET /api/gfp?status=active — 상태 필터', async ({ request }) => {
    const response = await request.get('/api/gfp?status=active');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    for (const p of body) {
      expect(p.status).toBe('active');
    }
  });
});

test.describe('GFP UI 페이지 접근', () => {
  test('/gfp — 프로젝트 목록 페이지', async ({ page }) => {
    await page.goto('/gfp');
    await expect(page.locator('h1')).toContainText('GFP Pipeline');
  });

  test('/gfp/new — 프로젝트 생성 페이지', async ({ page }) => {
    await page.goto('/gfp/new');
    await expect(page.locator('h1')).toContainText('New GFP Project');
  });

  test('Nav에 GFP 링크 존재', async ({ page }) => {
    await page.goto('/');
    const gfpLink = page.locator('nav a[href="/gfp"]');
    await expect(gfpLink).toBeVisible();
    await expect(gfpLink).toContainText('GFP');
  });
});
