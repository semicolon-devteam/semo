# Workflow Phases Reference

## Phase 1: Specify (spec.md)

### Purpose
- WHAT: 무엇을 만드는가
- WHY: 왜 필요한가

### Content Structure

```markdown
# Feature: {feature_name}

## Overview
{기능 설명}

## API Endpoints
- `POST /api/v1/posts` - 게시글 생성
- `GET /api/v1/posts/{id}` - 게시글 조회

## Acceptance Criteria
- [ ] AC1: ...
- [ ] AC2: ...

## Dependencies
- core-interface: OpenAPI spec
- core-supabase: posts 테이블

## Out of Scope
- ...
```

### Backend Checklist

- [ ] core-interface OpenAPI 스펙 확인
- [ ] DB 테이블 구조 확인
- [ ] 인증/인가 요구사항 정의
- [ ] 에러 응답 정의

---

## Phase 2: Plan (plan.md)

### Purpose
- HOW: 어떻게 구현할 것인가
- Technical Approach

### Content Structure

```markdown
# Plan: {feature_name}

## Technical Approach

### Architecture
- CQRS 패턴 적용
- CommandService / QueryService 분리

### Layers
| Layer | Components |
|-------|------------|
| Entity | Post.kt |
| Repository | PostRepository.kt |
| Service | PostCommandService, PostQueryService |
| Controller | PostController.kt |

### External Dependencies
- core-interface: POST /api/v1/posts
- core-supabase: posts 테이블

## Risk Assessment
- ...
```

---

## Phase 3: Tasks (tasks.md)

### Purpose
- WORK ITEMS: 실행 가능한 작업 단위

### Content Structure

```markdown
# Tasks: {feature_name}

## v0.0.x CONFIG
- [ ] build.gradle.kts 의존성 확인

## v0.1.x PROJECT
- [ ] scaffold-domain으로 구조 생성

## v0.2.x TESTS
- [ ] PostRepositoryTest 작성
- [ ] PostServiceTest 작성

## v0.3.x DATA
- [ ] Post entity 작성
- [ ] PostRepository 구현
- [ ] DTO 정의

## v0.4.x CODE
- [ ] PostCommandService 구현
- [ ] PostQueryService 구현
- [ ] PostController 구현
```
