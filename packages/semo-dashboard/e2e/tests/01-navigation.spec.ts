import { test, expect } from '@playwright/test';

test.describe('기본 네비게이션', () => {
  test('홈(/)에서 자동으로 /dashboard로 리다이렉트', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');
  });

  test('모든 주요 페이지 접근 가능', async ({ page }) => {
    // Dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Bots
    await page.goto('/bots');
    await expect(page).toHaveURL('/bots');
    await expect(page.locator('h1')).toContainText('Bot Team Overview');

    // KB
    await page.goto('/kb');
    await expect(page).toHaveURL('/kb');
    await expect(page.locator('h1')).toContainText('Knowledge Base');
  });

  test('존재하지 않는 페이지는 404 처리', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    expect(response?.status()).toBe(404);
  });

  test('네비게이션 링크 동작 (있으면)', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Header에 nav 링크가 있다면 테스트
    const botsLink = page.locator('a[href="/bots"]').first();
    if (await botsLink.isVisible()) {
      await botsLink.click();
      await expect(page).toHaveURL('/bots');
    }
  });
});
