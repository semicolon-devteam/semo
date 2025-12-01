# scaffold-nginx

> Nginx vhost/upstream 생성 Skill

## 개요

Nginx 설정 파일(upstream, server block)을 생성합니다.

## 트리거

- "nginx 설정 추가해줘"
- "upstream 생성"
- "vhost 만들어줘"

## 입력 파라미터

| 파라미터 | 필수 | 설명 | 예시 |
|----------|------|------|------|
| service_name | ✅ | 서비스 이름 | `ms-notification` |
| port | ✅ | 서비스 포트 | `3000`, `8080` |
| environment | ✅ | 환경 | `dev`, `stg` |
| domain | ❌ | 도메인 (선택) | `notification.example.com` |
| type | ❌ | 설정 유형 | `upstream`, `vhost`, `both` |

## 실행 절차

### 1. 환경별 디렉토리 확인

```bash
gh api repos/semicolon-devteam/core-compose/contents/nginx/{env}/conf.d \
  --jq '.[].name'
```

### 2. 설정 파일 생성

- Upstream만: `{service}-upstream.conf`
- Vhost만: `{service}.conf`
- 둘 다: `{service}.conf` (upstream + server 포함)

### 3. 검증

```bash
docker-compose run --rm webserver nginx -t
```

## 출력

```markdown
[SAX] scaffold-nginx: 완료

✅ **Nginx 설정 생성 완료**

파일: `nginx/{env}/conf.d/{service}.conf`

### 추가된 설정
- Upstream: `{service}-backend`
- Server: `{domain}` (선택)

### 다음 단계
1. `skill:verify-nginx` → 설정 검증
2. 배포 후 라우팅 테스트
```

## 템플릿

### Upstream 전용

```nginx
# {service}-upstream.conf
upstream {service}-backend {
    server {service}:{port};
    keepalive 32;
}
```

### Vhost (내부 서비스)

```nginx
# {service}.conf
upstream {service}-backend {
    server {service}:{port};
    keepalive 32;
}

server {
    listen 80;
    server_name {service}.internal;

    location / {
        proxy_pass http://{service}-backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        access_log off;
        proxy_pass http://{service}-backend/health;
    }
}
```

### Vhost (외부 서비스)

```nginx
# {service}.conf
upstream {service}-backend {
    server {service}:{port};
    keepalive 32;
}

server {
    listen 80;
    server_name {domain};

    include /etc/nginx/conf.d/security-headers.conf;
    include /etc/nginx/conf.d/cloudflare-realip.conf;

    location / {
        proxy_pass http://{service}-backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 지원 (필요 시)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        access_log off;
        proxy_pass http://{service}-backend/health;
    }
}
```

### API Backend

```nginx
# {service}-backend.conf
upstream {service}-api {
    server {service}:{port};
    keepalive 32;
}

server {
    listen 80;
    server_name api.{domain};

    include /etc/nginx/conf.d/security-headers.conf;
    include /etc/nginx/conf.d/rate-limiting.conf;

    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://{service}-api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /actuator/health {
        access_log off;
        proxy_pass http://{service}-api/actuator/health;
    }
}
```

## 참조

- [nginx-advisor agent](../../agents/nginx-advisor/nginx-advisor.md)
- [nginx-patterns.md](../../agents/nginx-advisor/references/nginx-patterns.md)
