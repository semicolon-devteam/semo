# Rate Limiting

## 기본 개념

### Zone 정의

```nginx
# rate-limiting.conf

# 일반 API: 초당 10 요청
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# 로그인: 초당 1 요청 (브루트포스 방지)
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

# 업로드: 분당 10 요청
limit_req_zone $binary_remote_addr zone=upload:10m rate=10r/m;

# 전역: 초당 50 요청
limit_req_zone $binary_remote_addr zone=global:10m rate=50r/s;
```

**파라미터 설명**:
- `$binary_remote_addr`: 클라이언트 IP 기반
- `zone=name:size`: Zone 이름과 메모리 크기
- `rate=Nr/s` 또는 `rate=Nr/m`: 초당/분당 요청 수

---

## Zone 적용

### 기본 적용

```nginx
location /api/ {
    limit_req zone=api;
    proxy_pass http://backend;
}
```

### Burst 허용

```nginx
location /api/ {
    # 20개 요청까지 버스트 허용
    limit_req zone=api burst=20;
    proxy_pass http://backend;
}
```

### Nodelay

```nginx
location /api/ {
    # 버스트 요청 즉시 처리 (지연 없음)
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://backend;
}
```

### Delay

```nginx
location /api/ {
    # 10개까지 즉시, 나머지 10개는 지연 처리
    limit_req zone=api burst=20 delay=10;
    proxy_pass http://backend;
}
```

---

## 엔드포인트별 설정

### 로그인/인증

```nginx
location /api/auth/login {
    limit_req zone=login burst=5 nodelay;
    proxy_pass http://backend;
}

location /api/auth/register {
    limit_req zone=login burst=3 nodelay;
    proxy_pass http://backend;
}
```

### 파일 업로드

```nginx
location /api/upload {
    limit_req zone=upload burst=5 nodelay;
    client_max_body_size 50M;
    proxy_pass http://backend;
}
```

### 검색 API

```nginx
location /api/search {
    limit_req zone=api burst=10 nodelay;
    proxy_pass http://backend;
}
```

---

## 응답 코드 설정

### 커스텀 에러 코드

```nginx
# 기본값: 503
limit_req_status 429;  # Too Many Requests

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://backend;
}

error_page 429 = @rate_limited;

location @rate_limited {
    add_header Content-Type application/json;
    return 429 '{"error": "Too many requests", "retry_after": 60}';
}
```

---

## 로깅

### Rate Limit 로그

```nginx
# 로그 레벨 설정
limit_req_log_level warn;  # error | warn | notice | info

# 로그 포맷에 rate limit 상태 추가
log_format rate_limit '$remote_addr - $remote_user [$time_local] '
                      '"$request" $status $body_bytes_sent '
                      '"$http_referer" "$http_user_agent" '
                      'rt=$request_time uct="$upstream_connect_time" '
                      'limit_req_status=$limit_req_status';
```

---

## Whitelist

### 특정 IP 제외

```nginx
geo $limit {
    default 1;
    # 내부 네트워크 제외
    10.0.0.0/8 0;
    192.168.0.0/16 0;
    # 특정 IP 제외
    203.0.113.50 0;
}

map $limit $limit_key {
    0 "";
    1 $binary_remote_addr;
}

limit_req_zone $limit_key zone=api:10m rate=10r/s;
```

---

## 연결 수 제한

### limit_conn

```nginx
# 연결 수 제한 zone
limit_conn_zone $binary_remote_addr zone=conn:10m;

location /download/ {
    # IP당 최대 5개 동시 연결
    limit_conn conn 5;
    limit_conn_status 429;
}
```

---

## 권장 설정

### 프로덕션 기본값

```nginx
# rate-limiting.conf
limit_req_zone $binary_remote_addr zone=global:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=upload:10m rate=5r/m;

limit_req_status 429;
limit_req_log_level warn;
limit_conn_zone $binary_remote_addr zone=conn:10m;
```

### 서버 블록 적용

```nginx
server {
    # 전역 rate limit
    limit_req zone=global burst=100 nodelay;
    limit_conn conn 50;

    location /api/auth/ {
        limit_req zone=auth burst=10 nodelay;
    }

    location /api/ {
        limit_req zone=api burst=30 nodelay;
    }
}
```
