# Multi-Agent Orchestration - Data Layer Implementation Plan

## Overview

에이전트 정의, 스킬 정의, 에이전트 간 통신, 워크플로우 관리를 위한 DB 스키마 구현.
Supabase PostgreSQL을 사용하며, RLS(Row Level Security)를 통해 Office 간 데이터 격리 보장.

## Technical Approach

### 1. 마이그레이션 파일 분리 전략

| 마이그레이션 | 내용 | 의존성 |
|-------------|------|--------|
| `001_agent_skill_definitions.sql` | 에이전트/스킬 정의 테이블 | `offices` 테이블 |
| `002_workflow_communication.sql` | 통신/워크플로우 테이블 | 001 완료 후 |

### 2. 테이블 설계 원칙

- **DB가 Source of Truth**: 에이전트 정의의 전체 .md 내용을 `definition_content` 컬럼에 저장
- **Office 격리**: 모든 테이블에 `office_id` FK 포함
- **Soft Delete 미사용**: 간단한 CASCADE DELETE 사용

### 3. Frontmatter 파싱

에이전트/스킬 정의에서 YAML frontmatter를 파싱하여 `frontmatter` JSONB 컬럼에 저장:
```yaml
---
name: po
description: Product Owner Agent
tools: [Read, Write, Edit, Bash, skill]
model: sonnet
---
```
→ `{"name": "po", "description": "Product Owner Agent", "tools": [...], "model": "sonnet"}`

## Dependencies

### 외부 의존성
- Supabase CLI (`supabase migration up`)
- 기존 `offices` 테이블 (FK 참조)

### 선행 작업
- 없음 (이 Epic이 첫 번째)

## Risk Assessment

### 높음
- **마이그레이션 충돌**: 기존 마이그레이션 파일과 번호 충돌 가능
  - 대안: 타임스탬프 기반 마이그레이션 이름 사용

### 낮음
- **RLS 복잡도**: 복잡한 정책은 성능 저하 가능
  - 대안: 간단한 `office_id` 기반 정책만 사용

## File Structure

```
supabase/
├── migrations/
│   ├── 001_agent_skill_definitions.sql
│   └── 002_workflow_communication.sql
└── seed/
    └── default_templates.sql
```
