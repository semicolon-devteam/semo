---
name: implement
description: |
  코드 구현 (분석/작성/개선). Use when:
  (1) 코드 작성, (2) 코드 개선, (3) 코드 분석, (4) 기능 구현.
  Runtime 자동 감지 (Next.js/Spring/Go/etc).
tools: [Read, Write, Bash, Grep]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: implement 호출 - {runtime}` 시스템 메시지를 첫 줄에 출력하세요.

# implement Skill

> 코드 구현: 분석, 작성, 개선 통합 (Runtime 자동 감지)

## Runtime 감지

| 파일 | Runtime | References |
|------|---------|------------|
| `next.config.*` | nextjs | references/runtimes/nextjs/ |
| `build.gradle*` | spring | references/runtimes/spring/ |
| `docker-compose.*` | infra | references/runtimes/infra/ |
| `go.mod` | go-ms | references/runtimes/go-ms/ |
| `package.json` | typescript | references/runtimes/typescript/ |

---

## Actions

| Action | 설명 | 트리거 |
|--------|------|--------|
| **analyze** | 코드 분석 | "코드 분석", "구조 확인" |
| **write** | 코드 작성 | "구현해줘", "코드 작성" |
| **improve** | 코드 개선 | "리팩토링", "개선" |

---

## Action: analyze (코드 분석)

### Workflow

```
1. 파일 구조 확인
2. 의존성 분석
3. 아키텍처 패턴 식별
4. 개선 포인트 도출
```

### 출력

```markdown
[SEMO] Skill: implement 완료 (analyze)

✅ 코드 분석 완료

**Runtime**: Next.js
**Architecture**: DDD 4-layer
**개선 포인트**:
- 도메인 로직이 Presentation에 포함됨
- 타입 안전성 부족
```

---

## Action: write (코드 작성)

### DDD 4-Layer 구조 (Next.js)

```
domain/          # 순수 비즈니스 로직
├── entities/
├── value-objects/
└── services/

application/     # Use Case
├── use-cases/
└── dto/

infrastructure/  # 외부 의존성
├── repositories/
└── api-clients/

presentation/    # UI/API
├── components/
└── actions/
```

### 코드 작성 원칙

1. **도메인 우선**: 비즈니스 로직부터 작성
2. **타입 안전성**: TypeScript strict mode
3. **테스트**: `__tests__` 디렉토리에 테스트 포함
4. **에러 핸들링**: try-catch, Result 패턴
5. **문서화**: JSDoc 주석

---

## Action: improve (코드 개선)

### 개선 체크리스트

- [ ] 중복 코드 제거
- [ ] 함수 분리 (SRP)
- [ ] 타입 명시
- [ ] 에러 핸들링 개선
- [ ] 성능 최적화

---

## Runtime별 규칙

### Next.js (TypeScript)
- DDD 4-layer 구조
- Server Actions 우선
- `use server`/`use client` 명시
- Zod 스키마 검증

### Spring Boot (Java)
- 패키지 구조: domain → application → infrastructure → presentation
- JPA Entity + Repository
- Service + Controller

### Go (Microservice)
- Clean Architecture
- Interface 우선
- 에러 타입 명시

---

## 출력

```markdown
[SEMO] Skill: implement 완료 (write)

✅ 코드 작성 완료

**Runtime**: Next.js
**Files**:
- domain/user/user.entity.ts
- application/user/create-user.use-case.ts
- infrastructure/user/user.repository.ts
- presentation/user/user.actions.ts
- __tests__/user/user.test.ts
```

---

## Related

- `spec` - 스펙 문서 확인
- `test` - 테스트 작성
- `review` - 코드 리뷰
- `verify` - 품질 검증
