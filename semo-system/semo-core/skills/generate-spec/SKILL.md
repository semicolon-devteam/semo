---
name: generate-spec
description: |
  Execute SDD Phase 1-5 workflow (specify → clarify → plan → checklist → tasks).
  Use when (1) Epic이 있고 상세 명세 필요, (2) 명확한 기능 요청이 있을 때,
  (3) spec.md/plan.md/tasks.md 생성 필요 시.
  러프한 아이디어는 ideate 스킬 사용 권장.
tools: [Read, Write, Edit]
location: project
triggers:
  - 명세 작성
  - spec 작성
  - 스펙 작성해줘
  - speckit
---

> **시스템 메시지**: `[SEMO] Skill: generate-spec 호출 - {기능명}`

# generate-spec Skill

**Purpose**: Spec-Driven Development (SDD) Phase 1-5 워크플로우 실행

## When to Use

- **Epic이 있고 상세 명세 필요**: ideate → create-epic 이후
- **명확한 기능 요청**: 요구사항이 구체적일 때
- SDD workflow 필수 (Constitution Principle VIII)

> **💡 러프한 아이디어?** → `ideate` 스킬 사용 권장
> ideate가 Brainstorming + Epic 생성까지 처리 후 이 스킬로 연계됩니다.

## 🔴 Branch Context (필수)

> **Spec 작성은 반드시 dev 브랜치에서 수행합니다.**

### 브랜치 요구사항

| 조건 | 설명 |
|------|------|
| **필수 브랜치** | `dev` |
| **금지 브랜치** | `main`, `master`, `feature/*` |

### 잘못된 브랜치 경고

```markdown
⚠️ [SEMO] Skill: spec - 브랜치 경고

현재 브랜치: {current_branch}
필수 브랜치: dev

Spec 작성은 dev 브랜치에서 수행해야 합니다.
다른 작업자도 Spec을 공유받을 수 있도록 원격에 푸시한 후
Feature 브랜치를 생성하세요.

👉 `git checkout dev` 후 다시 시도하세요.
```

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

> **목적**: 다른 작업자도 특정 도메인의 Spec을 공유받을 수 있도록 함

## Phase Flow

```text
specify → clarify? → plan → checklist? → tasks → issues? → report
```

| Phase | Command | Output | Optional |
|-------|---------|--------|----------|
| 1 | `/speckit.specify` | spec.md | - |
| 2 | `/speckit.clarify` | spec.md (updated) | Auto |
| 3 | `/speckit.plan` | plan.md | - |
| 4 | `/speckit.checklist` | checklist.md | Ask |
| 5 | `/speckit.tasks` | tasks.md | - |
| 6 | `skill:create-issues` | GitHub Issues | Ask |

## Usage

```javascript
// Epic 이후 명세 작성
skill: spec("Add real-time notifications for post comments");

// Epic 번호 지정
skill: spec({ epic: 144, feature: "comments" });
```

## Constitution Compliance

- **Principle VIII**: Spec-Driven Development (NON-NEGOTIABLE)
- Ensures WHAT and WHY documented before HOW
- Creates single source of truth for features

## Related Skills

- `ideate` - 러프한 아이디어 → Design Brief → Epic (이 스킬 전에 호출)
- `implement` - ADD Phase 4 implementation
- `verify` - Phase 5 verification
- `create-issues` - GitHub Issues automation
- `explore-approach` - 기술 불확실성 탐색 (spike)

## References

- [Phase Details](references/phase-details.md) - Phase 1-5 상세, configuration options
- [Output Format](references/output-format.md) - Completion report, dependencies, success criteria
- [Brainstorming Guide](references/brainstorming-guide.md) - (Legacy) ideate 스킬로 이관됨
