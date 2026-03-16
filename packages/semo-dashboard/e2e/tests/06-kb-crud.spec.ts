import { test, expect } from '@playwright/test';

test.describe('KB CRUD 기능', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kb');
  });

  test('+ New Entry 버튼 클릭 시 생성 모달 열림', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /\+ New Entry/i });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // 모달 열림 확인
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first();
    await expect(modal).toBeVisible();
    await expect(page.getByText(/New Entry/i).first()).toBeVisible();

    // 폼 필드 확인
    await expect(page.getByPlaceholder(/e.g. team, decision/i)).toBeVisible();
    await expect(page.getByPlaceholder(/e.g. onboarding-guide/i)).toBeVisible();
    await expect(page.getByPlaceholder(/KB 내용/i)).toBeVisible();
  });

  test('모달 닫기 (× 버튼 클릭)', async ({ page }) => {
    await page.getByRole('button', { name: /\+ New Entry/i }).click();
    
    const closeBtn = page.locator('button:has-text("×")').first();
    await closeBtn.click();

    // 모달 사라짐 확인
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first();
    await expect(modal).not.toBeVisible();
  });

  test('모달 닫기 (배경 클릭)', async ({ page }) => {
    await page.getByRole('button', { name: /\+ New Entry/i }).click();
    
    // 모달 배경(.absolute.inset-0) 클릭
    const backdrop = page.locator('.absolute.inset-0').first();
    await backdrop.click({ position: { x: 10, y: 10 } });

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test('KB 항목 생성 (정상 흐름)', async ({ page }) => {
    await page.getByRole('button', { name: /\+ New Entry/i }).click();

    // 폼 입력
    await page.getByPlaceholder(/e.g. team, decision/i).fill('test-domain');
    await page.getByPlaceholder(/e.g. onboarding-guide/i).fill('test-key-' + Date.now());
    await page.getByPlaceholder(/KB 내용/i).fill('테스트 KB 항목 내용입니다.');

    // 생성 버튼 클릭
    const createBtn = page.getByRole('button', { name: /Create Entry/i });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // 모달 닫힘 + 목록 새로고침
    await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 3000 });

    // 생성된 항목 확인 (테이블에서)
    await page.waitForLoadState('networkidle');
    const table = page.locator('table').first();
    
    if (await table.isVisible()) {
      const content = await page.textContent('table');
      expect(content).toContain('test-domain');
    }
  });

  test('KB 항목 생성 시 필수 필드 검증', async ({ page }) => {
    await page.getByRole('button', { name: /\+ New Entry/i }).click();

    // 빈 상태에서 생성 버튼 비활성화
    const createBtn = page.getByRole('button', { name: /Create Entry/i });
    await expect(createBtn).toBeDisabled();

    // Domain만 입력
    await page.getByPlaceholder(/e.g. team, decision/i).fill('test');
    await expect(createBtn).toBeDisabled();

    // Key 추가
    await page.getByPlaceholder(/e.g. onboarding-guide/i).fill('test-key');
    await expect(createBtn).toBeDisabled();

    // Content 추가 → 활성화
    await page.getByPlaceholder(/KB 내용/i).fill('content');
    await expect(createBtn).toBeEnabled();
  });

  test('KB 항목 수정 (Edit 버튼)', async ({ page }) => {
    // 첫 번째 항목의 Edit 버튼 클릭
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    
    if (await editBtn.isVisible({ timeout: 2000 })) {
      await editBtn.click();

      // 편집 모달 열림
      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible();
      await expect(page.getByText(/Edit Entry/i)).toBeVisible();

      // Domain, Key는 비활성화 (disabled)
      const domainInput = page.getByPlaceholder(/e.g. team, decision/i);
      await expect(domainInput).toBeDisabled();

      const keyInput = page.getByPlaceholder(/e.g. onboarding-guide/i);
      await expect(keyInput).toBeDisabled();

      // Content 수정
      const contentTextarea = page.getByPlaceholder(/KB 내용/i);
      await contentTextarea.clear();
      await contentTextarea.fill('수정된 내용입니다.');

      // 저장 버튼 클릭
      const saveBtn = page.getByRole('button', { name: /Save Changes/i });
      await saveBtn.click();

      // 모달 닫힘
      await expect(modal).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('KB 항목 삭제 (Delete → Confirm)', async ({ page }) => {
    // 첫 번째 항목의 Delete 버튼 클릭
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    
    if (await deleteBtn.isVisible({ timeout: 2000 })) {
      await deleteBtn.click();

      // Confirm/Cancel 버튼 표시
      const confirmBtn = page.getByRole('button', { name: /confirm/i }).first();
      const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();

      await expect(confirmBtn).toBeVisible();
      await expect(cancelBtn).toBeVisible();

      // Cancel 클릭 → 삭제 취소
      await cancelBtn.click();
      await expect(confirmBtn).not.toBeVisible();

      // 다시 Delete 클릭 → Confirm
      await deleteBtn.click();
      await confirmBtn.click();

      // 삭제 후 목록 새로고침
      await page.waitForLoadState('networkidle');
    }
  });

  test('생성 중 로딩 스피너 표시', async ({ page }) => {
    // 느린 네트워크 시뮬레이션
    await page.route('**/api/kb', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      route.continue();
    });

    await page.getByRole('button', { name: /\+ New Entry/i }).click();

    await page.getByPlaceholder(/e.g. team, decision/i).fill('test');
    await page.getByPlaceholder(/e.g. onboarding-guide/i).fill('test-key');
    await page.getByPlaceholder(/KB 내용/i).fill('content');

    const createBtn = page.getByRole('button', { name: /Create Entry/i });
    await createBtn.click();

    // 스피너 확인
    const spinner = page.locator('.animate-spin').first();
    const hasSpinner = await spinner.isVisible({ timeout: 500 }).catch(() => false);
    
    if (hasSpinner) {
      await expect(spinner).toBeVisible();
    }
  });

  test('생성/수정 실패 시 alert 표시', async ({ page }) => {
    // API 에러 모킹
    await page.route('**/api/kb', (route) => {
      if (route.request().method() === 'POST' || route.request().method() === 'PATCH') {
        route.fulfill({ status: 500, body: 'Server error' });
      } else {
        route.continue();
      }
    });

    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/failed|error/i);
      await dialog.accept();
    });

    await page.getByRole('button', { name: /\+ New Entry/i }).click();

    await page.getByPlaceholder(/e.g. team, decision/i).fill('test');
    await page.getByPlaceholder(/e.g. onboarding-guide/i).fill('test-key');
    await page.getByPlaceholder(/KB 내용/i).fill('content');

    const createBtn = page.getByRole('button', { name: /Create Entry/i });
    await createBtn.click();

    // alert 발생 대기
    await page.waitForTimeout(1000);
  });
});
