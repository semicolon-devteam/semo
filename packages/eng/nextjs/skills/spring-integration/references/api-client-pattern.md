# API Client Pattern

cm-template의 Spring API Client 구현 패턴 가이드

## 아키텍처 개요

```text
┌─────────────────────────────────────────────────────────────┐
│                    lib/api-clients/                          │
├─────────────────────────────────────────────────────────────┤
│  interfaces/                                                 │
│  └── {domain}.interface.ts      # 서비스 인터페이스 정의      │
│                                                              │
│  implementations/                                            │
│  ├── next-{domain}.service.ts   # 로컬 개발용 (Next.js API)  │
│  └── spring-{domain}.service.ts # 프로덕션용 (Spring Boot)   │
│                                                              │
│  {domain}.client.ts             # 팩토리 + 싱글톤 export     │
└─────────────────────────────────────────────────────────────┘
```

## 패턴 상세

### 1. Interface 정의

```typescript
// lib/api-clients/interfaces/posts.interface.ts

import type { Post, CreatePostRequest, UpdatePostRequest, GetPostsParams } from '@/models/api.types';

export interface IPostsService {
  /**
   * 게시글 목록 조회
   */
  getPostList(params?: GetPostsParams): Promise<Post[]>;

  /**
   * 게시글 상세 조회
   */
  getPost(id: string): Promise<Post>;

  /**
   * 게시글 생성
   */
  createPost(data: CreatePostRequest): Promise<Post>;

  /**
   * 게시글 수정
   */
  updatePost(id: string, data: UpdatePostRequest): Promise<Post>;

  /**
   * 게시글 삭제
   */
  deletePost(id: string): Promise<void>;
}
```

### 2. Spring 구현체

```typescript
// lib/api-clients/implementations/spring-posts.service.ts

import type { IPostsService } from '../interfaces/posts.interface';
import type { Post, CreatePostRequest, UpdatePostRequest, GetPostsParams } from '@/models/api.types';
import { handleApiResponse, buildQueryString } from '@/lib/api-clients/utils';

export class SpringPostsService implements IPostsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8080';
  }

  async getPostList(params?: GetPostsParams): Promise<Post[]> {
    const query = params ? `?${buildQueryString(params)}` : '';
    const response = await fetch(`${this.baseUrl}/api/v1/posts${query}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return handleApiResponse<Post[]>(response);
  }

  async getPost(id: string): Promise<Post> {
    const response = await fetch(`${this.baseUrl}/api/v1/posts/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return handleApiResponse<Post>(response);
  }

  async createPost(data: CreatePostRequest): Promise<Post> {
    const response = await fetch(`${this.baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return handleApiResponse<Post>(response);
  }

  async updatePost(id: string, data: UpdatePostRequest): Promise<Post> {
    const response = await fetch(`${this.baseUrl}/api/v1/posts/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return handleApiResponse<Post>(response);
  }

  async deletePost(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/posts/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await handleApiResponse<void>(response);
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      // 인증 토큰은 미들웨어 또는 인터셉터에서 추가
    };
  }
}
```

### 3. Next.js 로컬 구현체

```typescript
// lib/api-clients/implementations/next-posts.service.ts

import type { IPostsService } from '../interfaces/posts.interface';
import type { Post, CreatePostRequest, UpdatePostRequest, GetPostsParams } from '@/models/api.types';

export class NextPostsService implements IPostsService {
  async getPostList(params?: GetPostsParams): Promise<Post[]> {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    const response = await fetch(`/api/posts${query}`);
    return response.json();
  }

  async getPost(id: string): Promise<Post> {
    const response = await fetch(`/api/posts/${id}`);
    return response.json();
  }

  async createPost(data: CreatePostRequest): Promise<Post> {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updatePost(id: string, data: UpdatePostRequest): Promise<Post> {
    const response = await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deletePost(id: string): Promise<void> {
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
  }
}
```

### 4. 팩토리 클라이언트

```typescript
// lib/api-clients/posts.client.ts

import type { IPostsService } from './interfaces/posts.interface';
import { SpringPostsService } from './implementations/spring-posts.service';
import { NextPostsService } from './implementations/next-posts.service';

/**
 * PostsService 인스턴스 생성
 * 환경변수에 따라 Spring 또는 Next.js 구현체 반환
 */
export function createPostsClient(): IPostsService {
  const useSpringBoot = process.env.NEXT_PUBLIC_USE_SPRING_BOOT === 'true';

  if (useSpringBoot) {
    return new SpringPostsService();
  }
  return new NextPostsService();
}

// 싱글톤 인스턴스 export
export const postsClient = createPostsClient();
```

## 유틸리티 함수

```typescript
// lib/api-clients/utils.ts

import { ApiError } from './errors';
import type { ApiResponse } from '@/models/api.types';

/**
 * Spring ApiResponse 처리
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error?.code || 'UNKNOWN_ERROR',
      errorData.error?.message || response.statusText,
      response.status
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const json: ApiResponse<T> = await response.json();

  if (!json.success && json.error) {
    throw new ApiError(json.error.code, json.error.message);
  }

  return json.data as T;
}

/**
 * Query String 빌더
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}
```

## 사용 예시

### React Query와 함께 사용

```typescript
// hooks/posts/usePostList.ts

import { useQuery } from '@tanstack/react-query';
import { postsClient } from '@/lib/api-clients/posts.client';
import type { GetPostsParams } from '@/models/api.types';

export function usePostList(params?: GetPostsParams) {
  return useQuery({
    queryKey: ['posts', params],
    queryFn: () => postsClient.getPostList(params),
  });
}
```

### Server Component에서 사용

```typescript
// app/posts/page.tsx

import { postsClient } from '@/lib/api-clients/posts.client';

export default async function PostsPage() {
  const posts = await postsClient.getPostList();

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

## 파일 네이밍 규칙

| 파일 | 네이밍 패턴 | 예시 |
|------|------------|------|
| Interface | `{domain}.interface.ts` | `posts.interface.ts` |
| Spring 구현체 | `spring-{domain}.service.ts` | `spring-posts.service.ts` |
| Next 구현체 | `next-{domain}.service.ts` | `next-posts.service.ts` |
| 팩토리 | `{domain}.client.ts` | `posts.client.ts` |
