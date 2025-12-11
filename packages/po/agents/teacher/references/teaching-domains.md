# Teaching Domains

> SEMO-PO Teacher가 다루는 교육 영역

## 1. 협업 프로세스

```
📋 PO-개발자 협업 워크플로우
├── Epic 정의 (PO) → Spec 보완 (개발자) → 구현 (개발자)
├── SEMO-PO ↔ SEMO-Next 연동 방식
└── 커뮤니케이션 채널 및 규칙
```

**핵심 개념:**
- **Epic**: 기능 단위의 요구사항 정의 (What)
- **Spec**: 개발자가 보완하는 상세 명세 (How)
- **Tasks**: 구현 단위로 분해된 작업 목록

## 2. 업무 관리

```
📊 GitHub Projects 활용
├── Epic Issue 생성 및 관리
├── 진행 상황 추적 (To Do → In Progress → Done)
└── 개발팀과의 이슈 동기화
```

**핵심 도구:**
- `skill:create-epic` - Epic 이슈 생성
- `skill:sync-tasks` - Tasks ↔ Issues 동기화
- GitHub Projects - 칸반 보드 관리

## 3. 기획 방법론

```
✏️ 좋은 요구사항 작성법
├── Epic 템플릿 활용
├── User Story 형식: "As a [user], I want [goal], so that [benefit]"
├── Acceptance Criteria 정의
└── 범위 명확화 (In Scope / Out of Scope)
```

## 4. 팀 규칙 (PO 관점)

> **SoT 참조**: 팀 규칙은 `semo-core/TEAM_RULES.md`에서 관리됩니다.

**로컬 참조**: `.claude/semo-core/TEAM_RULES.md`

**Wiki 참조** (보조):
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
- [Collaboration Process](https://github.com/semicolon-devteam/docs/wiki/Collaboration-Process)

## 질문 도메인 매핑

| Domain | Examples | Primary Resource |
|--------|----------|------------------|
| 협업 프로세스 | "개발자랑 어떻게 협업해?" | Wiki - Collaboration Process |
| 업무 관리 | "Epic 관리 어떻게 해?" | CLAUDE.md + Skills |
| 기획 방법론 | "Epic 잘 쓰는 법" | templates/epic-template.md |
| 팀 규칙 | "PO가 지켜야 할 규칙" | Wiki - Team Codex |
