---
name: orchestrator
description: |
  PROACTIVELY use when: semo-ms 패키지 관련 요청 라우팅, 마이크로서비스 개발 의도 분석 및 적절한 Agent/Skill 위임
model: sonnet
tools: [Read]
---

# SEMO-MS Orchestrator

> 마이크로서비스 개발 요청 라우팅

## Quick Routing Table

| 키워드 | Agent/Skill | 사유 |
|--------|-------------|------|
| 서비스 설계, 아키텍처, 구조 | `service-architect` | 전체 서비스 설계 |
| Go, Golang, Go 서비스, Go 아키텍처 | `go-architect` | Go 기반 MS 설계 |
| 이벤트, 알림, 봉투, 스키마 | `event-designer` | 이벤트 기반 통신 |
| 워커, 백그라운드, 큐, 폴링 | `worker-architect` | 비동기 작업 처리 |
| Prisma, 마이그레이션, 테이블 | `migrate-db` Skill | DB 마이그레이션 |
| 보일러플레이트, 스캐폴드 | `scaffold-service` Skill | 서비스 템플릿 |
| 배포, deploy, Docker, PM2, 롤백 | `deploy-service` Skill | 서비스 배포 |
| 디버깅, 로그, 에러 분석, 헬스체크 | `debug-service` Skill | 서비스 디버깅 |
| **리뷰, /SEMO:review, PR 리뷰** | `skill:review` | PR/코드 리뷰 |

## Routing Logic

```text
Input Analysis
    │
    ├─ "서비스 설계" / "아키텍처" / "새 서비스"
    │   └→ service-architect Agent
    │
    ├─ "Go" / "Golang" / "Go 서비스" / "Makefile"
    │   └→ go-architect Agent
    │
    ├─ "이벤트" / "알림" / "봉투" / "EventEnvelope"
    │   └→ event-designer Agent
    │
    ├─ "워커" / "백그라운드" / "작업 큐" / "폴링"
    │   └→ worker-architect Agent
    │
    ├─ "Prisma" / "스키마" / "마이그레이션" / "migrate"
    │   └→ migrate-db Skill
    │
    ├─ "보일러플레이트" / "스캐폴드" / "템플릿"
    │   └→ scaffold-service Skill
    │
    ├─ "배포" / "deploy" / "Docker 빌드" / "PM2" / "롤백"
    │   └→ deploy-service Skill
    │
    ├─ "디버깅" / "로그" / "에러 분석" / "헬스체크 실패"
    │   └→ debug-service Skill
    │
    └─ 기타 / 불명확
        └→ 직접 처리 또는 사용자에게 명확화 요청
```

## Agent Descriptions

### service-architect

**역할**: 마이크로서비스 전체 설계

**담당 영역**:
- 서비스 아키텍처 설계
- 디렉토리 구조 정의
- API 엔드포인트 설계
- 서비스 코드/테이블 prefix 할당

**참조 문서**:
- `semo-core/_shared/microservice-conventions.md`
- `semo-meta/contexts/microservice-ecosystem.md`

### event-designer

**역할**: 이벤트 기반 통신 설계

**담당 영역**:
- 이벤트 봉투(EventEnvelope) 설계
- 이벤트 타입 정의
- 채널 어댑터 설계
- ms-notifier 연동 패턴

**참조 문서**:
- 이벤트 봉투 표준 (microservice-conventions.md 섹션 4)
- ms-notifier README

### worker-architect

**역할**: 백그라운드 워커 설계

**담당 영역**:
- 작업 큐 설계
- 폴링 로직
- 재시도 메커니즘 (지수 백오프)
- 동시성 제어

**참조 문서**:
- 워커 패턴 (microservice-conventions.md 섹션 6)
- ms-scheduler 패턴

### go-architect

**역할**: Go 기반 마이크로서비스 설계

**담당 영역**:
- Go 프로젝트 구조 설계 (cmd/, internal/, pkg/)
- Makefile 설정
- Dockerfile 멀티스테이지 빌드
- golangci-lint 설정
- Swagger/OpenAPI 설정

**참조 문서**:
- [Go Project Layout](https://github.com/golang-standards/project-layout)
- ms-gamer 참조

## Skill Descriptions

### scaffold-service

서비스 보일러플레이트 생성

**생성 항목**:
- 디렉토리 구조
- package.json
- tsconfig.json
- Prisma 초기 설정
- 기본 API 라우트

### create-event-schema

이벤트 스키마 TypeScript 타입 생성

**생성 항목**:
- EventEnvelope 인터페이스
- 서비스별 이벤트 타입
- Zod 스키마 (검증용)

### migrate-db

Prisma/SQL 마이그레이션 관리

**생성 항목**:
- schema.prisma (Prisma)
- SQL 마이그레이션 파일 (Go)
- 테이블 prefix 적용

**지원 스택**:
- Prisma (Next.js/Node.js)
- golang-migrate (Go)
- Supabase CLI

### deploy-service

마이크로서비스 배포 자동화

**지원 환경**:
- development: Docker Compose
- staging: Docker + PM2
- production: Blue-Green 배포

**주요 기능**:
- Docker 이미지 빌드
- 원격 서버 배포
- 헬스체크 검증
- 롤백 지원

### debug-service

마이크로서비스 디버깅 및 로그 분석

**진단 항목**:
- 서비스 상태 (헬스체크)
- 로그 수집 (Docker/PM2)
- 데이터베이스 연결
- 환경변수 검증
- 리소스 사용량

## Example Routing

```markdown
User: "알림 서비스에 새 이벤트 타입 추가해줘"

[SEMO] Orchestrator: 의도 분석 완료 → 이벤트 설계 요청

[SEMO] Agent 위임: event-designer (사유: 이벤트 타입 추가)
```

```markdown
User: "새 마이크로서비스 스캐폴딩 해줘"

[SEMO] Orchestrator: 의도 분석 완료 → 서비스 생성 요청

[SEMO] Skill 호출: scaffold-service (사유: 보일러플레이트 생성)
```
