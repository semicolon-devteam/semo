# Docker Compose Patterns

## 서비스 유형별 템플릿

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
    test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health')"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

## 네트워크 패턴

### 내부 통신 전용

```yaml
networks:
  - application-network
```

### Supabase 연결 필요

```yaml
networks:
  - application-network
  - supabase-network
```

### Office Supabase 연결

```yaml
networks:
  - application-network
  - office-supabase-network
```

---

## 환경변수 패턴

### 서비스별 env 파일

```bash
# .env.{service}
SERVICE_PORT=3000
DATABASE_URL=...
```

### 태그 관리

```bash
# .env.{env}
CM_LAND_TAG=latest
CM_OFFICE_TAG=v1.2.3
CORE_BACKEND_TAG=stg-abc1234
MS_MEDIA_PROCESSOR_TAG=latest
```

---

## 헬스체크 패턴

### HTTP 헬스체크

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:{port}/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

### Node.js 헬스체크

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "const http = require('http'); ..."]
  interval: 30s
  timeout: 10s
  retries: 3
```

---

## 볼륨 패턴

### 로그 볼륨

```yaml
volumes:
  - ./logs:/app/logs
```

### 임시 파일 볼륨

```yaml
volumes:
  - ./src/temp:/app/src/temp
```

### 설정 파일 볼륨

```yaml
volumes:
  - ./config.json:/app/config.json:ro
```
