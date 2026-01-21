# QuickNote Demo Project

> SEMO Greenfield 워크플로우 시연용 데모 프로젝트

## 개요

| 항목 | 내용 |
|------|------|
| **이름** | QuickNote - 간단한 노트 기능 |
| **범위** | 노트 CRUD (생성, 조회, 삭제) |
| **기술스택** | Next.js 14+, Supabase, TanStack Query |
| **아키텍처** | DDD 4-layer |
| **예상 시간** | 60-90분 |

## 목적

이 데모는 SEMO Greenfield 워크플로우의 전체 흐름을 시연합니다:

```
Phase 1: Discovery → Phase 2: Planning → Phase 3: Solutioning → Phase 4: Implementation
```

24개 워크플로우 노드를 거쳐 실제 코드 구현 및 테스트까지 완수합니다.

---

## 범위 정의

### In Scope

- 노트 생성 (제목 + 내용)
- 노트 목록 조회
- 노트 상세 보기
- 노트 삭제

### Out of Scope

- Rich text 편집
- 공유/협업
- 태그/카테고리
- 검색 기능

---

## User Stories (Sprint 1)

### US-1: 노트 목록 조회 (3pt)

| AC | 설명 |
|----|------|
| AC-1.1 | 제목, 수정일 표시 |
| AC-1.2 | 빈 상태 처리 |
| AC-1.3 | 로딩 상태 처리 |

### US-2: 노트 생성 (3pt)

| AC | 설명 |
|----|------|
| AC-2.1 | 제목(필수, 100자), 내용(선택, 5000자) |
| AC-2.2 | 저장 → 목록으로 이동 |
| AC-2.3 | 취소 → 목록으로 이동 |

### US-3: 노트 조회/삭제 (2pt)

| AC | 설명 |
|----|------|
| AC-3.1 | 상세 페이지에서 전체 내용 표시 |
| AC-3.2 | 삭제 확인 다이얼로그 |
| AC-3.3 | 삭제 후 목록으로 이동 |

---

## 시작하기

### 1. 테스트 환경 준비

```bash
# 테스트 프로젝트 생성
mkdir /tmp/quicknote-demo && cd /tmp/quicknote-demo
git init
npx create-next-app@latest . --typescript --tailwind --app

# SEMO 설치
semo init
```

### 2. Supabase 설정

```bash
# Supabase CLI 로그인
supabase login

# 프로젝트 연결 (또는 새 프로젝트 생성)
supabase link --project-ref <your-project-ref>

# 스키마 적용
supabase db push < demo/quicknote/setup/schema.sql

# 샘플 데이터 추가 (선택)
supabase db push < demo/quicknote/setup/seed.sql
```

### 3. 워크플로우 실행

```bash
# Greenfield 워크플로우 시작
/SEMO-workflow:greenfield

# 프로젝트명 입력: "QuickNote Demo"
```

---

## 워크플로우 실행 가이드

### Phase 1: Discovery (5-10분)

1. **D0**: "Discovery 포함?" → "예" 선택
2. **D1**: `ideate` 스킬 실행 → Epic Issue 생성

### Phase 2: Planning (10-15분)

1. **P1**: `generate-spec` → `specs/quicknote/spec.md` 생성
2. **P2**: "UI 포함?" → "예" 선택
3. **P3**: `design-user-flow` → `docs/design/user-flow.md` 생성
4. **P4**: `generate-mockup` → UI 컴포넌트 생성

### Phase 3: Solutioning (15-20분)

1. **S1**: `scaffold-domain` → `app/notes/` 4-layer 구조 생성
2. **S2**: "아키텍처 검증?" → "아니오" 선택 (간소화)
3. **S4**: `generate-spec` (Tasks) → `specs/quicknote/tasks.md` 생성
4. **S5**: "테스트 설계?" → "예" 선택
5. **S6**: `design-tests` → `docs/test/test-cases.md` 생성
6. **S7**: Gateway → Implementation으로 자동 진행

### Phase 4: Implementation (30-45분)

1. **I1**: `create-sprint` → Sprint Issue 생성
2. **I2**: `start-task` → 브랜치 + Draft PR 생성
3. **I3-I4**: Task 검증 (선택적)
4. **I5**: `write-code` → 실제 코드 구현
5. **I6**: `run-code-review` → PR 리뷰
6. **I7**: "리뷰 통과?" → "예" 선택
7. **I8**: "추가 Task?" → 반복 또는 종료
8. **I9**: `close-sprint` → Sprint 종료
9. **I10**: "추가 Epic?" → "아니오" 선택
10. **END**: 워크플로우 완료

---

## 예상 결과물

### DDD 4-Layer 구조

```
app/notes/
├── _repositories/
│   ├── __tests__/
│   │   └── NotesRepository.test.ts
│   ├── NotesRepository.ts
│   └── index.ts
├── _api-clients/
│   ├── notes.client.ts
│   └── index.ts
├── _hooks/
│   ├── __tests__/
│   │   └── useNotes.test.ts
│   ├── useNotes.ts
│   ├── useCreateNote.ts
│   ├── useDeleteNote.ts
│   └── index.ts
├── _components/
│   ├── __tests__/
│   │   └── NotesList.test.tsx
│   ├── NotesHeader.tsx
│   ├── NotesList.tsx
│   ├── NotesEmptyState.tsx
│   ├── NoteForm.tsx
│   ├── NoteDetail.tsx
│   └── index.ts
├── [id]/
│   └── page.tsx
├── new/
│   └── page.tsx
└── page.tsx
```

---

## 검증 체크리스트

### Phase 1 검증
- [ ] Epic Issue가 docs 레포에 생성됨
- [ ] Epic에 Problem Statement, Goals, User Scenarios 포함

### Phase 2 검증
- [ ] `specs/quicknote/spec.md` 생성됨
- [ ] `docs/design/user-flow.md` 생성됨 (Mermaid 다이어그램 포함)
- [ ] 목업 컴포넌트 생성됨

### Phase 3 검증
- [ ] `app/notes/` 디렉토리 구조 생성됨
- [ ] `_repositories/`, `_api-clients/`, `_hooks/`, `_components/` 존재
- [ ] `specs/quicknote/tasks.md` 생성됨
- [ ] `docs/test/test-cases.md` 생성됨

### Phase 4 검증
- [ ] Feature 브랜치 생성됨
- [ ] 모든 컴포넌트 구현됨
- [ ] 테스트 통과
- [ ] Quality Gate 통과 (lint, tsc, build)
- [ ] PR 리뷰 완료

### 최종 검증
- [ ] 노트 목록 페이지 정상 동작
- [ ] 노트 생성 정상 동작
- [ ] 노트 상세 보기 정상 동작
- [ ] 노트 삭제 정상 동작

---

## 파일 구조

```
demo/quicknote/
├── README.md           # 이 파일
├── setup/
│   ├── schema.sql      # Supabase 스키마
│   └── seed.sql        # 샘플 데이터 (3개 노트)
└── design-brief.md     # Epic 입력용 Design Brief
```

---

## 관련 문서

- [Greenfield Workflow Command](../../semo-system/semo-core/commands/SEMO-workflow/greenfield.md)
- [workflow-start Skill](../../semo-system/semo-skills/workflow-start/SKILL.md)
- [write-code Skill](../../semo-system/semo-skills/write-code/SKILL.md)
