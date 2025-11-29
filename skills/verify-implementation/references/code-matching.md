# Code Matching

> 요구사항과 코드를 매칭하는 전략

## 검색 전략

### 1. 키워드 기반 검색

```bash
# 한글 키워드 → 영문 변환 후 검색
grep -rn "posts" src/
grep -rn "list" src/
grep -rn "pagination" src/
```

### 2. 파일 패턴 검색

```bash
# API 관련
find . -path "*/api/*" -name "*.ts"

# 서비스/레포지토리
find . -name "*Service*" -o -name "*Repository*"

# 훅
find . -path "*/_hooks/*" -name "*.ts"
```

### 3. DDD 4-Layer 기반 검색

| 요구사항 유형 | 검색 위치 |
|--------------|----------|
| API 엔드포인트 | `src/app/api/` |
| 데이터 조회 | `src/app/{domain}/_repositories/` |
| HTTP 클라이언트 | `src/app/{domain}/_api-clients/` |
| 상태 관리/훅 | `src/app/{domain}/_hooks/` |
| UI 컴포넌트 | `src/app/{domain}/_components/` |

## 매칭 판정 기준

### ✅ 구현됨 (Implemented)

다음 중 하나 이상 충족:

1. **함수/클래스 존재**: 해당 기능의 함수나 클래스가 정의됨
2. **API 엔드포인트 존재**: route.ts에 해당 HTTP 메서드 정의
3. **테스트 존재**: 해당 기능의 테스트 코드 존재
4. **타입 정의**: 관련 인터페이스/타입 정의

### ❌ 미구현 (Not Implemented)

다음 모두 해당:

1. 관련 키워드 검색 결과 없음
2. 예상 파일 경로에 코드 없음
3. TODO/FIXME 주석만 존재

### ⚠️ 부분 구현 (Partial)

다음 중 하나:

1. 함수 시그니처만 있고 구현 없음
2. TODO 주석이 있는 빈 함수
3. 테스트는 있으나 코드 없음

## 검색 결과 포맷

```markdown
## 관련 코드

### 구현됨: 게시글 목록 조회

| 파일 | 라인 | 내용 |
|------|------|------|
| `src/app/posts/_repositories/postRepository.ts` | 23-45 | `async getPostList()` |
| `src/app/api/posts/route.ts` | 12 | `export async function GET()` |

### 미구현: 검색 필터

검색된 코드:
- 없음

예상 위치:
- `src/app/posts/_repositories/postRepository.ts` - `searchPosts()` 함수
- `src/app/api/posts/route.ts` - query parameter 처리
```

## 도메인별 키워드 매핑

| 도메인 | 한글 키워드 | 영문 키워드 |
|--------|------------|------------|
| 게시글 | 게시글, 포스트, 글 | post, posts, article |
| 댓글 | 댓글, 코멘트 | comment, reply |
| 사용자 | 사용자, 유저, 회원 | user, member, profile |
| 인증 | 로그인, 인증, 로그아웃 | auth, login, logout, session |
| 검색 | 검색, 필터, 쿼리 | search, filter, query |
| 페이지 | 페이지, 페이징 | page, pagination, limit, offset |
