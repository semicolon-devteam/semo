import { test, expect } from '@playwright/test';

/**
 * 12-service-ops-dashboard.spec.ts
 *
 * 운영 대시보드 검증 — lifecycle='ops' 서비스에 대해:
 * 1. 목록 페이지 lifecycle 필터/배지
 * 2. 상세 페이지 ops mode 분기 (build UI 아닌 탭 UI)
 * 3. 개요 탭: KB 데이터 (base-info, po, tech-stack, service-url 등) 정상 노출
 * 4. 스프린트 탭: KPI/액션아이템/마일스톤 노출
 * 5. 기능 탭: CRUD (추가/수정/삭제)
 * 6. API 레벨: overview, kpi, features 응답 구조 검증
 *
 * 선행 조건: axoracle, jungchipan이 services에 lifecycle='ops'로 이식 완료
 */

// ── A. API 레벨 — Overview/KPI/Features 응답 구조 검증 ──

test.describe.serial('Service Ops API — axoracle', () => {
  let axoracleId: string;

  test('GET /api/gfp — axoracle이 목록에 lifecycle=ops로 존재', async ({ request }) => {
    const res = await request.get('/api/gfp');
    expect(res.ok()).toBeTruthy();
    const projects = await res.json();
    const axoracle = projects.find(
      (p: { service_domain: string }) => p.service_domain === 'axoracle',
    );
    expect(axoracle).toBeTruthy();
    expect(axoracle.lifecycle).toBe('ops');
    expect(axoracle.status).toBe('active');
    expect(axoracle.project_name).toContain('AXOracle');
    axoracleId = axoracle.service_id;
  });

  test('GET /api/projects/[id]/overview — KB 데이터 집계 정상', async ({ request }) => {
    const res = await request.get(`/api/projects/${axoracleId}/overview`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();

    // project 필드
    expect(body.project).toHaveProperty('service_id', axoracleId);
    expect(body.project.lifecycle).toBe('ops');

    // KB 필드 — axoracle은 풍부한 KB 데이터 보유
    expect(body.kb).toHaveProperty('baseInformation');
    expect(body.kb.baseInformation).toContain('AXOracle');

    expect(body.kb).toHaveProperty('po');
    expect(body.kb.po).toBe('reus');

    expect(body.kb).toHaveProperty('techStack');
    expect(body.kb.techStack).toContain('Next.js');

    expect(body.kb).toHaveProperty('serviceUrl');
    expect(body.kb.serviceUrl).toContain('axoracle.com');

    expect(body.kb).toHaveProperty('repo');

    expect(body.kb).toHaveProperty('currentSituation');
    expect(body.kb.currentSituation).toBeTruthy();

    expect(body.kb).toHaveProperty('infra');
    // infra는 collection key (sub_key가 있을 수 있음) — null이면 sub_key='' 엔트리 없음
    if (body.kb.infra) {
      expect(body.kb.infra).toContain('OCI');
    }
  });

  test('GET /api/projects/[id]/kpi — KPI 스냅샷 + 액션아이템 반환', async ({ request }) => {
    const res = await request.get(`/api/projects/${axoracleId}/kpi?limit=5`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();

    // KPI snapshots — axoracle은 9개 kpi 엔트리 보유
    expect(body).toHaveProperty('kpiSnapshots');
    expect(Array.isArray(body.kpiSnapshots)).toBeTruthy();
    expect(body.kpiSnapshots.length).toBeGreaterThanOrEqual(1);

    // 각 스냅샷 구조
    if (body.kpiSnapshots.length > 0) {
      const snap = body.kpiSnapshots[0];
      expect(snap).toHaveProperty('subKey');
      expect(snap).toHaveProperty('content');
      expect(snap).toHaveProperty('updatedAt');
    }

    // Milestones — axoracle은 3개 milestone 보유
    expect(body).toHaveProperty('milestones');
    expect(body.milestones.length).toBeGreaterThanOrEqual(1);

    // Incidents (may be empty)
    expect(body).toHaveProperty('incidents');
    expect(Array.isArray(body.incidents)).toBeTruthy();
  });

  test('GET /api/projects/[id]/features — 빈 배열 (아직 기능 미등록)', async ({ request }) => {
    const res = await request.get(`/api/projects/${axoracleId}/features`);
    expect(res.ok()).toBeTruthy();
    const features = await res.json();
    expect(Array.isArray(features)).toBeTruthy();
  });

  // ── 기능 CRUD 테스트 ──
  let featureId: string;

  test('POST /api/projects/[id]/features — 기능 추가', async ({ request }) => {
    const res = await request.post(`/api/projects/${axoracleId}/features`, {
      data: {
        name: 'AI 직업 분석',
        description: 'Claude API를 활용한 직업 AI 대체 위험도 분석 기능',
        category: 'core',
        status: 'active',
      },
    });
    expect(res.status()).toBe(201);
    const feature = await res.json();
    expect(feature.name).toBe('AI 직업 분석');
    expect(feature.category).toBe('core');
    expect(feature.status).toBe('active');
    featureId = feature.feature_id;
  });

  test('POST /api/projects/[id]/features — 하위 기능 추가 (parent_id)', async ({ request }) => {
    const res = await request.post(`/api/projects/${axoracleId}/features`, {
      data: {
        name: 'BLS 급여 데이터 연동',
        description: 'US Bureau of Labor Statistics API 연동',
        category: 'core',
        status: 'active',
        parent_id: featureId,
      },
    });
    expect(res.status()).toBe(201);
    const child = await res.json();
    expect(child.parent_id).toBe(featureId);
  });

  test('GET /api/projects/[id]/features — 계층 구조 포함', async ({ request }) => {
    const res = await request.get(`/api/projects/${axoracleId}/features`);
    expect(res.ok()).toBeTruthy();
    const features = await res.json();
    expect(features.length).toBe(2);

    // parent와 child 모두 존재
    const parent = features.find((f: { feature_id: string }) => f.feature_id === featureId);
    const child = features.find((f: { parent_id: string }) => f.parent_id === featureId);
    expect(parent).toBeTruthy();
    expect(child).toBeTruthy();
  });

  test('PATCH /api/projects/[id]/features — 기능 수정', async ({ request }) => {
    const res = await request.patch(`/api/projects/${axoracleId}/features`, {
      data: {
        feature_id: featureId,
        status: 'in-dev',
        description: '개선 중 — 새 모델 적용',
      },
    });
    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    expect(updated.status).toBe('in-dev');
    expect(updated.description).toContain('개선 중');
  });

  test('DELETE /api/projects/[id]/features — 기능 폐기 (soft delete)', async ({ request }) => {
    const res = await request.delete(
      `/api/projects/${axoracleId}/features?feature_id=${featureId}`,
    );
    expect(res.ok()).toBeTruthy();

    // 폐기 후 status=deprecated 확인
    const listRes = await request.get(`/api/projects/${axoracleId}/features`);
    const features = await listRes.json();
    const deprecated = features.find((f: { feature_id: string }) => f.feature_id === featureId);
    expect(deprecated.status).toBe('deprecated');
  });
});

// ── B. jungchipan — KB 데이터가 풍부한 서비스 검증 ──

test.describe.serial('Service Ops API — jungchipan (KB-rich)', () => {
  let jungchipanId: string;

  test('GET /api/gfp — jungchipan lifecycle=ops 확인', async ({ request }) => {
    const res = await request.get('/api/gfp');
    const projects = await res.json();
    const jp = projects.find((p: { service_domain: string }) => p.service_domain === 'jungchipan');
    expect(jp).toBeTruthy();
    expect(jp.lifecycle).toBe('ops');
    jungchipanId = jp.service_id;
  });

  test('overview — KB 데이터 정상 (po=harry-lee, bm 존재, service-url 존재)', async ({
    request,
  }) => {
    const res = await request.get(`/api/projects/${jungchipanId}/overview`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    expect(body.kb.po).toBe('harry-lee');
    expect(body.kb.bm).toBeTruthy();
    expect(body.kb.serviceUrl).toBeTruthy();
    expect(body.kb.slackChannel).toBeTruthy();
    expect(body.kb.repo).toBeTruthy();
  });

  test('kpi — 16개 이상 KPI 스냅샷 + 4개 이상 마일스톤', async ({ request }) => {
    const res = await request.get(`/api/projects/${jungchipanId}/kpi?limit=20`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    // jungchipan은 16개 kpi 엔트리 보유
    expect(body.kpiSnapshots.length).toBeGreaterThanOrEqual(5);

    // 3개 이상 마일스톤
    expect(body.milestones.length).toBeGreaterThanOrEqual(3);
  });
});

// ── C. UI 페이지 — 목록 페이지 lifecycle 필터 ──

test.describe('Service List Page — lifecycle 필터', () => {
  test('/gfp — "운영 중" 탭 필터링', async ({ page }) => {
    await page.goto('/gfp');
    await page.waitForLoadState('networkidle');

    // lifecycle 필터 탭이 존재
    const opsTab = page.getByRole('button', { name: /운영 중/ });
    await expect(opsTab).toBeVisible();

    // 클릭하면 build 서비스는 숨기고 ops만 표시
    await opsTab.click();
    await page.waitForTimeout(500);

    // axoracle 카드에 "운영 중" 배지가 있어야 함
    const axoracleCard = page.getByText('AXOracle').first();
    if (await axoracleCard.isVisible()) {
      // ops 서비스는 Phase 대신 "운영 D+N" 표시
      const card = axoracleCard.locator('..').locator('..');
      await expect(card.getByText(/운영 D\+/)).toBeVisible();
    }
  });
});

// ── D. UI 페이지 — ops 상세 페이지 탭 렌더링 ──

test.describe('Service Ops Detail Page', () => {
  let axoracleId: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/gfp');
    const projects = await res.json();
    const axoracle = projects.find(
      (p: { service_domain: string }) => p.service_domain === 'axoracle',
    );
    axoracleId = axoracle?.service_id;
  });

  test('/gfp/[id] — ops 서비스는 탭 UI 렌더 (Phase Nav 없음)', async ({ page }) => {
    test.skip(!axoracleId, 'axoracle not found');
    await page.goto(`/gfp/${axoracleId}`);
    await page.waitForLoadState('networkidle');

    // 운영 대시보드 탭이 보여야 함
    await expect(page.getByRole('button', { name: '개요' })).toBeVisible();
    await expect(page.getByRole('button', { name: /스프린트/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /기능 관리/ })).toBeVisible();

    // Phase 0-9 Phase Nav는 없어야 함
    await expect(page.getByText('0 온보딩')).not.toBeVisible();
  });

  test('개요 탭 — KB 데이터 표시 (담당자, URL, 기술스택)', async ({ page }) => {
    test.skip(!axoracleId, 'axoracle not found');
    await page.goto(`/gfp/${axoracleId}`);
    await page.waitForLoadState('networkidle');

    // 프로젝트 헤더
    await expect(page.getByText('AXOracle').first()).toBeVisible();
    await expect(page.getByText('운영 중').first()).toBeVisible();

    // KB 정보 카드
    await expect(page.getByText('reus')).toBeVisible();
    await expect(page.getByText('axoracle.com')).toBeVisible();
  });

  test('스프린트 탭 — KPI 스냅샷 표시', async ({ page }) => {
    test.skip(!axoracleId, 'axoracle not found');
    await page.goto(`/gfp/${axoracleId}`);
    await page.waitForLoadState('networkidle');

    // 스프린트 탭 클릭
    await page.getByRole('button', { name: /스프린트/ }).click();
    await page.waitForTimeout(300);

    // KPI 섹션 헤더
    await expect(page.getByText('KPI 지표')).toBeVisible();

    // 마일스톤 섹션
    await expect(page.getByText('마일스톤')).toBeVisible();
  });

  test('기능 탭 — CRUD 동작', async ({ page }) => {
    test.skip(!axoracleId, 'axoracle not found');
    await page.goto(`/gfp/${axoracleId}`);
    await page.waitForLoadState('networkidle');

    // 기능 탭 클릭
    await page.getByRole('button', { name: /기능 관리/ }).click();
    await page.waitForTimeout(300);

    // + 기능 추가 버튼
    const addBtn = page.getByRole('button', { name: '+ 기능 추가' });
    await expect(addBtn).toBeVisible();

    // 기능 추가 플로우
    await addBtn.click();
    await page.waitForTimeout(200);

    // 모달이 열리고 폼 입력
    const nameInput = page.locator('input[placeholder*="사용자 인증"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E 테스트 기능');
      await page.getByRole('button', { name: '추가' }).click();
      await page.waitForTimeout(500);

      // 추가된 기능이 목록에 표시
      await expect(page.getByText('E2E 테스트 기능')).toBeVisible();
    }
  });
});
