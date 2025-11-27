# Help Content

> SAX-Next 도움말 상세 내용

## 패키지 개요

SAX-Next는 Next.js 개발자를 위한 SAX 패키지입니다.

### 대상 사용자

- **Next.js 개발자**: 프론트엔드/풀스택 개발
- **Semicolon 팀원**: DDD 아키텍처 기반 개발

### 주요 기능

- ADD (Agent-Driven Development) 워크플로우
- DDD 4-Layer 아키텍처 스캐폴딩
- Supabase 연동 패턴
- TDD 기반 구현

## ADD 워크플로우 상세

### Phase 1-3: Specification

```
skill: spec
├── spec.md    # 요구사항 정의
├── plan.md    # 기술 설계
└── tasks.md   # 작업 분해
```

**트리거**: "Spec 작성해줘", "명세 작성해줘"

### Phase 4: Implementation

```
skill: implement
├── v0.0.x CONFIG    # package.json, tsconfig
├── v0.1.x PROJECT   # DDD 디렉토리 구조
├── v0.2.x TESTS     # TDD - 테스트 먼저
├── v0.3.x DATA      # 타입, 모델, 스키마
└── v0.4.x CODE      # 4-Layer 구현
```

**트리거**: "구현해줘", "개발해줘"

### Phase 5: Verification

```
skill: verify
├── TypeScript 타입 체크
├── ESLint 린트 체크
├── Jest 테스트 실행
└── Next.js 빌드 검증
```

**트리거**: "검증해줘", "체크해줘"

## DDD 4-Layer 상세

### Repository Layer (`_repositories/`)

- Server-side Supabase 연동
- RPC 함수 호출
- `createServerSupabaseClient` 사용

### API Client Layer (`_api-clients/`)

- Browser-side HTTP 통신
- Factory Pattern
- Singleton export

### Hooks Layer (`_hooks/`)

- React Query 통합
- useQuery/useMutation
- 캐시 관리

### Components Layer (`_components/`)

- 도메인별 UI 컴포넌트
- Header, Filter, List, EmptyState, LoadingState, ErrorState

## 자주 묻는 질문

### Q: 새 기능은 어떻게 시작하나요?

1. "Spec 작성해줘"로 명세 작성
2. "구현해줘"로 구현 시작
3. "검증해줘"로 품질 확인

### Q: Supabase 연동은 어떻게 하나요?

implement Skill이 자동으로 `fetch-supabase-example`을 호출하여 core-supabase 패턴을 참조합니다.

### Q: 환경이 제대로 설정됐는지 확인하려면?

"환경 확인해줘" 또는 `/SAX:health-check`로 검증합니다.

### Q: SAX 버전은 어떻게 업데이트하나요?

"SAX 업데이트해줘"로 최신 버전으로 업데이트합니다.
