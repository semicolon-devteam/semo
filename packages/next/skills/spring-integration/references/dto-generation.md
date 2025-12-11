# DTO Generation

OpenAPI Spec → TypeScript 타입 자동 생성 가이드

## 개요

```text
core-interface (GitHub Release)
└── core.backend.spec.json (OpenAPI 3.1)
         ↓
    openapi-typescript
         ↓
    src/models/api.types.ts
```

## 단기: 수동 실행 스크립트

### 1. 의존성 설치

```bash
npm install -D openapi-typescript
```

### 2. 스크립트 생성

```bash
# scripts/generate-api-types.sh

#!/bin/bash
set -e

echo "🔍 Fetching latest core-interface release..."

# 최신 릴리즈 태그 조회
LATEST_RELEASE=$(gh api repos/semicolon-devteam/core-interface/releases/latest --jq '.tag_name')
echo "📦 Latest release: ${LATEST_RELEASE}"

# OpenAPI spec 다운로드 URL
SPEC_URL="https://github.com/semicolon-devteam/core-interface/releases/download/${LATEST_RELEASE}/core.backend.spec.json"

# 타입 생성
echo "⚙️ Generating TypeScript types..."
curl -sL "$SPEC_URL" | npx openapi-typescript /dev/stdin -o src/models/api.types.ts

echo "✅ API types generated from core-interface ${LATEST_RELEASE}"
echo "📄 Output: src/models/api.types.ts"
```

### 3. package.json에 스크립트 추가

```json
{
  "scripts": {
    "generate:api-types": "bash scripts/generate-api-types.sh"
  }
}
```

### 4. 실행

```bash
npm run generate:api-types
```

## 생성된 타입 사용

### 기본 사용

```typescript
// src/models/api.types.ts (자동 생성)
export interface paths {
  '/api/v1/posts': {
    get: operations['getPosts'];
    post: operations['createPost'];
  };
  '/api/v1/posts/{id}': {
    get: operations['getPost'];
    patch: operations['updatePost'];
    delete: operations['deletePost'];
  };
}

export interface components {
  schemas: {
    Post: {
      id: string;
      title: string;
      content: string;
      authorId: string;
      createdAt: string;
      updatedAt: string;
    };
    CreatePostRequest: {
      title: string;
      content: string;
      boardId: string;
    };
    // ...
  };
}
```

### 타입 추출 헬퍼

```typescript
// src/models/api-helpers.ts

import type { components, operations } from './api.types';

// Schema 타입 추출
export type Post = components['schemas']['Post'];
export type CreatePostRequest = components['schemas']['CreatePostRequest'];
export type UpdatePostRequest = components['schemas']['UpdatePostRequest'];

// Operation 타입 추출
export type GetPostsParams = operations['getPosts']['parameters']['query'];
export type GetPostsResponse = operations['getPosts']['responses']['200']['content']['application/json'];

// 페이지네이션
export type Pagination = components['schemas']['Pagination'];

// 에러
export type ApiError = components['schemas']['ErrorResponse'];
```

### API Client에서 사용

```typescript
// lib/api-clients/implementations/spring-posts.service.ts

import type { Post, CreatePostRequest, GetPostsParams } from '@/models/api-helpers';

export class SpringPostsService implements IPostsService {
  async getPostList(params?: GetPostsParams): Promise<Post[]> {
    // 타입 안전한 구현
  }

  async createPost(data: CreatePostRequest): Promise<Post> {
    // 타입 안전한 구현
  }
}
```

## 중기: CI 자동화

core-interface 릴리즈 시 cm-template에 자동 PR 생성

### GitHub Actions Workflow

```yaml
# core-interface/.github/workflows/sync-types-to-cm-template.yml

name: Sync Types to cm-template

on:
  release:
    types: [published]

jobs:
  sync-types:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout cm-template
        uses: actions/checkout@v4
        with:
          repository: semicolon-devteam/cm-template
          token: ${{ secrets.GH_PAT }}
          ref: dev

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Download OpenAPI spec
        run: |
          curl -sL "${{ github.event.release.assets[0].browser_download_url }}" \
            -o /tmp/core.backend.spec.json

      - name: Generate TypeScript types
        run: |
          npx openapi-typescript /tmp/core.backend.spec.json \
            -o src/models/api.types.ts

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          token: ${{ secrets.GH_PAT }}
          commit-message: "chore: sync API types from core-interface ${{ github.event.release.tag_name }}"
          title: "chore: sync API types from core-interface ${{ github.event.release.tag_name }}"
          body: |
            ## 자동 생성된 PR

            core-interface ${{ github.event.release.tag_name }} 릴리즈에서 API 타입이 업데이트되었습니다.

            ### 변경 내용
            - `src/models/api.types.ts` 업데이트

            ### 체크리스트
            - [ ] 타입 변경으로 인한 빌드 에러 확인
            - [ ] Breaking change 여부 확인

            ---
            🤖 이 PR은 자동으로 생성되었습니다.
          branch: chore/sync-api-types-${{ github.event.release.tag_name }}
          base: dev
          labels: |
            automated
            dependencies
```

### 필요한 설정

1. **GitHub PAT (Personal Access Token)**
   - `semicolon-devteam/cm-template` 레포에 대한 쓰기 권한 필요
   - Repository secrets에 `GH_PAT`로 등록

2. **Branch Protection**
   - 자동 생성 PR도 리뷰 필요 (권장)

## 특정 버전 타입 생성

```bash
# 특정 버전 지정
RELEASE_TAG="v2025.12.2"
SPEC_URL="https://github.com/semicolon-devteam/core-interface/releases/download/${RELEASE_TAG}/core.backend.spec.json"

curl -sL "$SPEC_URL" | npx openapi-typescript /dev/stdin -o src/models/api.types.ts
```

## openapi-typescript 옵션

```bash
# 자주 사용하는 옵션
npx openapi-typescript spec.json \
  -o src/models/api.types.ts \
  --export-type          # type 대신 interface 생성
  --path-params-as-types # path params를 타입으로
  --alphabetize          # 알파벳 순 정렬
```

## 트러블슈팅

### 타입 생성 실패 시

```bash
# 1. 스펙 파일 직접 다운로드 확인
curl -sL "https://github.com/semicolon-devteam/core-interface/releases/latest/download/core.backend.spec.json" \
  -o /tmp/spec.json

# 2. 스펙 유효성 검증
npx @apidevtools/swagger-cli validate /tmp/spec.json

# 3. 수동 생성
npx openapi-typescript /tmp/spec.json -o src/models/api.types.ts
```

### 기존 타입과 충돌 시

```typescript
// 자동 생성 타입과 수동 타입 분리
// src/models/api.types.ts      <- 자동 생성 (수정 금지)
// src/models/api-helpers.ts    <- 커스텀 타입 추출
// src/models/custom.types.ts   <- 프로젝트 전용 타입
```

## Supabase gentype과의 관계

| 도구 | 용도 | 출처 |
|------|------|------|
| `supabase gen types` | DB 스키마 타입 | Supabase (core-supabase) |
| `openapi-typescript` | API 계약 타입 | OpenAPI (core-interface) |

```
┌─────────────────────────────────────────────────────────┐
│ src/models/                                              │
├─────────────────────────────────────────────────────────┤
│ database.types.ts  ← supabase gen types (DB 스키마)     │
│ api.types.ts       ← openapi-typescript (API 계약)      │
│ api-helpers.ts     ← 커스텀 타입 추출                   │
└─────────────────────────────────────────────────────────┘
```

**마이그레이션 진행 상황에 따라:**
- Supabase 직접 호출 → `database.types.ts` 사용
- Spring API 호출 → `api.types.ts` 사용
