# SEMO Engineering Layer (eng)

> 엔지니어링 영역: 개발, 인프라, 배포

## Core Rules (상속)

> 📄 [semo-core/principles/](../semo-core/principles/) 참조

| 규칙 | 참조 |
|------|------|
| Orchestrator-First | [ORCHESTRATOR_FIRST.md](../semo-core/principles/ORCHESTRATOR_FIRST.md) |
| Quality Gate | [QUALITY_GATE.md](../semo-core/principles/QUALITY_GATE.md) |

---

## eng 고유: GitHub Task Status 연동

| 액션 | Status 변경 | 조건 |
|------|-------------|------|
| 브랜치 체크아웃 | → **작업중** | Issue 번호 포함된 브랜치 |
| PR 생성 | → **리뷰요청** | Issue 연결된 PR |
| PR 병합 | → **병합됨** | Issue 연결된 PR |

## eng 고유: 코드 품질 기준

- **컴포넌트 크기**: 단일 파일 300줄 이하 권장
- **함수 복잡도**: 단일 함수 50줄 이하 권장
- **타입 안정성**: `any` 타입 사용 최소화
- **에러 처리**: 모든 async 함수에 try-catch

---

## 세미콜론 개발 컨텍스트

### 아키텍처 전환

```
[레거시] Supabase 중심 (RLS, Triggers, RPC)
         ↓ 전환 중
[현재] Spring Boot 중심 (core-backend, Flyway)
       Supabase는 Auth/Storage/Realtime만 유지
```

### 코어 레포지토리

| 레포 | 역할 |
|------|------|
| `core-backend` | Spring Boot 서버, Flyway 스키마 |
| `core-interface` | 공통 API 스펙 (Swagger) |
| `core-supabase` | 레거시 스키마, 구현 가이드 |
| `cm-template` | 프론트엔드 공통 템플릿 |

### 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **Backend**: Kotlin/Spring Boot, WebFlux, R2DBC
- **Database**: Supabase PostgreSQL

---

## 패키지 구조

| 패키지 | 역할 | 대상 |
|--------|------|------|
| `nextjs` | Next.js 프론트엔드 | Frontend |
| `spring` | Spring Boot 백엔드 | Backend |
| `ms` | 마이크로서비스 | Backend |
| `infra` | 인프라, CI/CD | DevOps |

## Mode System

| 모드 | 용도 |
|------|------|
| `mvp` | PoC, 프로토타입 (속도 우선) |
| `prod` | 실서비스 (품질 우선, 기본값) |

```markdown
[eng/nextjs --mode=mvp] 빠르게 로그인 만들어줘
[eng/nextjs] 로그인 구현해줘  # prod 모드
```

## References

- [nextjs/CLAUDE.md](nextjs/CLAUDE.md)
- [spring/CLAUDE.md](spring/CLAUDE.md)
