# Quality Gates

> **Constitution Principle III**: Test-Driven Quality

## PR 전 필수 체크

| 체크 | 명령어 | 기준 | 실패 시 |
|------|--------|------|---------|
| ESLint | `npm run lint` | 0 errors | PR 차단 |
| TypeScript | `npx tsc --noEmit` | 0 errors | PR 차단 |
| Tests | `npm test` | 100% passing | PR 차단 |
| Coverage | `npm test -- --coverage` | 80%/80%/70% | 경고 |
| **E2E** | `skill:e2e-test` | 콘솔 에러 0, UI 표시 | PR 차단 |

## Coverage Thresholds

| 레이어 | 최소 커버리지 |
|--------|--------------|
| Repository | 80% |
| Hooks | 80% |
| Components | 70% |

## Severity Levels

| Level | 의미 | PR 영향 |
|-------|------|---------|
| 🔴 Critical | 테스트 실패, TS 에러, Constitution 위반 | **PR 차단** |
| 🟡 Warning | Debug 코드, 'any' 타입, 낮은 커버리지 | 수정 권장 |
| 🟢 Suggestion | 성능, 접근성 개선 | 선택적 |

## Blocking Issues (Critical)

- 테스트 실패
- TypeScript 컴파일 에러
- Console.log 남아있음
- Constitution 원칙 위반
- `--no-verify` 사용
- **E2E 테스트 실패 (콘솔 에러, UI 미표시)**

## Warning Issues

- 'any' 타입 사용 (정당한 사유 없이)
- 커버리지 미달
- JSDoc 누락
- Debug 코드 (주석 처리된 것 포함)

## Quick Validation Command

```bash
# 전체 검증 (Unit Test + Static Analysis)
npm run lint && npx tsc --noEmit && npm test -- --coverage

# Debug 코드 체크
grep -rn "console\.log\|debugger" src/ --include="*.ts" --include="*.tsx"

# E2E 테스트 (런타임 검증)
# → "E2E 테스트해줘" 또는 skill:e2e-test 호출
```

## E2E 테스트 기준

| 테스트 | 기준 | 실패 시 |
|--------|------|---------|
| 페이지 로드 | HTTP 200, 렌더링 완료 | PR 차단 |
| 콘솔 에러 | 0 errors | PR 차단 |
| 주요 UI | 핵심 컴포넌트 표시 | PR 차단 |
| 반응형 | 모바일/데스크톱 레이아웃 | 경고 (진행 가능) |
