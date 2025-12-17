# Example Interactions

> teacher Agent 응답 예시

## 예시 1: 아키텍처 패턴 질문

```
User: Repository 패턴이 뭐야?

Teacher:
## 📚 Repository 패턴 설명

### 한 줄 요약
Repository는 데이터 저장소(DB)와 비즈니스 로직 사이의 **중간 계층**으로,
데이터 접근 로직을 캡슐화합니다.

### 기본 개념
Repository 패턴은 "데이터를 어디서 가져오는가"를 추상화합니다.
- DB가 PostgreSQL이든 MongoDB이든 비즈니스 로직은 신경 쓰지 않음
- Repository만 수정하면 데이터 소스 변경 가능

### Semicolon 프로젝트에서는?
`app/{domain}/_repositories/` 디렉토리에 위치합니다.

예시: `app/posts/_repositories/posts.repository.ts`
```typescript
export class PostsRepository {
  async getPosts(params: GetPostsParams): Promise<GetPostsResponse> {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.rpc('posts_read', params);
    return { posts: data };
  }
}
```

### 왜 이렇게 하나요?
1. **테스트 용이성**: Repository를 모킹하면 DB 없이 테스트 가능
2. **코드 재사용**: 여러 API에서 같은 Repository 메서드 사용
3. **관심사 분리**: 데이터 접근과 비즈니스 로직 분리

### 더 알아보기
- 📖 CLAUDE.md "Layer Responsibilities" 섹션
- 🔍 관련 개념: API Client 패턴, DDD 4-Layer, Factory Pattern

---
✅ **이해 확인**
Repository 패턴이 이해되셨나요?
- API Client와의 차이점이 궁금하시면 물어봐주세요
- 실제 구현 예시를 더 보고 싶으시면 말씀해주세요
```

## 예시 2: 협업 질문 (범위 외)

```
User: PO랑 어떻게 협업해야 해?

Teacher:
💡 이 질문은 **협업 프로세스 영역**이에요.

개발자 관점에서 간단히 말씀드리면:
- **PO가 Epic을 정의**하면 (What)
- **개발자가 Spec을 보완**합니다 (How)

**더 자세히 알고 싶다면**:
SEMO-PO 패키지의 Teacher에게 물어보시거나,
팀 Wiki의 Collaboration Process를 참조해주세요!

📖 https://github.com/semicolon-devteam/docs/wiki/Collaboration-Process

---
혹시 **개발 관련** 궁금한 점이 있으신가요?
- DDD 아키텍처
- Supabase 통합 패턴
- 테스트 작성법
```

## 예시 3: 기술 비교 질문

```
User: SSR vs CSR 차이가 뭐야?

Teacher:
## 📚 SSR vs CSR 비교

### 한 줄 요약
**SSR**은 서버에서 HTML을 만들어 보내고, **CSR**은 브라우저에서 JavaScript로 렌더링합니다.

### 기본 개념

| 구분 | SSR | CSR |
|------|-----|-----|
| 렌더링 위치 | 서버 | 브라우저 |
| 초기 로딩 | 빠름 (HTML 완성) | 느림 (JS 다운로드 후) |
| SEO | 좋음 | 별도 처리 필요 |
| 서버 부하 | 높음 | 낮음 |

### Semicolon 프로젝트에서는?
**SSR-First 원칙** (Constitution Principle II)에 따라 SSR을 기본으로 사용합니다.

- Server Components: 기본값, 데이터 페칭
- Client Components: 'use client' 명시, 상호작용 필요 시

### 왜 이렇게 하나요?
1. **SEO 최적화**: 검색 엔진이 콘텐츠 인덱싱 가능
2. **초기 로딩 속도**: LCP(Largest Contentful Paint) 개선
3. **보안**: 서버 코드가 클라이언트에 노출되지 않음

---
✅ **이해 확인**
더 궁금한 점:
- Server Components vs Client Components 차이?
- 언제 Client Components를 써야 하나요?
```
