# API Response Mapping

Spring Boot ApiResponse → TypeScript 타입 매핑 가이드

## Spring ApiResponse 구조

core-backend의 ApiResponse는 Sealed Class로 정의됨:

```kotlin
// core-backend의 ApiResponse (참고용)
sealed class ApiResponse<T> {
    data class Success<T>(val data: T) : ApiResponse<T>()

    data class PagedSuccess<T>(
        val data: List<T>,
        val pagination: Pagination
    ) : ApiResponse<T>()

    data class Error<T>(
        val error: ErrorDetail
    ) : ApiResponse<T>()
}

data class Pagination(
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int
)

data class ErrorDetail(
    val code: String,
    val message: String,
    val details: Map<String, Any>? = null
)
```

## TypeScript 타입 정의

```typescript
// models/api.types.ts

/**
 * Spring ApiResponse 기본 구조
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: Pagination;
}

/**
 * 페이지네이션 정보
 */
export interface Pagination {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * 에러 상세
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 페이징된 응답 타입
 */
export interface PagedResponse<T> {
  items: T[];
  pagination: Pagination;
}
```

## HTTP Status 매핑

| Method | 성공 Status | 응답 |
|--------|------------|------|
| GET | 200 OK | `{ success: true, data: T }` |
| POST | 201 Created | `{ success: true, data: T }` |
| PATCH/PUT | 200 OK | `{ success: true, data: T }` |
| DELETE | 204 No Content | (빈 응답) |

| 에러 Status | 의미 |
|------------|------|
| 400 | Bad Request (유효성 검증 실패) |
| 401 | Unauthorized (인증 필요) |
| 403 | Forbidden (권한 없음) |
| 404 | Not Found (리소스 없음) |
| 409 | Conflict (충돌) |
| 500 | Internal Server Error |

## 응답 처리 유틸리티

```typescript
// lib/api-clients/utils.ts

import { ApiError } from './errors';
import type { ApiResponse, PagedResponse, Pagination } from '@/models/api.types';

/**
 * 단일 응답 처리
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  // 네트워크/HTTP 에러 처리
  if (!response.ok) {
    await handleHttpError(response);
  }

  // 204 No Content (DELETE 성공 등)
  if (response.status === 204) {
    return undefined as T;
  }

  const json: ApiResponse<T> = await response.json();

  // API 레벨 에러 처리
  if (!json.success && json.error) {
    throw new ApiError(json.error.code, json.error.message, response.status);
  }

  return json.data as T;
}

/**
 * 페이징된 응답 처리
 */
export async function handlePagedResponse<T>(response: Response): Promise<PagedResponse<T>> {
  if (!response.ok) {
    await handleHttpError(response);
  }

  const json: ApiResponse<T[]> = await response.json();

  if (!json.success && json.error) {
    throw new ApiError(json.error.code, json.error.message, response.status);
  }

  return {
    items: json.data || [],
    pagination: json.pagination || {
      page: 0,
      size: 0,
      totalElements: 0,
      totalPages: 0,
    },
  };
}

/**
 * HTTP 에러 처리
 */
async function handleHttpError(response: Response): Promise<never> {
  let errorData: { error?: { code: string; message: string } } = {};

  try {
    errorData = await response.json();
  } catch {
    // JSON 파싱 실패 시 기본 에러
  }

  throw new ApiError(
    errorData.error?.code || `HTTP_${response.status}`,
    errorData.error?.message || response.statusText,
    response.status
  );
}
```

## 사용 예시

### 단일 리소스 조회

```typescript
// Spring 응답
{
  "success": true,
  "data": {
    "id": "post-123",
    "title": "Hello World",
    "content": "..."
  }
}

// TypeScript 처리
const post = await handleApiResponse<Post>(response);
// post: Post
```

### 페이징된 목록 조회

```typescript
// Spring 응답
{
  "success": true,
  "data": [
    { "id": "post-1", "title": "First" },
    { "id": "post-2", "title": "Second" }
  ],
  "pagination": {
    "page": 0,
    "size": 20,
    "totalElements": 100,
    "totalPages": 5
  }
}

// TypeScript 처리
const { items, pagination } = await handlePagedResponse<Post>(response);
// items: Post[]
// pagination: Pagination
```

### 에러 응답

```typescript
// Spring 응답 (404)
{
  "success": false,
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "Post not found with id: post-123"
  }
}

// TypeScript에서 catch
try {
  const post = await postsClient.getPost('post-123');
} catch (error) {
  if (error instanceof ApiError) {
    console.log(error.code);    // "POST_NOT_FOUND"
    console.log(error.message); // "Post not found with id: post-123"
    console.log(error.status);  // 404
  }
}
```

## 타입 가드

```typescript
// lib/api-clients/guards.ts

import type { ApiResponse } from '@/models/api.types';

/**
 * 성공 응답인지 확인
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * 에러 응답인지 확인
 */
export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: false; error: NonNullable<ApiResponse<T>['error']> } {
  return response.success === false && response.error !== undefined;
}

/**
 * 페이징된 응답인지 확인
 */
export function isPagedResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { pagination: NonNullable<ApiResponse<T>['pagination']> } {
  return response.pagination !== undefined;
}
```
