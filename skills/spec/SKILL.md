---
name: spec
description: Execute SDD Phase 0-3 workflow (brainstorm? → specify → plan → tasks). Use when (1) rough idea needs refinement, (2) starting new feature needing specification, (3) user requests spec creation, (4) need to create spec.md/plan.md/tasks.md before implementation.
tools: [Read, Write, Edit]
location: project
triggers:
  - 아이디어가 있는데
  - 뭔가 만들고 싶어
  - 이런 거 되나
  - 기능 추가
  - 명세 작성
  - spec
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: spec 호출 - {기능명}` 시스템 메시지를 첫 줄에 출력하세요.

# Spec Skill (Enhanced with Brainstorming)

**Purpose**: Orchestrate complete Spec-Driven Development (SDD) workflow with optional brainstorming phase

## When to Use

- **Brainstorming (Phase 0)**: 아이디어가 모호하거나 러프할 때
- **Specification (Phase 1+)**: 명확한 기능 요청이 있을 때
- Requirement gathering is needed before implementation
- SDD workflow must be followed (Constitution Principle VIII)

## Phase Flow

```
brainstorm? → specify → clarify? → plan → checklist? → tasks → issues? → report
```

| Phase | Command | Output | Optional |
|-------|---------|--------|----------|
| 0 | `brainstorm` | design-brief.md | Auto-detect |
| 1 | `/speckit.specify` | spec.md | - |
| 2 | `/speckit.clarify` | spec.md (updated) | Auto |
| 3 | `/speckit.plan` | plan.md | - |
| 4 | `/speckit.checklist` | checklist.md | Ask |
| 5 | `/speckit.tasks` | tasks.md | - |
| 6 | `skill:create-issues` | GitHub Issues | Ask |

## Phase 0: Brainstorming (자동 감지)

### 활성화 조건

다음 패턴 감지 시 **자동으로** Phase 0 활성화:

| 트리거 패턴 | 예시 |
|------------|------|
| 모호한 표현 | "뭔가 만들고 싶어", "이런 거 되나?" |
| 아이디어 키워드 | "아이디어가 있는데", "생각해봤는데" |
| 탐색적 질문 | "어떻게 하면 좋을까?", "가능할까?" |

### Brainstorming Workflow

```
[SAX] Skill: spec 호출 - Brainstorming 모드

🧠 Phase 0: Brainstorming

아이디어를 구체화하겠습니다.
한 번에 하나의 질문으로 진행합니다.
```

**Step 1: 아이디어 이해**
- 프로젝트 현재 상태 파악 (파일, 문서, 커밋)
- **단일 질문**으로 핵심 파악
- 목적, 제약사항, 성공 기준에 집중

**Step 2: 접근 방식 탐색**
- 2-3가지 옵션을 **객관식**으로 제시
- 각 옵션의 트레이드오프 설명
- 추천 방안과 그 이유 제시

**Step 3: 디자인 합의**
- 선택된 방향으로 디자인 브리프 작성
- 섹션별 200-300단어로 구조화
- 각 섹션 검증 후 다음 진행

> 📖 상세 가이드: [Brainstorming Guide](references/brainstorming-guide.md)

## Usage

```javascript
// 명확한 기능 요청 → Phase 1부터 시작
skill: spec("Add real-time notifications for post comments");

// 모호한 아이디어 → Phase 0 (Brainstorming)부터 시작
skill: spec("뭔가 사용자 참여를 늘리고 싶은데");

// 명시적 Brainstorming 요청
skill: spec({ brainstorm: true, idea: "커뮤니티 기능" });
```

## Constitution Compliance

- **Principle VIII**: Spec-Driven Development (NON-NEGOTIABLE)
- Ensures WHAT and WHY documented before HOW
- Creates single source of truth for features

## Related Skills

- `implement` - ADD Phase 4 implementation
- `verify` - Phase 5 verification
- `create-issues` - GitHub Issues automation
- `spike` - 기술 불확실성 탐색 (Phase 0에서 기술 질문 발생 시)

## References

For detailed documentation, see:

- [Brainstorming Guide](references/brainstorming-guide.md) - Phase 0 상세, 질문 기법, 출력 형식
- [Phase Details](references/phase-details.md) - Phase 1-7 상세, configuration options
- [Output Format](references/output-format.md) - Completion report, dependencies, success criteria
