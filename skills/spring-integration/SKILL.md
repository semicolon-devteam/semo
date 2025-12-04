---
name: spring-integration
description: Spring Backend API integration guide for Next.js. Use when (1) implementing Spring API client, (2) need ApiResponse/Error mapping, (3) require DTO type generation, (4) adding new domain API client.
tools: [Bash, Read, GitHub CLI]
---

# Spring Integration Skill

**Purpose**: Next.js 개발자가 Spring Backend(core-backend) API를 연동할 때 필요한 패턴과 가이드 제공

## Background

```text
core-interface (OpenAPI Spec) ← Single Source of Truth
├── Swagger UI: https://core-interface-ashen.vercel.app/
└── Release Assets: core.backend.spec.json

         ↓
┌────────┴────────┐
↓                 ↓
core-backend      cm-template (Next.js)
(Spring Boot)     └── lib/api-clients/
                      ├── interfaces/
                      ├── implementations/
                      │   ├── next-*.service.ts   (로컬)
                      │   └── spring-*.service.ts (프로덕션)
                      └── *.client.ts (팩토리)
```

## When to Use

- **Spring API Client 구현**: 새 도메인의 API Client 작성 시
- **ApiResponse 매핑**: Spring 응답 구조 → TypeScript 타입 변환
- **에러 핸들링**: Spring ErrorResponse 처리 패턴
- **DTO 타입 생성**: OpenAPI → TypeScript 자동 생성
- **v0.4.x CODE 단계**: implement 스킬에서 Spring 연동 필요 시

## Quick Start

### 1. API 스펙 확인

```bash
# Swagger UI에서 확인
open https://core-interface-ashen.vercel.app/

# 또는 OpenAPI spec 다운로드
gh api repos/semicolon-devteam/core-interface/releases/latest \
  --jq '.assets[] | select(.name == "core.backend.spec.json") | .browser_download_url'
```

### 2. DTO 타입 생성 (선택)

```bash
# openapi-typescript 설치 후
npm run generate:api-types
```

### 3. API Client 구현

```typescript
// 1. Interface 정의
// lib/api-clients/interfaces/posts.interface.ts
export interface IPostsService {
  getPostList(params: GetPostsParams): Promise<Post[]>;
  getPost(id: string): Promise<Post>;
  createPost(data: CreatePostRequest): Promise<Post>;
}

// 2. Spring 구현체
// lib/api-clients/implementations/spring-posts.service.ts
export class SpringPostsService implements IPostsService {
  private baseUrl = process.env.NEXT_PUBLIC_SPRING_API_URL;

  async getPostList(params: GetPostsParams): Promise<Post[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/posts?${new URLSearchParams(params)}`);
    return handleApiResponse<Post[]>(response);
  }
}

// 3. 팩토리 클라이언트
// lib/api-clients/posts.client.ts
export function createPostsClient(): IPostsService {
  const useSpringBoot = process.env.NEXT_PUBLIC_USE_SPRING_BOOT === "true";
  return useSpringBoot
    ? new SpringPostsService()
    : new NextPostsService();
}

export const postsClient = createPostsClient();
```

## 새 도메인 추가 체크리스트

1. [ ] core-interface에서 API 스펙 확인
2. [ ] `interfaces/{domain}.interface.ts` 생성
3. [ ] `implementations/spring-{domain}.service.ts` 생성
4. [ ] `implementations/next-{domain}.service.ts` 생성 (로컬 개발용)
5. [ ] `{domain}.client.ts` 팩토리 생성
6. [ ] 에러 핸들링 패턴 적용
7. [ ] 테스트 작성

## 환경 변수

```bash
# .env.local
NEXT_PUBLIC_USE_SPRING_BOOT=true          # Spring API 사용 여부
NEXT_PUBLIC_SPRING_API_URL=http://localhost:8080  # Spring 서버 URL
```

## Related Skills

- `fetch-api-spec`: OpenAPI 스펙 상세 조회
- `implement`: v0.4.x CODE 단계에서 호출
- `validate-architecture`: API Client 구조 검증

## References

- [API Client Pattern](references/api-client-pattern.md) - cm-template 패턴 상세
- [API Response Mapping](references/api-response-mapping.md) - Spring ApiResponse → TS
- [Error Handling](references/error-handling.md) - 에러 처리 패턴
- [DTO Generation](references/dto-generation.md) - OpenAPI → TypeScript 생성
- [GitHub Commands](references/github-commands.md) - 정보 조회 명령어
