# SEMO 패키지 카탈로그

> 역할별 SEMO 패키지 상세 안내

---

## 패키지 개요

### Standard (필수)

모든 SEMO 설치에 포함되는 기본 패키지입니다.

| 패키지 | 버전 | 설명 |
|--------|------|------|
| **semo-core** | v2.0.1 | 원칙, 오케스트레이터, 공통 커맨드 |
| **semo-skills** | v2.0.1 | 13개 통합 스킬 |

### Extensions (선택)

역할/플랫폼에 따라 선택적으로 설치합니다.

| 패키지 | 대상 | 스킬 수 | 에이전트 수 |
|--------|------|---------|------------|
| semo-next | 프론트엔드 | 15+ | 8 |
| semo-backend | 백엔드 | 12+ | 6 |
| semo-po | PO/기획자 | 8+ | 4 |
| semo-design | 디자이너 | 5+ | 2 |
| semo-qa | QA/테스터 | 8+ | 3 |
| semo-pm | PM | 6+ | 2 |
| semo-infra | 인프라 | 6+ | 4 |
| semo-ms | MSA | 5+ | 3 |
| semo-mvp | MVP | 8+ | 3 |
| semo-meta | 프레임워크 | 7+ | 6 |

---

## Standard 패키지

### semo-core

**역할**: SEMO 프레임워크의 핵심

**포함 내용**:
- Orchestrator (의도 분석 + 라우팅)
- 핵심 원칙 (PRINCIPLES.md, MESSAGE_RULES.md)
- 공통 커맨드 (`/SEMO:help`, `/SEMO:health`, `/SEMO:update`)
- 템플릿 (CLAUDE.md, gitignore)

**커맨드**:
| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | SEMO 도움말 표시 |
| `/SEMO:health` | 환경 및 구조 검증 |
| `/SEMO:update` | SEMO 최신 버전으로 업데이트 |
| `/SEMO:slack` | Slack 채널에 메시지 전송 |
| `/SEMO:feedback` | 피드백/버그 리포트 제출 |

---

### semo-skills

**역할**: 기능별 통합 스킬 제공

**스킬 목록**:

| 카테고리 | 스킬 | 설명 |
|----------|------|------|
| **행동** | coder | 코드 작성/수정 |
| | tester | 테스트 실행/검증 |
| | planner | 기획/계획 |
| | deployer | 배포/릴리스 |
| | writer | 문서 작성 |
| **운영** | memory | 세션 간 기억 |
| | notify-slack | Slack 알림 |
| | feedback | 피드백 수집 |
| | version-updater | 버전 관리 |
| | semo-help | 도움말 |
| | semo-architecture-checker | 구조 검증 |
| | circuit-breaker | 안전 장치 |
| | list-bugs | 버그 목록 |

---

## Extension 패키지

### semo-next

> 프론트엔드 개발자를 위한 패키지

**대상**: Next.js, React 프론트엔드 개발자

**기술 스택**:
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Supabase 연동

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `implement` | Phase-gated 구현 (Foundation → Feature → Polish) |
| `scaffold-domain` | DDD 도메인 구조 생성 |
| `verify` | 구현 검증 |
| `spring-integration` | Spring 백엔드 API 연동 |
| `fetch-api-spec` | API 스펙 조회 |
| `project-context` | 프로젝트 컨텍스트 로드 |
| `typescript-review` | TypeScript 코드 리뷰 |

**주요 에이전트**:
| 에이전트 | 역할 |
|----------|------|
| `implementation-master` | Phase-gated 구현 관리 |
| `ddd-architect` | DDD 4-layer 아키텍처 설계 |
| `quality-master` | 품질 검증 |
| `migration-master` | 레거시 마이그레이션 |
| `teacher` | 코드/개념 설명 |

**예시 요청**:
```
"로그인 페이지 만들어줘"
"API 연동해줘"
"이 코드 리팩토링해줘"
"DDD 구조로 도메인 설계해줘"
```

---

### semo-backend

> 백엔드 개발자를 위한 패키지

**대상**: Spring WebFlux, Kotlin 백엔드 개발자

**기술 스택**:
- Kotlin
- Spring WebFlux
- R2DBC (Reactive)
- PostgreSQL

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `implement` | Phase-gated 구현 |
| `scaffold-domain` | DDD 도메인 생성 |
| `sync-openapi` | OpenAPI 스펙 동기화 |
| `verify-reactive` | Reactive 패턴 검증 |
| `lookup-migration` | DB 마이그레이션 조회 |
| `run-tests` | 테스트 실행 |
| `analyze-code` | 코드 분석 |

**주요 에이전트**:
| 에이전트 | 역할 |
|----------|------|
| `domain-architect` | DDD 도메인 설계 |
| `implementation-master` | 구현 관리 |
| `spec-master` | API 스펙 관리 |
| `debug-master` | 디버깅 |
| `quality-master` | 품질 검증 |

**예시 요청**:
```
"User 도메인 만들어줘"
"CQRS 패턴으로 구현해줘"
"테스트 코드 작성해줘"
"API 스펙 동기화해줘"
```

---

### semo-po

> PO/기획자를 위한 패키지

**대상**: Product Owner, 기획자

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `create-epic` | Epic 문서 생성 |
| `sync-tasks` | GitHub Issues 동기화 |
| `check-backend-duplication` | 백엔드 중복 기능 검사 |
| `auto-label-by-scope` | 이슈 자동 라벨링 |
| `docx` | Word 문서 생성 |

**주요 에이전트**:
| 에이전트 | 역할 |
|----------|------|
| `epic-master` | Epic 생성/관리 |
| `draft-task-creator` | Task 초안 생성 |
| `spec-writer` | 스펙 문서 작성 |

**예시 요청**:
```
"댓글 기능 Epic 만들어줘"
"Task를 GitHub 이슈로 동기화해줘"
"이 기능이 백엔드에 있는지 확인해줘"
```

---

### semo-design

> 디자이너를 위한 패키지

**대상**: UI/UX 디자이너

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `create-mockup` | 목업 이미지 생성 |
| `handoff` | 개발팀 핸드오프 문서 |
| `design-review` | 디자인 리뷰 |

**예시 요청**:
```
"로그인 화면 목업 만들어줘"
"개발팀에 전달할 핸드오프 문서 만들어줘"
"이 디자인 피드백해줘"
```

---

### semo-qa

> QA/테스터를 위한 패키지

**대상**: QA 엔지니어, 테스터

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `validate-test-cases` | 테스트 케이스 검증 |
| `test-queue` | 테스트 대기열 관리 |
| `change-to-testing` | 이슈 상태 변경 |
| `production-gate` | 프로덕션 배포 게이트 |
| `report-bug` | 버그 리포트 작성 |

**예시 요청**:
```
"테스트 대기 목록 보여줘"
"로그인 기능 테스트 케이스 검증해줘"
"버그 리포트 작성해줘"
```

---

### semo-pm

> PM을 위한 패키지

**대상**: Project Manager

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `create-sprint` | 스프린트 생성 |
| `assign-task` | 태스크 할당 |
| `detect-blockers` | 장애물 감지 |
| `generate-member-report` | 팀원별 리포트 |
| `audit-issues` | 이슈 감사 |

**예시 요청**:
```
"스프린트 만들어줘"
"팀원별 진행 상황 보여줘"
"블로커 있는지 확인해줘"
```

---

### semo-infra

> 인프라 엔지니어를 위한 패키지

**대상**: DevOps, 인프라 엔지니어

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `scaffold-compose` | Docker Compose 생성 |
| `scaffold-nginx` | Nginx 설정 생성 |
| `sync-env` | 환경 변수 동기화 |
| `deploy` | 서비스 배포 |
| `rollback` | 롤백 |

**주요 에이전트**:
| 에이전트 | 역할 |
|----------|------|
| `deploy-master` | 배포 관리 |
| `ci-architect` | CI/CD 파이프라인 설계 |
| `nginx-advisor` | Nginx 설정 조언 |

**예시 요청**:
```
"Docker Compose 파일 만들어줘"
"Nginx 리버스 프록시 설정해줘"
"서비스 배포해줘"
```

---

### semo-ms

> MSA 개발자를 위한 패키지

**대상**: 마이크로서비스 개발자

**대상 레포지토리**:
- ms-notifier (알림 서비스)
- ms-scheduler (스케줄러)
- ms-ledger (장부)
- ms-media-processor (미디어 처리)
- ms-crawler (웹 스크래핑)

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `scaffold-service` | 서비스 보일러플레이트 생성 |
| `create-event-schema` | 이벤트 스키마 생성 |
| `setup-prisma` | Prisma 설정 |

**주요 에이전트**:
| 에이전트 | 역할 |
|----------|------|
| `service-architect` | 서비스 설계 |
| `event-designer` | 이벤트 봉투 설계 |
| `worker-architect` | 백그라운드 워커 설계 |

**예시 요청**:
```
"새 마이크로서비스 설계해줘"
"이벤트 스키마 만들어줘"
"Prisma 설정해줘"
```

---

### semo-mvp

> MVP 개발자를 위한 패키지

**대상**: 빠른 프로토타이핑이 필요한 개발자

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `scaffold-mvp-domain` | MVP 도메인 생성 |
| `implement-mvp` | MVP 구현 |
| `sync-interface` | 인터페이스 동기화 |
| `verify-integration` | 연동 검증 |

**주요 에이전트**:
| 에이전트 | 역할 |
|----------|------|
| `mvp-architect` | MVP 아키텍처 설계 |
| `implementation-master` | 구현 관리 |

**특징**:
- Schema Extension Strategy (metadata JSONB 우선)
- core-interface 기반 타입 준수
- 빠른 이터레이션 지원

---

### semo-meta

> SEMO 프레임워크 개발자를 위한 패키지

**대상**: SEMO 프레임워크 자체 개발/관리

**주요 스킬**:
| 스킬 | 설명 |
|------|------|
| `package-validator` | 패키지 구조 검증 |
| `package-sync` | 패키지 동기화 |
| `package-deploy` | 외부 프로젝트 배포 |
| `version-manager` | 버저닝 및 npm 배포 |
| `check-feedback` | 피드백 이슈 수집 |

**주요 에이전트**:
| 에이전트 | 역할 |
|----------|------|
| `package-architect` | 패키지 설계 |
| `release-manager` | 릴리스 관리 |

---

## 패키지 선택 가이드

### 역할별 권장

| 역할 | 1순위 | 2순위 (선택) |
|------|-------|-------------|
| 프론트엔드 개발자 | semo-next | semo-mvp |
| 백엔드 개발자 | semo-backend | semo-ms |
| 풀스택 개발자 | semo-next + semo-backend | - |
| PO/기획자 | semo-po | - |
| 디자이너 | semo-design | - |
| QA | semo-qa | - |
| PM | semo-pm | semo-po |
| 인프라 | semo-infra | semo-ms |
| MSA 개발자 | semo-ms | semo-backend |

### 복수 패키지 설치

여러 역할을 수행하는 경우 복수 패키지를 설치할 수 있습니다:

```bash
# CLI로 여러 패키지 선택
npx @team-semicolon/semo-cli init

# 설치 중 패키지 선택:
# [x] semo-next
# [x] semo-backend
# [ ] semo-po
# ...
```

---

## 버전 정보

| 패키지 | 현재 버전 | 최소 Claude Code |
|--------|----------|------------------|
| semo-core | 2.0.1 | 1.0.0 |
| semo-skills | 2.0.1 | 1.0.0 |
| semo-next | 0.49.0 | 1.0.0 |
| semo-backend | 1.10.0 | 1.0.0 |
| semo-po | 0.26.0 | 1.0.0 |
| semo-pm | 0.9.1 | 1.0.0 |
| semo-infra | 0.4.1 | 1.0.0 |
| semo-ms | 0.2.0 | 1.0.0 |
| semo-mvp | 0.1.1 | 1.0.0 |
| semo-meta | 0.1.0 | 1.0.0 |

---

## 참조

- [QUICKSTART.md](./QUICKSTART.md) - 빠른 시작
- [USER_GUIDE.md](./USER_GUIDE.md) - 상세 사용법
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 기술 아키텍처
