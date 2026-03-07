# proj-office-land 스프링 마이그레이션 현황

**분석일**: 2026-02-24  
**레포지토리**: semicolon-devteam/proj-office-land

## 개요

Supabase RPC/직접 쿼리 방식에서 Spring Boot API로 마이그레이션 진행 중. **1-Hop Rule** (Browser → Spring Boot 직접 통신) 아키텍처 원칙에 따라 Next.js API Route를 거치지 않고 클라이언트에서 Spring Boot로 직접 호출.

**현재 진행 상황** (2026-02-24 기준):
- ✅ **게시글 목록 조회** (#264) - MERGED 2026-02-07
- ✅ **게시글 상세 조회** (#284) - MERGED 2026-02-24 08:50
- ⏳ **게시글 생성** (#189) - 대기 중 (2개 파일)
- ⏳ **리액션 생성** (#189) - 대기 중 (1개 파일)
- 📋 **댓글 API** (#163) - Epic 스펙 미완성

## 마이그레이션 전략

- **아키텍처 원칙**: Browser → Spring Boot 직접 통신 (Next.js 미들웨어 금지)
- **환경변수**: `NEXT_PUBLIC_USE_SPRING_BOOT=true` 시 Spring API 사용
- **인터페이스 준수**: 기존 `IPostsService` 인터페이스 유지하여 하위 호환성 보장

## 완료된 마이그레이션 (MERGED)

### 1. 게시글 목록 조회 (#264 - MERGED 2026-02-07)
- **변경 사항**:
  - `usePostsPage`를 Next.js API에서 Spring Boot API(`useGetPostsQuery`) 기반으로 리팩토링
  - board_id=80(고객센터) 게시판에서 `pinNotice=top` 파라미터로 공지글 서버사이드 상단 고정
  - 관리자 게시글 작성 시 '공지로 등록' 토글(Switch) UI 추가 및 `is_notice` API 처리
  - 공개 데이터 API(`boards`, `banners`, `office-search`)의 JWT expired 오류 수정
  - 불필요한 코드 제거 (`usePostsQuery`, `usePosts.basic.test.tsx`, `posts/README.md`)
- **PR**: #264 (https://github.com/semicolon-devteam/proj-office-land/pull/264)

### 2. 게시글 상세 조회 (#284 - MERGED 2026-02-24 08:50)
- **변경 사항**:
  - **NextPostsService 완전 제거** - 2-Hop 방식(Browser → Next.js API Route → Supabase) 제거
  - **postsV1Api 직접 호출** - `__generated__/PostsV1/PostsV1.api.ts` 기반 1-Hop 전환
  - **Spring Boot 응답 래퍼 언래핑** - 자동생성 타입과 실제 응답 구조 불일치 해소
  - **PostDetailResponseType 적용** - camelCase 필드명 통일 (snake_case 제거)
- **변경 파일** (10개 수정, 2개 삭제):
  - `spring-posts.service.ts`: `postsV1Api.getPost()` 직접 호출, 응답 언래핑
  - `posts.client.ts`: 항상 SpringPostsService 사용, 플래그 제거
  - `posts.interface.ts`: `getPostById` 반환 타입 → `PostDetailResponseType`
  - `posts.query.ts`: `useGetPostByIdQuery` 언래핑 처리, 타입 정확도 개선
  - `PostDetailPage.tsx`: camelCase 필드 적용, 미사용 코드 제거
  - `PostCreateUpdateForm.tsx`: prop 타입 → `PostDetailResponseType`
  - `PostWritePageClient.tsx`: `useGetPostByIdQuery` 직접 사용
  - `usePostCreateUpdateForm.ts`: `PostDetailResponseType` 적용
  - `OfficeDetailPopup.tsx`: variables 키 수정 (postId → id)
  - `next-posts.service.ts`: **삭제**
  - `usePostDetail.ts` (hook): **삭제**
- **커밋**: 85721289015faf9a47c92a6b2f2e2d5a16de0c64
- **PR**: #284 (https://github.com/semicolon-devteam/proj-office-land/pull/284)
- **Co-Author**: Claude Sonnet 4.6

## 진행 중 마이그레이션 (OPEN)

### 1. Supabase RPC → Spring API 마이그레이션 (#189 - OPEN)
**상위 Epic 이슈**

**담당자**: Brightbong92 (jang hyun bong)

**마이그레이션 대상**:
| 파일 | RPC 함수 | 라인 | 상태 |
|------|----------|------|------|
| `src/repositories/posts.repository.ts` | `posts_read` | L262 | ✅ 완료 (#284, 2026-02-24) |
| `src/app/api/posts/route.ts` | `posts_create` | L156 | ⏳ 대기 중 |
| `src/app/api/offices/route.ts` | `posts_create` | L218 | ⏳ 대기 중 |
| `src/app/api/comments/[id]/reactions/route.ts` | `reactions_create` | L67 | ⏳ 대기 중 |

**작업 내용**:
#### 1. Spring API 엔드포인트 확인/구현
- [x] `posts_read` → Spring GET `/api/v1/posts/{id}` (완료)
- [ ] `posts_create` → Spring POST `/api/v1/posts` 확인
- [ ] `reactions_create` → Spring POST `/api/v1/reactions` 확인

#### 2. Next.js API Client 마이그레이션
- [x] `posts.repository.ts` - Spring API 호출로 변경 (완료)
- [ ] `src/app/api/posts/route.ts` - Spring API 프록시 또는 직접 호출
- [ ] `src/app/api/offices/route.ts` - Spring API 프록시 또는 직접 호출
- [ ] `src/app/api/comments/[id]/reactions/route.ts` - Spring API 호출로 변경

#### 3. 테스트 및 검증
- [ ] 기존 기능 동작 확인
- [ ] 에러 핸들링 검증
- [ ] 타입 안정성 확인

### 2. Post 목록/상세조회 Spring API 마이그레이션 (#192 - OPEN → 클로즈 필요)
**담당자**: Brightbong92 (jang hyun bong)  
**상위 이슈**: #189

**⚠️ 이슈 상태**: 이미 완료되었으나 이슈가 열려있음. **클로즈 필요**

**현재 상태**:
| 기능 | 현재 구현 | 위치 | 상태 |
|------|-----------|------|------|
| 목록 조회 | Supabase 직접 쿼리 | `src/repositories/posts.repository.ts:42` | ✅ 완료 (#264, 2026-02-07) |
| 상세 조회 | Supabase RPC (`posts_read`) | `src/repositories/posts.repository.ts:261` | ✅ 완료 (#284, 2026-02-24) |

**작업 내용**: ✅ **모두 완료됨**
- [x] Phase 1: Spring API 확인
- [x] Phase 2: API Client 구현
- [x] Phase 3: Repository 마이그레이션
- [x] Phase 4: 테스트 및 검증

**관련 파일**:
- `src/repositories/posts.repository.ts`
- `src/lib/api-clients/posts.client.ts`
- `src/lib/api-clients/implementations/spring-posts.service.ts`
- `src/lib/api-clients/interfaces/posts.interface.ts`

### 3. 댓글 API 스프링 마이그레이션 (#163 - OPEN)
**Epic 이슈** - 스펙 미완성 상태

**담당자**: Brightbong92 (jang hyun bong)

**상태**: Epic 템플릿만 작성된 상태, 구체적인 사용자 스토리 및 완료 조건 미작성

**관련 레포지토리**: 미선택 상태

## 다음 단계 우선순위

1. **✅ #192 이슈 클로즈** 
   - 목록 조회(#264) 및 상세 조회(#284) 모두 완료되어 이슈를 닫아야 함
   - 담당자: Brightbong92

2. **🔄 #189 나머지 작업 진행**
   - `posts_create` API 마이그레이션 (2개 파일: `api/posts/route.ts`, `api/offices/route.ts`)
   - `reactions_create` API 마이그레이션 (1개 파일: `api/comments/[id]/reactions/route.ts`)
   - Spring Boot API 엔드포인트 확인 필요: POST `/api/v1/posts`, POST `/api/v1/reactions`
   - 담당자: Brightbong92

3. **📋 #163 Epic 구체화**
   - 댓글 API 상세 스펙 작성 필요
   - 사용자 스토리, 완료 조건, 관련 파일 정의 필요
   - 담당자: Brightbong92

## 참고 자료

- **아키텍처 원칙**: [Development Philosophy](https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy)
- **1-Hop Rule**: Browser → Spring Boot 직접 통신, Next.js 미들웨어 금지

## 기술 스택

- **Frontend**: Next.js (App Router)
- **Backend**: Spring Boot
- **Database**: Supabase (PostgreSQL)
- **API Client**: Swagger 자동 생성 타입 (`__generated__/PostsV1/PostsV1.api.ts`)
