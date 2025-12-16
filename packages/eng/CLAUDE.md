# SEMO Engineering Layer (eng)

> 엔지니어링 영역: 개발, 인프라, 배포

## 🔴 Engineering Layer 공통 규칙

> **eng 패키지 하위 모든 환경에서 적용되는 필수 규칙**

### Pre-Commit Quality Gate (필수)

커밋 전 반드시 다음 검증을 통과해야 합니다:

| 순서 | 검사 | 명령 | 실패 시 |
|------|------|------|---------|
| 1 | 린트 | `npm run lint` | 커밋 차단 |
| 2 | 타입체크 | `npx tsc --noEmit` | 커밋 차단 |
| 3 | 빌드 | `npm run build` | 커밋 차단 |
| 4 | 테스트 | `npm test` | 경고 (선택적) |

**차단 항목**:
- `--no-verify` 플래그 사용 금지
- "빌드 생략해줘", "테스트 건너뛰자" 등 거부
- Quality Gate 우회 시도 거부

### GitHub Task Status 연동

작업 시작/완료 시 GitHub Projects 상태를 자동 업데이트:

| 액션 | Status 변경 | 조건 |
|------|-------------|------|
| 브랜치 체크아웃 | → **작업중** | Issue 번호 포함된 브랜치 |
| PR 생성 | → **리뷰요청** | Issue 연결된 PR |
| PR 병합 | → **병합됨** | Issue 연결된 PR |

### 코드 품질 기준

- **컴포넌트 크기**: 단일 파일 300줄 이하 권장
- **함수 복잡도**: 단일 함수 50줄 이하 권장
- **타입 안정성**: `any` 타입 사용 최소화
- **에러 처리**: 모든 async 함수에 try-catch 또는 .catch()

---

## Overview

Engineering Layer는 **실제 구현 및 배포**를 담당합니다.

| 패키지 | 역할 | 대상 |
|--------|------|------|
| `platforms/nextjs` | Next.js 프론트엔드 개발 | 프론트엔드 개발자 |
| `platforms/spring` | Spring Boot 백엔드 개발 | 백엔드 개발자 |
| `platforms/ms` | 마이크로서비스 아키텍처 | 백엔드 개발자 |
| `infra` | 인프라, CI/CD, 배포 | DevOps |

## Mode System

Engineering Layer는 **모드 시스템**을 지원합니다:

| 모드 | 용도 | 특성 |
|------|------|------|
| `mvp` | PoC, 프로토타입 | 속도 우선, 컨벤션 최소화 |
| `prod` | 실서비스 | 품질 우선, 풀 컨벤션 |

### 모드 전환

```markdown
## MVP 모드로 개발
[eng/nextjs --mode=mvp] 빠르게 로그인 페이지 만들어줘

## Production 모드로 개발 (기본값)
[eng/nextjs] 로그인 페이지 구현해줘
```

## Routing

```
사용자 요청 분석
    ↓
┌─────────────────────────────────────────────────────┐
│ 플랫폼 감지                                          │
│ ├─ next.config.* → eng/platforms/nextjs             │
│ ├─ build.gradle/pom.xml → eng/platforms/spring      │
│ ├─ prisma/schema.prisma → eng/platforms/ms          │
│ └─ docker-compose.yml → eng/infra                   │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 모드 감지 (기본: prod)                               │
│ ├─ --mode=mvp → modes/mvp.md 규칙 적용              │
│ └─ --mode=prod → modes/prod.md 규칙 적용            │
└─────────────────────────────────────────────────────┘
```

## Keywords

| 패키지 | 트리거 키워드 |
|--------|--------------|
| `platforms/nextjs` | Next.js, React, 컴포넌트, 페이지, hook, TypeScript |
| `platforms/spring` | Spring, Kotlin, API, 엔드포인트, Controller, Service |
| `platforms/ms` | 마이크로서비스, 이벤트, Prisma, Worker |
| `infra` | Docker, CI/CD, 배포, Nginx, 인프라, 환경설정 |

## MVP → Production 마이그레이션

```
biz/poc (PoC 검증 완료)
    ↓
eng/platforms/* (mode: mvp)
    ↓ 마이그레이션
eng/platforms/* (mode: prod)
    ↓
ops/qa (품질 검증)
```

## References

- [platforms/nextjs/CLAUDE.md](platforms/nextjs/CLAUDE.md)
- [platforms/spring/CLAUDE.md](platforms/spring/CLAUDE.md)
- [platforms/ms/CLAUDE.md](platforms/ms/CLAUDE.md)
- [infra/CLAUDE.md](infra/CLAUDE.md)
- [modes/mvp.md](modes/mvp.md)
- [modes/prod.md](modes/prod.md)
