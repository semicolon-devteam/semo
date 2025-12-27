---
name: tester
description: |
  테스트 코드 작성 및 실행. Use when (1) "테스트 작성해줘",
  (2) "테스트 실행해줘", (3) 테스트 커버리지 확인.

  ⚠️ QA 테스트 요청은 별도 스킬 사용:
  - 상태 변경 + QA 할당 → ops/qa의 change-to-testing
  - Slack 알림 전송 → biz/management의 request-test
tools: [Read, Write, Edit, Bash, Glob]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: tester` 시스템 메시지를 첫 줄에 출력하세요.

# tester Skill

> 테스트 코드 작성 및 실행 자동화

## 역할 범위

| 이 스킬에서 처리 | 다른 스킬에서 처리 |
|-----------------|-------------------|
| ✅ 테스트 코드 작성 | ❌ QA 테스터 할당 → `change-to-testing` |
| ✅ 테스트 실행 | ❌ 프로젝트 보드 상태 변경 → `change-to-testing` |
| ✅ 커버리지 확인 | ❌ Slack 테스트 요청 알림 → `request-test` |

## Workflow

### 테스트 코드 작성

1. 테스트 대상 파일/함수 분석
2. 테스트 케이스 설계
3. 테스트 코드 작성
4. 테스트 실행 및 결과 확인

### 테스트 실행

```bash
# 전체 테스트
npm test

# 특정 파일
npm test -- {test_file}

# 커버리지
npm test -- --coverage
```

## 테스트 파일 위치 규칙

| 프로젝트 유형 | 테스트 파일 위치 |
|--------------|-----------------|
| Next.js | `__tests__/` 또는 `*.test.ts(x)` |
| Node.js | `test/` 또는 `*.spec.ts` |
| React | `*.test.tsx` (컴포넌트와 동일 디렉토리) |

## 테스트 유형별 작성 가이드

### Unit Test

```typescript
describe('함수명', () => {
  it('should 예상 동작', () => {
    // Arrange
    const input = ...;

    // Act
    const result = fn(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### Integration Test

```typescript
describe('API 엔드포인트', () => {
  it('should return 200 OK', async () => {
    const response = await request(app)
      .get('/api/resource')
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });
});
```

### E2E Test (Playwright)

```typescript
test('사용자 시나리오', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-testid="login"]');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

## 출력 형식

### 테스트 작성 완료

```markdown
[SEMO] Skill: tester → 테스트 작성 완료

📁 파일: {test_file_path}
✅ 테스트 케이스: {count}개
📊 커버리지: {coverage}%
```

### 테스트 실행 결과

```markdown
[SEMO] Skill: tester → 테스트 실행 완료

✅ Passed: {pass_count}
❌ Failed: {fail_count}
⏱️ 소요 시간: {duration}
```

## QA 테스트 요청이 필요한 경우

> **이 스킬은 코드 테스트만 담당합니다. QA 프로세스는 별도 스킬을 사용하세요.**

```text
"테스트 요청해줘", "QA에게 알려줘"
    │
    ├─ 상태 변경 + QA 할당이 필요하면
    │   └→ skill:change-to-testing (ops/qa)
    │
    └─ Slack 알림만 필요하면
        └→ skill:request-test (biz/management)
```

## References

- [Jest 공식 문서](https://jestjs.io/)
- [Playwright 공식 문서](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
