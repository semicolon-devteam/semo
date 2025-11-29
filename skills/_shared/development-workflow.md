# Development Workflow

> **SoT**: 핵심 원칙은 sax-core/PRINCIPLES.md 참조

## Core Principles

1. **TDD First**: 테스트 먼저 작성, 구현은 나중에 (Constitution Principle III)
2. **Small Increments**: 작고 테스트 가능한 단위로 작업
3. **Continuous Quality**: 개발 중 lint/typecheck 지속 실행
4. **Pattern First**: 구현 전 기존 패턴 이해 우선
5. **User Review**: 커밋은 사용자 검토용으로 남김

## Workflow Pattern

```text
1. Understand → 기존 코드/패턴 분석
2. Test First → 실패하는 테스트 작성
3. Implement  → 테스트 통과하는 코드 작성
4. Validate   → lint, typecheck 실행
5. Commit     → Atomic commit (1 기능 = 1 커밋)
```

## Quality Gates

모든 코드 변경 전 필수 확인:

| 체크 | 명령어 | 기준 |
|------|--------|------|
| ESLint | `npm run lint` | 0 errors |
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Tests | `npm test` | 100% passing |

## Do NOT

- 프로젝트 폴더 외부 파일 읽기/수정 금지
- `--no-verify` 사용 금지
- 5개 이상 파일을 하나의 커밋에 포함 금지
- 테스트 없이 구현 진행 금지
