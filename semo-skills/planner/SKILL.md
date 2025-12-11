# SEMO Skill: Planner

> 기획, 관리, 추정을 담당하는 스킬 그룹

**위치**: `semo-skills/planner/`
**Layer**: Layer 1 (Capabilities)

---

## 개요

Planner는 프로젝트 기획 및 관리 관련 작업을 처리하는 스킬 그룹입니다.

---

## 하위 스킬

| 스킬 | 역할 | 설명 |
|------|------|------|
| **epic** | Epic 생성/관리 | 대규모 기능 단위 정의 |
| **task** | Task 분해 | Epic을 실행 가능한 단위로 분해 |
| **sprint** | 스프린트 관리 | 스프린트 계획 및 회고 |
| **roadmap** | 로드맵 작성 | 장기 계획 수립 |

---

## 사용 예시

### Epic 생성

```
사용자: 댓글 기능 Epic 만들어줘

[SEMO] Skill: planner/epic 호출

## Epic: 댓글 기능

### 개요
...

### User Stories
- [ ] 사용자는 댓글을 작성할 수 있다
- [ ] 사용자는 댓글을 수정할 수 있다
...
```

### Task 분해

```
사용자: 이 Epic Task로 나눠줘

[SEMO] Skill: planner/task 호출

## Tasks

1. [ ] DB 스키마 설계 (2h)
2. [ ] API 엔드포인트 구현 (4h)
3. [ ] UI 컴포넌트 개발 (3h)
...
```

---

## 디렉토리 구조

```
semo-skills/planner/
├── SKILL.md              # 이 파일
├── epic/
│   └── SKILL.md          # Epic 생성
├── task/
│   └── SKILL.md          # Task 분해
├── sprint/
│   └── SKILL.md          # 스프린트 관리
└── roadmap/
    └── SKILL.md          # 로드맵 작성
```

---

## 매핑 정보 (SAX → SEMO)

| 기존 패키지 | 기존 스킬 | 새 위치 |
|-------------|----------|---------|
| sax-po | create-epic | planner/epic |
| sax-po | break-down-tasks | planner/task |
| sax-pm | sprint-planning | planner/sprint |
| sax-pm | create-roadmap | planner/roadmap |

---

## 참조

- [SEMO Principles](../../semo-core/principles/PRINCIPLES.md)
