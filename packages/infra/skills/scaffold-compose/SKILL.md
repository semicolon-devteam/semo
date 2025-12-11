---
name: scaffold-compose
description: Docker Compose 서비스 정의 추가. Use when (1) 새 서비스 추가, (2) compose 수정, (3) 서비스 정의 필요.
tools: [Bash, Read, Write, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: scaffold-compose 호출 - {서비스명}` 시스템 메시지를 첫 줄에 출력하세요.

# scaffold-compose

> Docker Compose 서비스 추가 Skill

## 개요

docker-compose.yml에 새 서비스 정의를 추가합니다.

## 트리거

- "compose에 서비스 추가해줘"
- "docker-compose 수정"
- "새 서비스 정의"

## 입력 파라미터

| 파라미터 | 필수 | 설명 | 예시 |
|----------|------|------|------|
| service_name | ✅ | 서비스 이름 | `ms-notification` |
| service_type | ✅ | 서비스 유형 | `next`, `spring`, `node` |
| image_name | ❌ | 이미지 이름 (기본: service_name) | `semicolonmanager/ms-notification` |
| port | ❌ | 내부 포트 | `3000`, `8080` |
| networks | ❌ | 네트워크 목록 | `application-network` |

## 실행 절차

### 1. 현재 compose 파일 확인

```bash
gh api repos/semicolon-devteam/core-compose/contents/docker-compose.yml \
  --jq '.content' | base64 -d
```

### 2. 서비스 정의 생성

서비스 유형에 따른 템플릿 적용

### 3. docker-compose.yml 수정

새 서비스 블록 추가

### 4. 환경변수 템플릿 추가

`.env.dev`, `.env.stg`에 태그 변수 추가

### 5. 검증

```bash
docker-compose --env-file .env.stg config
```

## 출력

```markdown
[SAX] scaffold-compose: 완료

✅ **서비스 추가 완료**

서비스: `{service_name}`

### 추가된 항목
- `docker-compose.yml` → services.{service_name}
- `.env.dev` → {SERVICE_TAG}
- `.env.stg` → {SERVICE_TAG}

### 다음 단계
1. `skill:scaffold-nginx` → 외부 노출 필요 시
2. `skill:verify-compose` → 설정 검증
```

## 템플릿

### Next.js 서비스

```yaml
{service-name}:
  image: semicolonmanager/{service-name}:${SERVICE_TAG:-latest}
  restart: unless-stopped
  networks:
    - application-network
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

### Spring Boot 서비스

```yaml
{service-name}:
  image: semicolonmanager/core-backend:${CORE_BACKEND_TAG:-latest}
  restart: unless-stopped
  networks:
    - application-network
    - supabase-network
  env_file:
    - .env.{service-name}
```

### Node.js 마이크로서비스

```yaml
ms-{service-name}:
  image: semicolonmanager/ms-{service-name}:${MS_SERVICE_TAG:-latest}
  restart: unless-stopped
  networks:
    - application-network
  env_file:
    - .env.ms-{service-name}
  volumes:
    - ./logs:/app/logs
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:{port}/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

## 참조

- [deploy-master agent](../../agents/deploy-master/deploy-master.md)
- [docker-compose-patterns.md](../../agents/deploy-master/references/docker-compose-patterns.md)
