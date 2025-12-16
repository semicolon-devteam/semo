---
name: supabase-fallback
description: Spring Boot 미가동 시 Supabase GraphQL 직접 쿼리 지원
tools: [Read, Write, Bash]
---

> **시스템 메시지**: `[SEMO] Skill: supabase-fallback 호출 - Supabase 직접 쿼리`

# Supabase Fallback Skill

## Purpose

Spring Boot 백엔드가 미가동 상태일 때 Supabase를 직접 쿼리하여 개발을 계속할 수 있도록 지원합니다.

## Quick Start

트리거 키워드:
- "supabase 직접", "graphql", "fallback"
- "spring 없이", "백엔드 없이"

## 사용 시나리오

### 1. 로컬 개발 (Spring 미실행)

```typescript
// Spring Boot 백엔드가 실행되지 않을 때
// Supabase를 직접 쿼리

const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('metadata->>type', 'office');
```

### 2. 빠른 프로토타이핑

Repository에서 Supabase 직접 사용하여 API 엔드포인트 구현 전 빠른 검증

### 3. 통합 테스트

E2E 테스트에서 실제 데이터 사용, Supabase 테스트 프로젝트 활용

## 환경별 전환

```typescript
// lib/api-factory.ts
import { SpringOfficeService } from './spring-office.service';
import { SupabaseOfficeService } from './supabase-office.service';

export function createOfficeService() {
  const useSpring = process.env.NEXT_PUBLIC_USE_SPRING === 'true';

  if (useSpring) {
    return new SpringOfficeService();
  }

  return new SupabaseOfficeService();
}
```

## References

- [Query Patterns](references/query-patterns.md) - 조회 패턴
- [Mutation Patterns](references/mutation-patterns.md) - 생성/수정/삭제 패턴
- [Client Setup](references/client-setup.md) - 클라이언트 설정 및 API Route
