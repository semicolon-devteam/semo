# SEMO-MVP

> 세미콜론 생태계 기반 그린필드 MVP 개발 패키지

## Overview

SEMO-MVP는 Next.js + Antigravity를 활용한 MVP 프로젝트 개발을 위한 SEMO 패키지입니다.
세미콜론 커뮤니티 솔루션의 컨텍스트를 기반으로 빠른 MVP 개발과 추후 원활한 통합을 지원합니다.

## Key Features

- **세미콜론 생태계 연동**: core-interface 타입, Supabase GraphQL, metadata 확장
- **Antigravity 통합**: UI 목업, 브라우저 테스팅
- **DDD 4-layer 아키텍처**: 확장 가능한 도메인 구조
- **Phase-gated 개발**: 간소화된 ADD 워크플로우

## Workflow

```
[semo-po] Epic/Task 생성
     ↓
[semo-mvp] Task Card 확인 → 구현 시작
     ↓
[semo-mvp] skill:verify-integration
     ↓
Community Solution Merge
```

## Schema Extension Strategy

| 우선순위 | 전략 | 조건 |
|---------|------|------|
| 1순위 | metadata JSONB 확장 | 기존 테이블에 데이터 추가 시 |
| 2순위 | 컬럼 추가 | metadata로 불가능하거나 쿼리 성능 필요 시 |
| 3순위 | 신규 테이블 생성 | 완전히 새로운 도메인/엔티티 필요 시 |

## Quick Start

```bash
# 온보딩 시작
/SEMO:onboarding

# 환경 검증
/SEMO:health

# 도메인 구조 생성
/SEMO:scaffold {domain-name}

# 구현 시작
/SEMO:implement
```

## MCP Servers Required

- Context7 (문서 검색)
- Sequential-thinking (구조화된 추론)
- TestSprite (테스트 자동화)
- Supabase MCP (프로젝트 연동)
- GitHub MCP (Organization/Repository 연동)

## References

- [SEMO Core Principles](../semo-core/PRINCIPLES.md)
- [core-interface](https://github.com/semicolon-devteam/core-interface)
- [core-supabase](https://github.com/semicolon-devteam/core-supabase)
