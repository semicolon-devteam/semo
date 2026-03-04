---
name: spec
description: |
  스펙 문서 작성 및 구현 계획 수립. Use when:
  (1) 요구사항 스펙 작성, (2) API 스펙 정리, (3) 구현 계획 수립.
tools: [Read, Write]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: spec 호출` 시스템 메시지를 첫 줄에 출력하세요.

# spec Skill

> 스펙 문서 작성 및 구현 계획 수립

## Actions

| Action | 설명 | 출력 |
|--------|------|------|
| **generate** | 요구사항 → 스펙 문서 | Markdown 스펙 |
| **plan** | 스펙 → 구현 계획 | 단계별 체크리스트 |

---

## Action: generate (스펙 작성)

### 스펙 템플릿

```markdown
# {Feature Name} 스펙

## 📋 Overview
- **목적**: {목적}
- **범위**: {범위}
- **우선순위**: P{0-4}

## 🎯 Requirements

### Functional
1. 사용자는 {행동}할 수 있다
2. 시스템은 {동작}해야 한다

### Non-functional
- 성능: {기준}
- 보안: {요구사항}
- 확장성: {고려사항}

## 📐 API Spec

### Endpoint
`POST /api/users`

### Request
```json
{
  "email": "string",
  "name": "string"
}
```

### Response
```json
{
  "id": "uuid",
  "email": "string"
}
```

## ✅ Acceptance Criteria
- [ ] AC 1
- [ ] AC 2
```

---

## Action: plan (구현 계획)

### 구현 계획 템플릿

```markdown
# {Feature} 구현 계획

## Phase 1: Domain Layer
- [ ] Entity 정의
- [ ] Repository Interface
- [ ] Domain Service

## Phase 2: Application Layer
- [ ] Use Case 구현
- [ ] DTO 정의

## Phase 3: Infrastructure Layer
- [ ] Repository 구현
- [ ] DB 마이그레이션

## Phase 4: Presentation Layer
- [ ] API Handler
- [ ] Validation

## Phase 5: Test
- [ ] Unit Test
- [ ] Integration Test
```

---

## 출력

```markdown
[SEMO] Skill: spec 완료

✅ 스펙 문서 생성 완료

**파일**: docs/spec/user-management.md
**AC 개수**: 5
```

---

## Related

- `epic` - Epic 생성
- `task` - Task 생성
- `implement` - 구현 시작
