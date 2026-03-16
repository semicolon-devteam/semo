# GitHub Actions 리뷰 → SEMO 마이그레이션 가이드

> GitHub Actions 기반 PR 자동 리뷰를 SEMO `/SEMO:review` 커맨드로 전환하는 가이드

## 개요

기존에는 각 레포지토리마다 `.github/scripts/review-pr.js`와 `.github/workflows/pr-auto-review.yml`을 사용하여 PR 리뷰를 자동화했습니다. 이제 SEMO의 통합 리뷰 시스템으로 전환하여 중앙화된 리뷰를 수행합니다.

## 변경 사항

### Before (GitHub Actions)

```
각 레포지토리:
├── .github/
│   ├── scripts/
│   │   └── review-pr.js           # Claude API 직접 호출
│   └── workflows/
│       └── pr-auto-review.yml     # PR 이벤트 트리거
└── (Repository Secrets)
    └── ANTHROPIC_API_KEY          # 개별 API 키 관리
```

### After (SEMO)

```
SEMO 통합:
├── semo-system/semo-skills/review/    # 통합 라우터
├── packages/eng/{platform}/skills/review/  # 플랫폼별 리뷰
└── /SEMO:review 커맨드
```

## 마이그레이션 단계

### 1. SEMO 업데이트

```bash
semo update
```

또는 Claude Code에서:

```
"SEMO 업데이트해줘"
```

### 2. eng 패키지 설치 확인

해당 플랫폼의 eng 패키지가 설치되어 있는지 확인합니다:

```bash
ls semo-system/
# 또는
ls packages/eng/
```

**플랫폼별 패키지**:
- `eng/nextjs` - Next.js 프로젝트
- `eng/spring` - Spring Boot 프로젝트
- `eng/ms` - 마이크로서비스 프로젝트
- `eng/infra` - 인프라 설정

### 3. GitHub Actions 파일 삭제

각 레포지토리에서 다음 파일을 삭제합니다:

```bash
# 삭제 대상
rm -rf .github/scripts/review-pr.js
rm -rf .github/workflows/pr-auto-review.yml
```

**대상 레포지토리**:
- `ms-media-processor`
- `command-center`
- `cm-office`
- `cm-land`
- 기타 PR 자동 리뷰가 설정된 레포

### 4. GitHub Secrets 정리

각 레포지토리의 Settings > Secrets and variables > Actions에서 삭제:

- `ANTHROPIC_API_KEY`

> **참고**: SEMO는 Claude Code의 인증을 사용하므로 별도 API 키가 필요하지 않습니다.

### 5. 리뷰 테스트

```bash
# Claude Code에서
/SEMO:review

# 또는 자연어로
"리뷰해줘"
"PR 리뷰해줘"
```

## 새 리뷰 사용법

### 기본 사용

```bash
/SEMO:review              # 현재 브랜치 PR 리뷰
/SEMO:review #123         # 특정 이슈 기반 리뷰
/SEMO:review --pr 456     # 특정 PR 리뷰
```

### 자연어 사용

```
"리뷰해줘"
"PR 리뷰해줘"
"코드 리뷰해줘"
"태스크 리뷰해줘"
```

### 플랫폼 자동 감지

SEMO는 프로젝트 타입을 자동으로 감지합니다:

| 감지 파일 | 플랫폼 | 리뷰 스킬 |
|-----------|--------|----------|
| `next.config.*` | Next.js | eng/nextjs/review |
| `build.gradle.kts` | Spring | eng/spring/review |
| `docker-compose.yml` + `/services/` | MS | eng/ms/review |
| `docker-compose.yml` + nginx | Infra | eng/infra/review |

## 기능 비교

### 기존 (GitHub Actions)

- PR 생성/업데이트 시 자동 트리거
- Claude API 직접 호출
- 각 레포마다 API 키 관리
- 리뷰 로직 분산

### 새 SEMO

- Claude Code 세션에서 수동 호출
- 중앙화된 리뷰 로직
- API 키 별도 관리 불필요
- 플랫폼별 맞춤 리뷰

## 리뷰 결과 예시

```markdown
[SEMO] Skill: review (nextjs)

📋 이슈: #456 "메타태그 기능 구현"
🔍 PR: #789

=== Phase 1-5: 태스크 리뷰 ===
| Phase | 상태 |
|-------|------|
| 메타데이터 | ✅ |
| 테스트 구조 | ✅ |
| 아키텍처 | ✅ |
| 기능 구현 | ✅ |
| 품질 게이트 | ✅ |

=== Phase 6: 코드 리뷰 ===
- Team Codex: ✅
- DDD Architecture: ✅
- Supabase: ✅

## 최종 결과: ✅ APPROVE

PR #789에 리뷰 코멘트를 등록합니다...
✅ 리뷰 등록 완료
```

## 문제 해결

### eng 패키지가 설치되지 않은 경우

```markdown
[SEMO] Skill: review

📋 플랫폼 감지: Next.js
⚠️ eng/nextjs 패키지가 설치되지 않았습니다.

→ 기본 코드 품질 리뷰를 수행합니다.
💡 플랫폼별 상세 리뷰를 원하시면 `semo add eng/nextjs` 명령으로 패키지를 설치하세요.
```

### PR이 없는 경우

```markdown
[SEMO] Skill: review

⚠️ 현재 브랜치에 연결된 PR이 없습니다.

**해결 방법**:
1. PR을 먼저 생성하세요: `gh pr create`
2. 또는 이슈 번호로 리뷰: `/SEMO:review #123`
```

## 참조

- [/SEMO:review 커맨드](../semo-system/semo-core/commands/SEMO/review.md)
- [통합 리뷰 스킬](../semo-system/semo-skills/review/SKILL.md)
- [eng/nextjs 리뷰](../packages/eng/nextjs/skills/review/SKILL.md)
