# SEMO Engineering - Infra Package

> 인프라, CI/CD, 배포 관리

## Package Info

- **Package**: eng/infra
- **Version**: [../VERSION](../VERSION) 참조
- **Target**: core-compose, actions-template 레포
- **Audience**: DevOps, 인프라 엔지니어

---

## 핵심 역할

| 기능 | 설명 |
|------|------|
| Docker 관리 | Docker Compose 설정 및 배포 |
| CI/CD | GitHub Actions 파이프라인 |
| Nginx | 리버스 프록시 설정 |
| 환경 관리 | .env 템플릿 관리 |
| 모니터링 | 로깅 및 모니터링 설정 |

---

## Routing Keywords

| 키워드 | 트리거 |
|--------|--------|
| Docker, docker-compose | Docker 관련 작업 |
| CI/CD, workflow, actions | GitHub Actions 작업 |
| Nginx, 프록시 | Nginx 설정 |
| 배포, deploy | 배포 작업 |
| 환경설정, env | 환경 변수 관리 |
| 롤백, rollback | 롤백 작업 |

---

## 🔴 금지 사항 (NON-NEGOTIABLE)

| 항목 | 이유 |
|------|------|
| 프로덕션 직접 배포 | CI/CD 파이프라인 사용 |
| 인증정보 커밋 | 환경 변수로 분리 |
| `.env` 직접 수정 | `.env.{env}` 템플릿 사용 |

---

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | infra 작업 라우팅 |
| ci-architect | CI/CD 파이프라인 설계 |
| deploy-master | 배포 관리 |
| nginx-advisor | Nginx 설정 자문 |
| monitoring-guide | 모니터링 설정 가이드 |

---

## Skills

| Skill | 역할 |
|-------|------|
| scaffold-compose | Docker Compose 템플릿 생성 |
| scaffold-workflow | GitHub Actions 워크플로우 생성 |
| scaffold-nginx | Nginx 설정 생성 |
| deploy-service | 서비스 배포 |
| rollback-service | 서비스 롤백 |
| verify-compose | Docker Compose 검증 |
| verify-nginx | Nginx 설정 검증 |
| sync-env | 환경 변수 동기화 |
| health-check | 인프라 환경 검증 |

---

## 환경 관리

### 환경 파일 구조

```text
.env.example      # 템플릿 (커밋됨)
.env.development  # 개발 환경
.env.staging      # 스테이징 환경
.env.production   # 프로덕션 환경 (커밋 금지)
```

### 환경 변수 명명 규칙

```text
{SERVICE}_{CATEGORY}_{NAME}
예: DB_HOST, REDIS_PORT, AWS_ACCESS_KEY_ID
```

---

## Docker Compose 패턴

### 서비스 분류

```yaml
services:
  # 애플리케이션 서비스
  app:
    ...

  # 인프라 서비스
  db:
    ...
  redis:
    ...

  # 유틸리티 서비스
  nginx:
    ...
```

---

## 마이크로서비스 컨텍스트

> 팀 마이크로서비스들은 중앙 DB (core-central-db)를 공유합니다.

### 마이크로서비스 목록

| 서비스 | 레포지토리 | DB Prefix | 설명 |
|--------|-----------|-----------|------|
| **Crawler** | `ms-crawler` | `gt_` | 데이터 수집 (구 Gatherer) |
| **Collector** | `ms-collector` | `ag_` | 데이터 집계 (구 Aggregator) |
| **Media-Processor** | `media-processor` | `pl_` | 미디어 처리 (구 Polisher) |
| **Gamer** | `ms-gamer` | `gm_` | 게임 서비스 |
| **Ledger** | `ledger` | `lg_` | 재무 관리 |

### 운영 현황

| 상태 | 서비스 |
|------|--------|
| **운영 중** | ms-gamer (중앙 DB 연동 완료) |
| **마이그레이션 예정** | crawler, media-processor, ledger |

### 인프라 작업 시 참조

- **중앙 DB 스키마**: `semicolon-devteam/core-central-db` 참조
- **Docker Compose**: 서비스별 개별 compose 파일 관리
- **CI/CD**: GitHub Actions 기반 배포

> 📖 상세: [중앙 DB 컨텍스트](../../semo-core/_shared/central-db.md)

---

## References

- [eng 레이어](../CLAUDE.md)
- [ops/qa 패키지](../../ops/qa/CLAUDE.md)
