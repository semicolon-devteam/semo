# SAX-Infra

> 인프라, CI/CD, DevOps 작업을 위한 SAX 패키지

## Overview

SAX-Infra는 Semicolon 팀의 인프라 자동화를 지원하는 패키지입니다.

### Target Repositories

| Repository | Role |
|------------|------|
| `core-compose` | Docker Compose 배포 매니페스트, Nginx 설정 |
| `actions-template` | CI/CD 워크플로우 템플릿, Dockerfile |

## Installation

```bash
# SAX 설치 스크립트 사용
./install-sax.sh --package infra
```

## Agents

| Agent | Role |
|-------|------|
| `orchestrator` | 인프라 요청 라우팅 |
| `deploy-master` | 배포 전략 및 Docker Compose 관리 |
| `ci-architect` | CI/CD 파이프라인 설계 |
| `nginx-advisor` | Nginx 설정 최적화 |
| `monitoring-guide` | 모니터링 및 로깅 가이드 |

## Skills

| Skill | Role |
|-------|------|
| `scaffold-workflow` | GitHub Actions 워크플로우 생성 |
| `scaffold-compose` | Docker Compose 서비스 추가 |
| `scaffold-nginx` | Nginx vhost/upstream 생성 |
| `verify-compose` | docker-compose 설정 검증 |
| `verify-nginx` | Nginx 설정 검증 |
| `deploy-service` | 서비스 배포 실행 |
| `rollback-service` | 서비스 롤백 |
| `sync-env` | 환경변수 동기화 |

## Commands

- `/SAX:deploy` - 서비스 배포
- `/SAX:rollback` - 서비스 롤백
- `/SAX:env-check` - 환경변수 검증

## License

Proprietary - Semicolon Team
