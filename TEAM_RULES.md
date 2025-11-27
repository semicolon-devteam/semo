# Semicolon Team Rules

> SAX Core - Semicolon 팀 공통 규칙 및 설정

## 기본 설정

- **응답 언어**: 한글
- **기본 Organization**: `semicolon-devteam`
- **이슈 템플릿**: `.github/ISSUE_TEMPLATE` 기반 작성
- **스타일드 컴포넌트**: React에서 사용 시 파일 최하단에 정의

## 필수 참조 문서

**Semicolon 팀의 모든 작업은 docs/wiki 문서를 기반으로 합니다.**

### 핵심 문서

| 카테고리 | 문서 | URL |
|----------|------|-----|
| 팀 문화 | 개발 철학 | https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy |
| 팀 문화 | 팀 코덱스 | https://github.com/semicolon-devteam/docs/wiki/Team-Codex |
| 협업 | 전체 워크플로우 | https://github.com/semicolon-devteam/docs/wiki/Collaboration-Process |
| 협업 | Epic to Tasks | https://github.com/semicolon-devteam/docs/wiki/Epic-To-Tasks-Automation |
| 개발 표준 | 코딩 컨벤션 | https://github.com/semicolon-devteam/docs/wiki/Dev-Conventions-Code |
| 개발 표준 | 테스트 컨벤션 | https://github.com/semicolon-devteam/docs/wiki/Dev-Conventions-Testing |

### 프로세스별 가이드

| Phase | 문서 |
|-------|------|
| Phase 1 | [Epic 생성](https://github.com/semicolon-devteam/docs/wiki/Process-Phase-1-Epic-Creation) |
| Phase 2 | [Task 생성](https://github.com/semicolon-devteam/docs/wiki/Process-Phase-2-Task-Creation) |
| Phase 3 | [개발](https://github.com/semicolon-devteam/docs/wiki/Process-Phase-3-Development) |
| Phase 4 | [배포](https://github.com/semicolon-devteam/docs/wiki/Process-Phase-4-Deployment) |

## 문서 사용 원칙

1. **문서 우선 참조**: 개발 철학, 코덱스, 협업 프로세스 관련 질문 → docs/wiki 문서 참조 필수
2. **규칙 기반 판단**: Semicolon 팀 작업 규칙 → docs/wiki 기반으로 판단
3. **충돌 시 제안**: 요청이 문서 규칙과 충돌 → 사용자에게 문서 갱신 제안

## 문서 갱신 제안 기준

다음 상황에서 문서 갱신을 제안합니다:

- 요청이 기존 규칙과 크게 벗어나는 경우
- 새로운 패턴이나 컨벤션이 필요한 경우
- 기존 문서에 명시되지 않은 예외 사항
- 팀 워크플로우 개선 제안이 있는 경우

**제안 형식**:

```text
[SAX] 문서 갱신 제안

현재 요청: [요청 내용]
기존 규칙: [docs/wiki의 기존 규칙]
충돌 사항: [어떤 부분이 충돌하는지]

제안 사항:
- [구체적인 문서 갱신 내용]
- [갱신해야 할 위키 페이지]

이 변경사항을 docs/wiki에 반영하시겠습니까?
```

## Quality Gates (품질 검증)

Semicolon 팀 프로젝트 작업 시 필수 품질 검증:

| 검증 항목 | 명령어 | 필수 |
|-----------|--------|------|
| Lint Check | `npm run lint` | O |
| TypeScript Check | `npx tsc --noEmit` | O |
| Test Execution | `npm run test -- path/to/changed/files` | O |
| Build Validation | `npm run build` | 가능한 경우 |

### 중요 규칙

- **Pre-commit Ready**: git add 전 모든 품질 체크 완료
- **No Bypass Hooks**: `--no-verify` 플래그 사용 금지 (사용자가 명시적으로 요청한 경우 제외)

## Supabase Backend Integration

Supabase DB 직접 연결 구현 시 필수 규칙:

### 문서 우선 확인

```bash
# core-supabase 테스트 문서 조회
gh api repos/semicolon-devteam/core-supabase/contents/document/test

# 특정 테스트 파일 읽기
gh api repos/semicolon-devteam/core-supabase/contents/document/test/posts/createPost.ts \
  --jq '.content' | base64 -d

# RPC 함수 정의 조회
gh api repos/semicolon-devteam/core-supabase/contents/docker/volumes/db/init/functions/05-posts
```

### 핵심 원칙

- **기존 RPC 사용**: core-supabase에 이미 제공된 RPC 함수가 있다면 새로 만들지 않음
- **타입 안전성**: RPC jsonb 반환값에 `as unknown as Type` 사용
- **파라미터 처리**: 선택적 RPC 파라미터에 `null as unknown as undefined` 사용

### 주요 RPC 함수

| 도메인 | 함수명 |
|--------|--------|
| Posts | `posts_read`, `posts_create`, `posts_update`, `posts_delete` |
| Comments | `comments_create`, `comments_read`, `comments_update`, `comments_delete` |
| Reactions | `reactions_toggle`, `reactions_get` |

## Git Workflow

### 필수 규칙

- **항상 상태 확인**: 세션 시작 시 `git status && git branch`
- **Feature Branch Only**: main/master에서 직접 작업 금지
- **Incremental Commits**: 의미 있는 메시지로 자주 커밋
- **Verify Before Commit**: `git diff`로 변경사항 확인 후 staging

### 커밋 메시지

- 관련 이슈 번호를 깃모지 뒤에 포함
- 예: `feat: #123 로그인 기능 추가`

## 참조 방법

SAX Core TEAM_RULES.md 참조:

```bash
gh api repos/semicolon-devteam/docs/contents/sax/core/TEAM_RULES.md \
  --jq '.content' | base64 -d
```
