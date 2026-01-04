---
name: generate-spec
description: |
  Execute SDD Phase 1-5 workflow (specify → clarify → plan → checklist → tasks).
  Supports Reverse Mode: Task Issue → specs/ files + Task Issue update.
  Use when (1) Task Issue 기반 spec 생성, (2) 명확한 기능 요청이 있을 때,
  (3) spec.md/plan.md 생성 필요 시.
tools: [Read, Write, Edit, Bash, GitHub CLI]
location: project
triggers:
  - 명세 작성
  - spec 작성
  - 스펙 작성해줘
  - speckit
---

> **시스템 메시지**: `[SEMO] Skill: generate-spec 호출 - {기능명/Task 번호}`

# generate-spec Skill

**Purpose**: Spec-Driven Development (SDD) 워크플로우 실행 (Forward/Reverse Mode 지원)

## 동작 모드

| 모드 | 입력 | 출력 | Task 업데이트 |
|------|------|------|--------------|
| Forward (기존) | 사용자 요청 | spec.md, plan.md | - |
| **Reverse (신규)** | Task Issue 번호 | spec.md, plan.md | ✅ 체크리스트 업데이트 |

## When to Use

- **Reverse Mode (권장)**: Task Issue 생성 후 spec 문서화
- **Forward Mode**: Epic 없이 직접 spec 작성 시
- SDD workflow 필수 (Constitution Principle VIII)

> **💡 새로운 워크플로우**
> `ideate` → `create-tasks` → **`generate-spec`** (Reverse Mode)
> Task Issue가 Source of Truth, specs/ 파일은 문서화/백업

## 🔴 Reverse Mode (Task Issue 기반)

### 입력

```bash
# Task Issue 번호 지정
skill:generate-spec --task 201

# 또는 자연어
"#201 태스크 spec 작성해줘"
```

### 프로세스

```text
1. Task Issue 본문 조회
     ↓
2. 본문 파싱 (Problem Context, Goals, AC, Constraints)
     ↓
3. spec.md 생성 (역변환)
     ↓
4. plan.md 생성
     ↓
5. Task Issue 업데이트 (Speckit Progress 체크 + 링크 추가)
```

### Phase 1: Task Issue 파싱

```bash
# Task 본문 조회
TASK_BODY=$(gh issue view $TASK_NUMBER --repo semicolon-devteam/{repo} --json body --jq '.body')
TASK_TITLE=$(gh issue view $TASK_NUMBER --repo semicolon-devteam/{repo} --json title --jq '.title')

# Epic 번호 추출 (Metadata 섹션에서)
EPIC_NUMBER=$(echo "$TASK_BODY" | grep -oP 'Epic \| #\K[0-9]+')
```

**Task에서 추출할 정보**:

| 섹션 | spec.md 매핑 |
|------|-------------|
| Problem Context | Background, Problem Statement |
| Goals | Goals & Non-goals |
| User Scenario | User Stories |
| Constraints | Technical Constraints |
| Acceptance Criteria | Acceptance Criteria |
| 테스트 요구사항 | Test Cases |

### Phase 2: spec.md 생성

```markdown
# {Feature Name} Specification

## Background

{Task의 Problem Context에서 변환}

## Problem Statement

{Task의 Problem Context 상세}

## Goals & Non-goals

### Goals
{Task의 Goals 섹션}

### Non-goals
{Task의 Constraints에서 명시적 제외 항목}

## User Stories

{Task의 User Scenario 테이블을 User Story 형식으로 변환}

## Technical Constraints

{Task의 Constraints + 개발자 체크리스트}

## Acceptance Criteria

{Task의 Acceptance Criteria}

## Test Cases

### Unit Tests
{Task의 엔지니어 테스트}

### E2E Tests
{Task의 QA 테스트}
```

### Phase 3: plan.md 생성

```markdown
# {Feature Name} Implementation Plan

## Overview

{spec.md 요약}

## Technical Approach

{Layer 기반 구현 방향}

## Dependencies

{Task의 Dependencies 섹션}

## Implementation Steps

1. {Step 1}
2. {Step 2}
...
```

### Phase 4: Task Issue 업데이트

**Before (Task 생성 직후)**:
```markdown
## 🔄 Speckit Progress
<!-- generate-spec 실행 시 자동 업데이트 -->
- [ ] specify → spec.md
- [ ] plan → plan.md
- [ ] implement
```

**After (generate-spec 실행 후)**:
```markdown
## 🔄 Speckit Progress
<!-- generate-spec 실행 시 자동 업데이트 -->
- [x] specify → [spec.md](https://github.com/.../specs/5-feature/spec.md)
- [x] plan → [plan.md](https://github.com/.../specs/5-feature/plan.md)
- [ ] implement
```

**업데이트 로직**:

```bash
# 현재 본문 조회
CURRENT_BODY=$(gh issue view $TASK_NUMBER --repo semicolon-devteam/{repo} --json body --jq '.body')

# specs/ URL 생성
SPEC_URL="https://github.com/semicolon-devteam/{repo}/blob/dev/specs/${FEATURE_SLUG}/spec.md"
PLAN_URL="https://github.com/semicolon-devteam/{repo}/blob/dev/specs/${FEATURE_SLUG}/plan.md"

# Speckit Progress 섹션 업데이트
NEW_BODY=$(echo "$CURRENT_BODY" | sed \
  -e 's|- \[ \] specify → spec.md|- [x] specify → [spec.md]('"$SPEC_URL"')|' \
  -e 's|- \[ \] plan → plan.md|- [x] plan → [plan.md]('"$PLAN_URL"')|')

# Issue 업데이트
gh issue edit $TASK_NUMBER --repo semicolon-devteam/{repo} --body "$NEW_BODY"
```

## Forward Mode (기존)

> Task Issue 없이 직접 spec 작성 시 사용

### Phase Flow

```text
specify → clarify? → plan → checklist? → tasks → report
```

| Phase | Command | Output | Optional |
|-------|---------|--------|----------|
| 1 | `/speckit.specify` | spec.md | - |
| 2 | `/speckit.clarify` | spec.md (updated) | Auto |
| 3 | `/speckit.plan` | plan.md | - |
| 4 | `/speckit.checklist` | checklist.md | Ask |
| 5 | `/speckit.tasks` | tasks.md | - |

## 🔴 Branch Context (필수)

> **Spec 작성은 반드시 dev 브랜치에서 수행합니다.**

### 브랜치 요구사항

| 조건 | 설명 |
|------|------|
| **필수 브랜치** | `dev` |
| **금지 브랜치** | `main`, `master`, `feature/*` |

### Spec 완료 후 다음 단계

```text
1. Spec 파일 커밋 (dev 브랜치)
   git add specs/{domain}/
   git commit -m "📝 #{이슈번호} Add spec for {도메인}"

2. 원격 dev에 푸시 (팀 공유)
   git push origin dev

3. Feature 브랜치 생성 (코드 구현용)
   git checkout -b {issue_number}-{title}
```

## Output Format

### Reverse Mode 완료

```markdown
[SEMO] Skill: generate-spec 완료 (Reverse Mode)

## 📋 Spec 생성 결과

### Task
- 번호: #{task_number}
- 제목: {task_title}

### 생성된 파일
- spec.md: specs/{feature}/spec.md
- plan.md: specs/{feature}/plan.md

### Task Issue 업데이트
✅ Speckit Progress 체크리스트 업데이트 완료
- [x] specify → spec.md
- [x] plan → plan.md
- [ ] implement

### 다음 단계
1. **Spec 커밋**: `git add specs/ && git commit -m "📝 #{task_number} Add spec"`
2. **구현 시작**: Feature 브랜치에서 구현
```

## Usage

```javascript
// Reverse Mode (권장) - Task Issue 기반
skill: generate-spec({ task: 201 });

// Forward Mode - 직접 작성
skill: generate-spec("Add real-time notifications");

// Epic 연계 Forward Mode
skill: generate-spec({ epic: 144, feature: "comments" });
```

## Related Skills

- `ideate` - 러프한 아이디어 → Epic
- `create-tasks` - Epic → Task Issue (이 스킬 전에 호출)
- `implement` - 구현 단계 (이 스킬 후에 호출)
- `explore-approach` - 기술 불확실성 탐색 (spike)

## References

- [Reverse Mode Details](references/reverse-mode.md) - Task → spec 변환 상세
- [Phase Details](references/phase-details.md) - Forward Mode Phase 1-5 상세
- [Output Format](references/output-format.md) - 완료 리포트 형식
