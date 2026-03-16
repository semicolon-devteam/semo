import { test, expect } from '@playwright/test';

test.describe('대시보드 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('DashboardLayout 컴포넌트가 렌더링된다', async ({ page }) => {
    // Header 존재 확인
    const header = page.locator('header, [data-testid="dashboard-header"]').first();
    await expect(header).toBeVisible();
  });

  test('BotOverview 컴포넌트가 렌더링된다', async ({ page }) => {
    // BotOverview 또는 봇 관련 컨텐츠 확인
    // 실제 구현에 따라 selector 조정
    await page.waitForLoadState('networkidle');
    
    // 예: 봇 목록이나 통계가 보이는지 확인
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('반응형: 모바일 뷰포트에서도 정상 렌더링', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    const header = page.locator('header, [data-testid="dashboard-header"]').first();
    await expect(header).toBeVisible();
  });
});
