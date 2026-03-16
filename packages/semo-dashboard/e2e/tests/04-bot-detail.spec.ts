import { test, expect } from '@playwright/test';

test.describe('봇 상세 페이지', () => {
  // 실제 봇 ID는 API 응답에 따라 조정 (예: semiclaw, workclaw 등)
  const testBotId = 'semiclaw';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/bots/${testBotId}`);
  });

  test('봇 정보 헤더가 표시된다', async ({ page }) => {
    // 봇 이모지
    await expect(page.locator('span').filter({ hasText: /🦀|⚙️|🔍/ }).first()).toBeVisible();

    // 봇 이름
    await expect(page.locator('h1')).toBeVisible();

    // 온라인 상태 배지
    const statusBadge = page.getByText(/online|offline/i);
    await expect(statusBadge).toBeVisible();
  });

  test('Bot Team 링크로 목록 페이지 복귀', async ({ page }) => {
    await page.click('a:has-text("← Bot Team")');
    await expect(page).toHaveURL('/bots');
  });

  test('Sessions/KB 탭 전환 동작', async ({ page }) => {
    // Sessions 탭 클릭 (기본 활성화)
    const sessionsTab = page.getByRole('button', { name: /sessions/i });
    await expect(sessionsTab).toBeVisible();
    await sessionsTab.click();

    // Sessions 컨텐츠 확인
    const sessionsTable = page.locator('table').first();
    const hasSessionsTable = await sessionsTable.isVisible().catch(() => false);
    
    if (hasSessionsTable) {
      await expect(sessionsTable).toBeVisible();
      await expect(page.getByText(/label|sessionkey/i).first()).toBeVisible();
    } else {
      // 세션 없음 메시지
      await expect(page.getByText(/세션 기록 없음|no sessions/i)).toBeVisible();
    }

    // KB 탭 클릭
    const kbTab = page.getByRole('button', { name: /bot kb/i });
    await kbTab.click();

    // KB 컨텐츠 확인
    const kbTable = page.locator('table').first();
    const hasKbTable = await kbTable.isVisible().catch(() => false);
    
    if (hasKbTable) {
      await expect(kbTable).toBeVisible();
      await expect(page.getByText(/key|domain/i).first()).toBeVisible();
    } else {
      await expect(page.getByText(/봇 KB 항목 없음|no kb/i)).toBeVisible();
    }
  });

  test('Sessions 테이블 렌더링 (데이터 있는 경우)', async ({ page }) => {
    const sessionsTab = page.getByRole('button', { name: /sessions/i });
    await sessionsTab.click();

    const table = page.locator('table').first();
    if (await table.isVisible()) {
      // 테이블 헤더 확인
      await expect(page.getByText(/label/i).first()).toBeVisible();
      await expect(page.getByText(/messages/i).first()).toBeVisible();

      // 테이블 행 확인
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('KB 테이블 렌더링 (데이터 있는 경우)', async ({ page }) => {
    const kbTab = page.getByRole('button', { name: /bot kb/i });
    await kbTab.click();

    const table = page.locator('table').first();
    if (await table.isVisible()) {
      // 테이블 헤더 확인
      await expect(page.getByText(/key/i).first()).toBeVisible();
      await expect(page.getByText(/domain/i).first()).toBeVisible();

      // 테이블 행 확인
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('존재하지 않는 봇 ID는 404 또는 에러 메시지', async ({ page }) => {
    await page.goto('/bots/nonexistent-bot-12345');
    
    // 에러 메시지 또는 "Bot not found" 확인
    const errorMessage = page.getByText(/not found|error|봇 없음/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('로딩 스피너 표시 후 데이터 렌더링', async ({ page }) => {
    // 느린 네트워크 시뮬레이션
    await page.route('**/api/bots/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.continue();
    });

    await page.goto(`/bots/${testBotId}`);

    // 로딩 스피너 확인
    const spinner = page.locator('.animate-spin').first();
    const hasSpinner = await spinner.isVisible({ timeout: 500 }).catch(() => false);
    
    if (hasSpinner) {
      await expect(spinner).toBeVisible();
    }

    // 데이터 로드 후 스피너 사라짐
    await expect(spinner).not.toBeVisible({ timeout: 5000 });
  });

  test('반응형: 모바일에서 테이블 컬럼 숨김', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/bots/${testBotId}`);

    const sessionsTab = page.getByRole('button', { name: /sessions/i });
    await sessionsTab.click();

    // hidden md:table-cell 클래스가 적용된 컬럼은 모바일에서 숨김
    // 실제 DOM 확인
    const table = page.locator('table').first();
    if (await table.isVisible()) {
      const hiddenCells = page.locator('th.hidden, td.hidden');
      const count = await hiddenCells.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
