# Routing Table Reference

## Intent Categories

### Development Workflow

| Intent | Keywords | Route |
|--------|----------|-------|
| Specification | spec, 명세, 요구사항, AC | `spec-master` |
| Domain Design | entity, CQRS, 도메인, repository | `domain-architect` |
| Implementation | 구현, 개발, 코드, implement | `implementation-master` |
| Verification | 검증, 테스트, verify, 품질 | `quality-master` |
| Advisory | 조언, 추천, 어떻게, best practice | `advisor` |

### Git Operations

| Intent | Keywords | Route |
|--------|----------|-------|
| Commit | 커밋, commit | `skill:git-workflow` |
| Push | 푸시, push | `skill:git-workflow` |
| PR | PR, pull request, 머지 | `skill:git-workflow` |
| Branch | 브랜치, branch | `skill:git-workflow` |

### Backend Specific

| Intent | Keywords | Route |
|--------|----------|-------|
| API Spec | OpenAPI, 스펙, endpoint | `skill:sync-openapi` |
| DB Schema | 스키마, migration, 테이블 | `skill:lookup-migration` |
| Scaffold | 도메인 생성, scaffold | `skill:scaffold-domain` |
| Reactive | reactive, block, coroutine | `skill:verify-reactive` |

## Priority Rules

1. **Explicit Skill Call**: `skill:` 접두사 → 해당 Skill 직접 호출
2. **Git Keywords**: 커밋/푸시 키워드 → `skill:git-workflow`
3. **SDD Keywords**: spec/plan/tasks → `spec-master`
4. **Implementation**: 구현 키워드 + SDD Gate 통과 → `implementation-master`
5. **Default**: 의도 불명확 → 사용자에게 명확화 요청
