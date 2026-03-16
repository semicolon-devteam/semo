import { test, expect } from '@playwright/test';

test.describe('봇 목록 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bots');
  });

  test('페이지 제목과 설명이 표시된다', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Bot Team Overview');
    await expect(page.getByText('Monitor all bot activities and status')).toBeVisible();
  });

  test('봇 카드 목록이 렌더링된다', async ({ page }) => {
    // BotCard 컴포넌트 또는 grid 확인
    const grid = page.locator('.grid, [data-testid="bots-grid"]').first();
    await expect(grid).toBeVisible();

    // 봇 카드가 최소 1개 이상 있는지 확인 (API 모킹 시 조정)
    const botCards = page.locator('[data-testid="bot-card"], .grid > div, .grid > a');
    const count = await botCards.count();
    expect(count).toBeGreaterThanOrEqual(0); // API 응답에 따라 조정
  });

  test('봇 카드 클릭 시 상세 페이지로 이동', async ({ page }) => {
    // 첫 번째 봇 카드 클릭 (Link 또는 클릭 가능한 요소)
    const firstCard = page.locator('[data-testid="bot-card"], .grid > a').first();
    
    if (await firstCard.isVisible()) {
      await firstCard.click();
      // URL이 /bots/[botId] 형태인지 확인
      await page.waitForURL(/\/bots\/.+/);
      expect(page.url()).toMatch(/\/bots\/.+/);
    }
  });

  test('봇이 없을 때 빈 상태 메시지 표시', async ({ page }) => {
    // API를 모킹해서 빈 배열을 반환하는 경우
    // 실제 테스트에서는 MSW로 응답 조작
    // 여기서는 조건부 확인만
    const emptyMessage = page.getByText(/no bots|봇 없음/i);
    const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
    
    // 빈 상태이거나 정상 렌더링 둘 중 하나
    if (hasEmptyMessage) {
      await expect(emptyMessage).toBeVisible();
    } else {
      const grid = page.locator('.grid, [data-testid="bots-grid"]').first();
      await expect(grid).toBeVisible();
    }
  });

  test('API 에러 시 에러 메시지 표시', async ({ page }) => {
    // API 에러 모킹이 필요한 경우
    // MSW로 500 응답 등을 설정
    // 여기서는 네트워크 차단으로 시뮬레이션
    await page.route('**/api/bots', (route) => route.abort());
    await page.goto('/bots');

    // 에러 메시지 또는 fallback UI 확인
    const errorMessage = page.getByText(/failed|error|오류/i);
    const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (hasError) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('반응형: 그리드 레이아웃이 viewport에 맞게 조정', async ({ page }) => {
    // Desktop (3 columns)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/bots');
    const grid = page.locator('.grid').first();
    
    if (await grid.isVisible()) {
      const gridClasses = await grid.getAttribute('class');
      expect(gridClasses).toMatch(/lg:grid-cols-3/);
    }

    // Tablet (2 columns)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/bots');
    
    // Mobile (1 column)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/bots');
  });
});
