import { Page, expect } from '@playwright/test';

/**
 * E2E 테스트 헬퍼 함수들
 */

/**
 * 페이지 로딩 완료 대기 (네트워크 idle + DOM 안정화)
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * 테이블 데이터 파싱
 */
export async function getTableData(page: Page, selector = 'table') {
  const table = page.locator(selector).first();
  await expect(table).toBeVisible();

  const headers = await table.locator('thead th').allTextContents();
  const rows = await table.locator('tbody tr').all();

  const data = [];
  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    const rowData: Record<string, string> = {};
    headers.forEach((header, i) => {
      rowData[header.trim()] = cells[i]?.trim() || '';
    });
    data.push(rowData);
  }

  return { headers, data };
}

/**
 * 모달 열림/닫힘 확인
 */
export async function expectModalOpen(page: Page) {
  const modal = page.locator('[role="dialog"], .fixed.inset-0').first();
  await expect(modal).toBeVisible();
}

export async function expectModalClosed(page: Page) {
  const modal = page.locator('[role="dialog"]').first();
  await expect(modal).not.toBeVisible({ timeout: 3000 });
}

/**
 * KB 항목 생성 헬퍼
 */
export async function createKBEntry(
  page: Page,
  domain: string,
  key: string,
  content: string
) {
  await page.getByRole('button', { name: /\+ New Entry/i }).click();
  await expectModalOpen(page);

  await page.getByPlaceholder(/e.g. team, decision/i).fill(domain);
  await page.getByPlaceholder(/e.g. onboarding-guide/i).fill(key);
  await page.getByPlaceholder(/KB 내용/i).fill(content);

  const createBtn = page.getByRole('button', { name: /Create Entry/i });
  await createBtn.click();

  await expectModalClosed(page);
  await waitForPageReady(page);
}

/**
 * KB 항목 삭제 헬퍼
 */
export async function deleteKBEntry(page: Page, index = 0) {
  const deleteBtn = page.getByRole('button', { name: /delete/i }).nth(index);
  await deleteBtn.click();

  const confirmBtn = page.getByRole('button', { name: /confirm/i }).first();
  await confirmBtn.click();

  await waitForPageReady(page);
}

/**
 * 로딩 스피너 대기
 */
export async function waitForLoadingToFinish(page: Page, timeout = 5000) {
  const spinner = page.locator('.animate-spin').first();
  const hasSpinner = await spinner.isVisible({ timeout: 500 }).catch(() => false);

  if (hasSpinner) {
    await expect(spinner).not.toBeVisible({ timeout });
  }
}

/**
 * 스크린샷 캡처 (디버깅용)
 */
export async function captureDebugScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `e2e/screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * viewport 크기별 반응형 테스트
 */
export const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};

export async function testResponsive(
  page: Page,
  sizes: Array<keyof typeof viewports>,
  testFn: (size: keyof typeof viewports) => Promise<void>
) {
  for (const size of sizes) {
    await page.setViewportSize(viewports[size]);
    await testFn(size);
  }
}
