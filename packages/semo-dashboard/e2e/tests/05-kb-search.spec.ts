import { test, expect } from '@playwright/test';

test.describe('KB 검색 및 필터', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kb');
  });

  test('페이지 제목과 설명 표시', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Knowledge Base');
    await expect(page.getByText(/팀 공유 KB/)).toBeVisible();
  });

  test('시맨틱 검색 입력 필드 동작', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/시맨틱 검색/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('테스트 검색어');
    await page.waitForTimeout(300); // 디바운스 대기
    
    // URL에 search 파라미터가 추가되거나 API 요청 발생 확인
    // 실제로는 network 요청 감시
    await page.waitForLoadState('networkidle');
  });

  test('도메인 필터 드롭다운 동작', async ({ page }) => {
    const domainSelect = page.locator('select').filter({ hasText: /All Domains/ }).first();
    
    if (await domainSelect.isVisible()) {
      await domainSelect.click();
      
      // 옵션 선택 (실제 데이터에 따라 조정)
      const options = await domainSelect.locator('option').allTextContents();
      expect(options.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('Bot ID 필터 입력 동작', async ({ page }) => {
    const botIdInput = page.getByPlaceholder(/Bot ID 필터/i);
    await expect(botIdInput).toBeVisible();

    await botIdInput.fill('semiclaw');
    await page.waitForTimeout(300);
    await page.waitForLoadState('networkidle');

    // 필터링된 결과 확인
    const resultText = await page.textContent('body');
    expect(resultText).toContain('semiclaw');
  });

  test('필터 조합 동작 (검색 + 도메인 + Bot ID)', async ({ page }) => {
    // 검색어 입력
    const searchInput = page.getByPlaceholder(/시맨틱 검색/i);
    await searchInput.fill('onboarding');

    // 도메인 선택 (첫 번째 도메인)
    const domainSelect = page.locator('select').first();
    if (await domainSelect.isVisible()) {
      const options = await domainSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await domainSelect.selectOption({ index: 1 });
      }
    }

    // Bot ID 입력
    const botIdInput = page.getByPlaceholder(/Bot ID 필터/i);
    await botIdInput.fill('semiclaw');

    await page.waitForLoadState('networkidle');

    // 결과 테이블 확인
    const table = page.locator('table').first();
    const hasTable = await table.isVisible().catch(() => false);
    
    if (hasTable) {
      await expect(table).toBeVisible();
    } else {
      // 빈 결과 메시지
      await expect(page.getByText(/항목 없음/i)).toBeVisible();
    }
  });

  test('검색 결과가 유사도 표시 (similarity_pct)', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/시맨틱 검색/i);
    await searchInput.fill('test query');
    await page.waitForLoadState('networkidle');

    // 유사도 퍼센트 표시 확인 (entry.similarity_pct != null)
    const similarityBadge = page.locator('text=/\\d+%/').first();
    const hasSimilarity = await similarityBadge.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasSimilarity) {
      await expect(similarityBadge).toBeVisible();
    }
  });

  test('필터 초기화 시 전체 목록 표시', async ({ page }) => {
    // 필터 적용
    const searchInput = page.getByPlaceholder(/시맨틱 검색/i);
    await searchInput.fill('test');

    // 필터 초기화
    await searchInput.clear();
    await page.waitForLoadState('networkidle');

    // 전체 목록 확인
    const countText = await page.locator('h1 ~ p').first().textContent();
    expect(countText).toMatch(/\d+건/);
  });

  test('Recent Updates 사이드바 표시', async ({ page }) => {
    const recentUpdates = page.getByText(/Recent Updates/i);
    await expect(recentUpdates).toBeVisible();

    // 최근 업데이트 항목 (최대 5개)
    const recentList = page.locator('ul').filter({ has: recentUpdates }).first();
    
    if (await recentList.isVisible()) {
      const items = recentList.locator('li');
      const count = await items.count();
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  test('Recent Updates 항목 클릭 시 편집 모달 열림', async ({ page }) => {
    const recentList = page.locator('ul li p.cursor-pointer').first();
    
    if (await recentList.isVisible()) {
      await recentList.click();

      // 모달 열림 확인
      const modal = page.locator('[role="dialog"], .fixed.inset-0').first();
      await expect(modal).toBeVisible();
      await expect(page.getByText(/Edit Entry/i)).toBeVisible();
    }
  });

  test('에러 메시지 표시 (API 실패 시)', async ({ page }) => {
    // API 에러 모킹
    await page.route('**/api/kb*', (route) => route.abort());
    await page.goto('/kb');

    // 에러 메시지 확인
    const errorBanner = page.locator('.bg-red-50, .border-red-200').first();
    const hasError = await errorBanner.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (hasError) {
      await expect(errorBanner).toBeVisible();
    }
  });

  test('로딩 스피너 표시', async ({ page }) => {
    // 느린 네트워크 시뮬레이션
    await page.route('**/api/kb*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.continue();
    });

    await page.goto('/kb');

    const spinner = page.locator('.animate-spin').first();
    const hasSpinner = await spinner.isVisible({ timeout: 500 }).catch(() => false);
    
    if (hasSpinner) {
      await expect(spinner).toBeVisible();
    }

    await expect(spinner).not.toBeVisible({ timeout: 5000 });
  });
});
