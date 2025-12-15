---
name: onboarding-po
description: |
  PO/기획자 온보딩 실습 (SEMO-PO 패키지 전용). Use when (1) semo-core/skill:onboarding에서 호출,
  (2) PO/기획자 온보딩 실습 필요 시. Epic 생성 및 PO 워크플로우 체험.
tools: [Read, Bash, Glob, Grep]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: onboarding-po 호출`

# onboarding-po Skill

> PO/기획자를 위한 온보딩 실습 (SEMO-PO 패키지 전용)

## Purpose

SEMO Core의 `skill:onboarding` Phase 3에서 호출됩니다.
PO/기획자를 위한 실습 과정을 제공합니다.

## Prerequisites

- Phase 0-2 완료 (환경 진단, 조직 참여, SEMO 개념 학습)
- semo-core/skill:onboarding에서 호출됨

## Workflow

### Step 1: PO 워크플로우 안내

```text
PO 워크플로우:

1. Epic 생성 ("댓글 기능 Epic 만들어줘")
   → epic-master Agent 호출
   → docs 레포에 Epic 이슈 생성

2. (선택) Spec 초안 작성
   → spec-writer Agent 호출
   → specs/{epic}/spec.md 생성

3. 개발팀 전달
   → 개발자가 대상 레포에서 /speckit.specify 실행
   → Spec 보완

4. Task 동기화
   → 개발자가 /speckit.tasks 완료 후
   → sync-tasks skill로 GitHub Issues 연동

5. 진행도 추적
   → GitHub Projects에서 Epic 상태 확인
```

### Step 2: Epic 생성 실습

```markdown
## Epic 생성 실습

간단한 Epic을 생성해보세요:

> "테스트용 버튼 컴포넌트 Epic 만들어줘"

**확인 사항**:
- [SEMO] Orchestrator 메시지 확인
- [SEMO] Agent: epic-master 메시지 확인
- [SEMO] Skill: create-epic 메시지 확인
- docs 레포 Issues에서 생성된 Epic 확인
```

### Step 3: Epic 템플릿 안내

```markdown
# Epic 템플릿

## 제목
[Epic] {기능명}

## 요약
{한 줄 설명}

## 목적
- 왜 필요한가?
- 어떤 문제를 해결하는가?

## 범위
- 포함: ...
- 제외: ...

## 수락 기준
- [ ] ...
- [ ] ...
```

## Expected Output

```markdown
[SEMO] Skill: onboarding-po 호출

=== PO/기획자 온보딩 실습 ===

## 1. PO 워크플로우

```text
1. Epic 생성 → docs 레포에 이슈 생성
2. (선택) Spec 초안 → specs/{epic}/spec.md
3. 개발팀 전달 → 개발자가 Spec 보완
4. Task 동기화 → GitHub Issues 연동
5. 진행도 추적 → GitHub Projects
```

## 2. Epic 생성 실습

다음 요청으로 Epic을 생성해보세요:

> "테스트용 버튼 컴포넌트 Epic 만들어줘"

**확인 사항**:
- [SEMO] Orchestrator 메시지 출력
- [SEMO] Agent: epic-master 호출
- docs 레포에 Epic 이슈 생성 확인

## 3. Epic 템플릿

Epic 작성 시 다음 템플릿을 참조하세요:

- 제목: [Epic] {기능명}
- 요약: 한 줄 설명
- 목적: 왜 필요한가?
- 범위: 포함/제외 사항
- 수락 기준: 완료 조건

✅ 실습 완료

[SEMO] Skill: onboarding-po 완료
```

## SEMO Message Format

```markdown
[SEMO] Skill: onboarding-po 호출

[SEMO] Skill: onboarding-po 완료
```

## References

- [po-workflow.md](references/po-workflow.md) - PO 워크플로우 상세
- [epic-template.md](references/epic-template.md) - Epic 템플릿
