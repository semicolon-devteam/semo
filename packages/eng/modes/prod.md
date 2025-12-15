# Production Mode

> 실서비스를 위한 품질 우선 개발 모드 (기본값)

## Overview

Production 모드는 **품질 우선**으로 실서비스, 장기 유지보수를 위한 개발에 적합합니다.
Engineering Layer의 **기본 모드**입니다.

## 적용되는 전체 규칙

### 테스트 (필수)
- [x] 단위 테스트 **필수**
- [x] 테스트 커버리지 **80% 이상**
- [x] E2E 테스트 주요 플로우 필수
- [x] 테스트 실패 시 PR 머지 차단

### 코드 품질 (필수)
- [x] 코드 리뷰 **필수** (최소 1명)
- [x] DDD 4계층 **준수**
  - repositories → api-clients → hooks → components
- [x] 엄격한 타입 정의 (`any` 금지)
- [x] JSDoc/TSDoc 주석 필수

### 아키텍처 (필수)
- [x] 도메인 분리 명확화
- [x] 컴포넌트 단일 책임 원칙
- [x] 재사용 가능한 추상화
- [x] 의존성 주입 패턴

### CI/CD (필수)
- [x] ESLint 에러 및 경고 **모두 해결**
- [x] TypeScript strict 모드
- [x] 빌드 + 테스트 통과
- [x] 스테이징 배포 및 검증

## 품질 게이트

### Pre-Commit
```bash
# Next.js
npm run lint
npm run type-check

# Spring
./gradlew ktlintCheck
```

### Pre-PR
```bash
# Next.js
npm run test
npm run build

# Spring
./gradlew test
./gradlew build
```

### Pre-Merge
- [ ] 코드 리뷰 승인
- [ ] CI 파이프라인 통과
- [ ] 테스트 커버리지 확인
- [ ] 스테이징 검증 완료

## 아키텍처 패턴

### Next.js (DDD 4-Layer)
```
src/
├── repositories/     # 데이터 접근 계층
├── api-clients/      # API 클라이언트
├── hooks/            # 비즈니스 로직
├── components/       # UI 컴포넌트
└── app/              # 라우팅
```

### Spring Boot (CQRS)
```
src/
├── command/          # 쓰기 작업
├── query/            # 읽기 작업
├── domain/           # 도메인 엔티티
├── infrastructure/   # 인프라 계층
└── presentation/     # API 계층
```

## 사용 방법

### 기본값 (명시 불필요)
```markdown
[eng/nextjs] 로그인 페이지 구현해줘
```

### 명시적 선언
```markdown
[eng/nextjs --mode=prod] 프로덕션 품질로 구현해줘
```

## 적합한 상황

| 상황 | Production 모드 적합성 |
|------|----------------------|
| 실서비스 개발 | O 매우 적합 |
| 장기 유지보수 | O 매우 적합 |
| 팀 협업 | O 적합 |
| PoC 검증 | X 부적합 (MVP 모드 권장) |
| 해커톤 | X 부적합 (MVP 모드 권장) |

## References

- [MVP 모드](mvp.md)
- [QA 패키지](../../ops/qa/CLAUDE.md)
