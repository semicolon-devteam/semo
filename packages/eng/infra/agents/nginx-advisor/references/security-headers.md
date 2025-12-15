# Security Headers

## 필수 보안 헤더

### security-headers.conf

```nginx
# XSS 보호
add_header X-XSS-Protection "1; mode=block" always;

# MIME 타입 스니핑 방지
add_header X-Content-Type-Options "nosniff" always;

# Clickjacking 방지
add_header X-Frame-Options "SAMEORIGIN" always;

# Referrer 정책
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# 권한 정책
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

---

## HSTS (HTTP Strict Transport Security)

```nginx
# HTTPS 강제 (1년)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Preload 포함 (HSTS preload list 등록 시)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

---

## CSP (Content Security Policy)

### 기본 CSP

```nginx
add_header Content-Security-Policy "default-src 'self';" always;
```

### Next.js 호환 CSP

```nginx
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self' data:;
    connect-src 'self' https://api.example.com wss://;
    frame-ancestors 'self';
" always;
```

### 리포트 전용 CSP

```nginx
add_header Content-Security-Policy-Report-Only "
    default-src 'self';
    report-uri /csp-report;
" always;
```

---

## CORS 헤더

### 특정 Origin 허용

```nginx
add_header Access-Control-Allow-Origin "https://example.com" always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
add_header Access-Control-Allow-Credentials "true" always;
```

### Preflight 처리

```nginx
location /api/ {
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin "https://example.com";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
        add_header Access-Control-Max-Age 86400;
        add_header Content-Length 0;
        return 204;
    }
}
```

---

## Cloudflare Real IP

### cloudflare-realip.conf

```nginx
# Cloudflare IPv4
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;

# Cloudflare IPv6
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

real_ip_header CF-Connecting-IP;
```

---

## 주의사항

1. **테스트 필수**: 새 헤더 추가 시 기능 테스트
2. **CSP 점진적 적용**: Report-Only 모드로 먼저 테스트
3. **HSTS 주의**: 활성화 후 롤백 어려움
4. **CORS 최소화**: 필요한 Origin만 허용
