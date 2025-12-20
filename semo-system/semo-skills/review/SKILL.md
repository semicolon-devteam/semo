---
name: review
description: |
  통합 코드 리뷰 스킬. 프로젝트 타입을 감지하여 적절한 플랫폼별 리뷰를 수행합니다.
  PR에 리뷰 코멘트를 자동 등록하고, APPROVE/REQUEST_CHANGES 판정을 내립니다.
  Use when (1) "/SEMO:review", "리뷰해줘", (2) "PR 리뷰", "코드 리뷰", (3) "태스크 리뷰".
tools: [Bash, Read, Grep, Glob]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: review` 시스템 메시지를 첫 줄에 출력하세요.

# Review Skill (통합 라우터)

> 플랫폼을 감지하고 적절한 eng 패키지 리뷰 스킬로 위임합니다.

## Trigger Keywords

- `/SEMO:review`
- `리뷰해줘`, `PR 리뷰`, `코드 리뷰`
- `태스크 리뷰`, `PR 전 검토`

## 플랫폼 감지 로직

프로젝트 루트에서 다음 파일을 순서대로 확인합니다:

| 우선순위 | 감지 조건 | 플랫폼 | 위임 대상 |
|----------|----------|--------|----------|
| 1 | `next.config.js` 또는 `next.config.ts` 존재 | nextjs | `packages/eng/nextjs/skills/review` |
| 2 | `build.gradle.kts` 존재 | spring | `packages/eng/spring/skills/review` |
| 3 | `docker-compose.yml` + `/services/` 디렉토리 | ms | `packages/eng/ms/skills/review` |
| 4 | `docker-compose.yml` + nginx 관련 설정 | infra | `packages/eng/infra/skills/review` |
| 5 | 기타 | generic | 기본 코드 품질 리뷰 |

## 워크플로우

### Step 1: 플랫폼 감지

```bash
# Next.js 감지
if [ -f "next.config.js" ] || [ -f "next.config.ts" ] || [ -f "next.config.mjs" ]; then
  PLATFORM="nextjs"
# Spring 감지
elif [ -f "build.gradle.kts" ] || [ -f "build.gradle" ]; then
  PLATFORM="spring"
# Microservice 감지
elif [ -f "docker-compose.yml" ] && [ -d "services" ]; then
  PLATFORM="ms"
# Infra 감지
elif [ -f "docker-compose.yml" ] && grep -q "nginx" docker-compose.yml; then
  PLATFORM="infra"
else
  PLATFORM="generic"
fi
```

### Step 2: eng 패키지 설치 확인

```bash
# eng 패키지 설치 여부 확인
SKILL_PATH="packages/eng/${PLATFORM}/skills/review/SKILL.md"
if [ -f "$SKILL_PATH" ]; then
  # 해당 플랫폼 리뷰 스킬로 위임
  echo "플랫폼별 리뷰 스킬 호출: $PLATFORM"
else
  # 기본 리뷰 수행
  echo "기본 리뷰 수행 (eng 패키지 미설치)"
fi
```

### Step 3: 플랫폼별 리뷰 위임 또는 기본 리뷰 수행

#### 플랫폼별 스킬 위임 시

해당 플랫폼의 `skill:review`를 호출하고, 그 스킬의 워크플로우를 따릅니다.

#### 기본 리뷰 수행 시 (eng 패키지 미설치)

```markdown
## 기본 코드 리뷰

### 1. PR 정보 조회
- 현재 브랜치의 PR 탐색
- PR diff 분석

### 2. 품질 검사
- ESLint/Prettier 검사 (package.json 존재 시)
- TypeScript 타입 검사 (tsconfig.json 존재 시)

### 3. 리뷰 결과
- 검사 통과 여부
- 발견된 이슈 목록

### 4. PR 리뷰 등록 (선택)
- 리뷰 코멘트 등록 여부 확인
```

## 출력 포맷

### 플랫폼 감지 결과

```markdown
[SEMO] Skill: review

📋 플랫폼 감지: {platform} ({detection_reason})
🔍 PR 탐색: #{pr_number} "{pr_title}"

→ {platform} 리뷰 스킬로 위임합니다.
```

### 리뷰 완료

```markdown
## 최종 결과: {verdict}

{verdict_details}

PR #{pr_number}에 리뷰 코멘트를 등록합니다...
✅ 리뷰 등록 완료
```

## Verdict 판정 기준

| 조건 | 판정 | GitHub 리뷰 타입 |
|------|------|-----------------|
| Critical 0건, Warning 0건 | ✅ APPROVE | APPROVE |
| Critical 0건, Warning 1건+ | 🟡 COMMENT | COMMENT |
| Critical 1건+ | 🔴 REQUEST_CHANGES | REQUEST_CHANGES |

## PR 리뷰 등록

```bash
# PR 번호 조회
PR_NUMBER=$(gh pr list --head $(git branch --show-current) --json number -q '.[0].number')

# 리뷰 등록
gh pr review $PR_NUMBER --approve --body "리뷰 코멘트..."
# 또는
gh pr review $PR_NUMBER --comment --body "리뷰 코멘트..."
# 또는
gh pr review $PR_NUMBER --request-changes --body "리뷰 코멘트..."
```

## 인자 처리

| 인자 | 설명 | 예시 |
|------|------|------|
| (없음) | 현재 브랜치 PR 리뷰 | `/SEMO:review` |
| `#123` | 특정 이슈 기반 리뷰 | `/SEMO:review #123` |
| `--pr 456` | 특정 PR 리뷰 | `/SEMO:review --pr 456` |
| `--platform nextjs` | 플랫폼 강제 지정 | `/SEMO:review --platform nextjs` |

## 에러 처리

### PR 없음

```markdown
[SEMO] Skill: review

⚠️ 현재 브랜치에 연결된 PR이 없습니다.

**해결 방법**:
1. PR을 먼저 생성하세요: `gh pr create`
2. 또는 이슈 번호로 리뷰: `/SEMO:review #123`
```

### eng 패키지 미설치

```markdown
[SEMO] Skill: review

📋 플랫폼 감지: Next.js
⚠️ eng/nextjs 패키지가 설치되지 않았습니다.

→ 기본 코드 품질 리뷰를 수행합니다.
💡 플랫폼별 상세 리뷰를 원하시면 `semo add eng/nextjs` 명령으로 패키지를 설치하세요.
```

## References

- [eng/nextjs review](../../../packages/eng/nextjs/skills/review/SKILL.md)
- [eng/spring review](../../../packages/eng/spring/skills/review/SKILL.md)
- [eng/ms review](../../../packages/eng/ms/skills/review/SKILL.md)
- [eng/infra review](../../../packages/eng/infra/skills/review/SKILL.md)
