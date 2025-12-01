# Nginx Patterns

## Upstream 패턴

### 단일 서버

```nginx
upstream land-backend {
    server land-backend:8080;
    keepalive 32;
}
```

### 다중 서버 (로드밸런싱)

```nginx
upstream api-cluster {
    least_conn;
    server api-1:8080 weight=3;
    server api-2:8080 weight=2;
    server api-backup:8080 backup;
    keepalive 64;
}
```

### 헬스체크

```nginx
upstream backend {
    server backend:8080;
    keepalive 32;

    # Passive health check
    # 실패 시 30초 동안 제외
    server backend:8080 max_fails=3 fail_timeout=30s;
}
```

---

## Server Block 패턴

### Next.js 서비스

```nginx
server {
    listen 80;
    server_name land.example.com;

    location / {
        proxy_pass http://cm-land:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### API Backend

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://land-backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Supabase Proxy

```nginx
server {
    listen 80;
    server_name supabase.example.com;

    location / {
        proxy_pass http://kong:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /storage/ {
        proxy_pass http://storage:5000/;
        client_max_body_size 50M;
    }
}
```

---

## Location 패턴

### 정적 파일 캐싱

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### API Rate Limiting

```nginx
location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://backend;
}
```

### WebSocket 지원

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

### Health Check Endpoint

```nginx
location /health {
    access_log off;
    return 200 "OK";
    add_header Content-Type text/plain;
}
```

---

## Include 패턴

### 공통 설정 재사용

```nginx
# main server block
server {
    listen 80;
    server_name example.com;

    include /etc/nginx/conf.d/security-headers.conf;
    include /etc/nginx/conf.d/cloudflare-realip.conf;

    location / {
        proxy_pass http://backend;
    }
}
```

---

## SSL/TLS 패턴

### HTTPS 리다이렉트

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

### SSL 서버

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```
