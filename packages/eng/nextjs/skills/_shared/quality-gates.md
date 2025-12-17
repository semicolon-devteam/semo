# Quality Gates

> **Constitution Principle III**: Test-Driven Quality

## PR 전 필수 체크

| 체크 | 명령어 | 기준 | 실패 시 |
|------|--------|------|---------|
| ESLint | `npm run lint` | 0 errors | PR 차단 |
| TypeScript | `npx tsc --noEmit` | 0 errors | PR 차단 |
| Tests | `npm test` | 100% passing | PR 차단 |
| Coverage | `npm test -- --coverage` | 80%/80%/70% | 경고 |

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

## Warning Issues

- 'any' 타입 사용 (정당한 사유 없이)
- 커버리지 미달
- JSDoc 누락
- Debug 코드 (주석 처리된 것 포함)

## Quick Validation Command

```bash
# 전체 검증
npm run lint && npx tsc --noEmit && npm test -- --coverage

# Debug 코드 체크
grep -rn "console\.log\|debugger" src/ --include="*.ts" --include="*.tsx"
```
