# Commit Guide

> **SoT 참조**: 커밋 규칙은 `sax-core/TEAM_RULES.md` 참조

## 이슈 번호 추출

```bash
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
```

## Auto Type Detection

| Type | 트리거 | 예시 |
|------|--------|------|
| `feat` | 새 파일 생성, "Add/Create/Implement" | 새 컴포넌트, 훅 |
| `fix` | 에러 관련 수정, "Fix/Resolve/Correct" | 버그 수정 |
| `test` | `__tests__/` 파일, `.test.ts` | 테스트 추가 |
| `docs` | `.md` 파일 | README, spec.md |
| `chore` | 설정 파일, 구조 변경 | package.json |
| `refactor` | 기능 변경 없이 구조 개선 | 코드 정리 |

## Commit Workflow

```bash
# 1. 상태 확인
git status && git branch --show-current

# 2. 이슈 번호 추출
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)

# 3. 변경 사항 분석
git diff --stat

# 4. 커밋 (이슈 번호 포함)
git commit -m "✨ #${ISSUE_NUM} Add new feature"
```

## Atomic Commit 원칙

| 원칙 | 설명 |
|------|------|
| **1 파일 = 1 커밋** | 가능한 경우 |
| **1 기능 = 1 커밋** | 관련 파일 2-3개 |
| **5개 이상 금지** | 분할 커밋 필수 |

## 5개 이상 파일 변경 시

```markdown
⚠️ 5개 이상의 파일이 변경되었습니다.

**권장 분할**:
1. `✨ #35 Add PostsRepository` (Repository)
2. `✨ #35 Add usePosts hook` (Hook)
3. `✨ #35 Add Posts components` (Components)

분할하여 커밋할까요? (Y/n)
```

## Phase별 커밋 시점

| Phase | 커밋 시점 |
|-------|----------|
| v0.0.x CONFIG | 의존성 설치 후 |
| v0.1.x PROJECT | 각 도메인 디렉토리 생성 후 |
| v0.2.x TESTS | 레이어별 테스트 작성 후 |
| v0.3.x DATA | 모델/타입 정의 후 |
| v0.4.x CODE | 레이어별 구현 후 |

## 커밋 전 체크리스트

- [ ] `npm run lint` 통과
- [ ] `npx tsc --noEmit` 통과
- [ ] 관련 테스트 통과
- [ ] 커밋 메시지 형식 준수
- [ ] `--no-verify` 사용 안 함
