# Logging Patterns

## Nginx 로깅

### 최적화된 로그 포맷

```nginx
# logging-optimized.conf
log_format main '$remote_addr - $remote_user [$time_local] '
                '"$request" $status $body_bytes_sent '
                '"$http_referer" "$http_user_agent" '
                'rt=$request_time uct="$upstream_connect_time" '
                'uht="$upstream_header_time" urt="$upstream_response_time"';

log_format json escape=json '{'
    '"time": "$time_iso8601",'
    '"remote_addr": "$remote_addr",'
    '"request": "$request",'
    '"status": $status,'
    '"body_bytes_sent": $body_bytes_sent,'
    '"request_time": $request_time,'
    '"upstream_response_time": "$upstream_response_time"'
'}';

access_log /var/log/nginx/access.log main;
error_log /var/log/nginx/error.log warn;
```

### 로그 레벨

| 레벨 | 용도 |
|------|------|
| debug | 디버깅 (프로덕션 비권장) |
| info | 정보성 메시지 |
| notice | 주목할 만한 이벤트 |
| warn | 경고 (권장 기본값) |
| error | 에러 |
| crit | 심각한 에러 |

### 조건부 로깅

```nginx
# 헬스체크 로그 제외
map $request_uri $loggable {
    ~*^/health 0;
    ~*^/metrics 0;
    default 1;
}

access_log /var/log/nginx/access.log main if=$loggable;
```

---

## Docker 로깅

### 컨테이너 로그 조회

```bash
# 실시간 로그
docker compose logs -f {service}

# 최근 N줄
docker compose logs --tail=100 {service}

# 타임스탬프 포함
docker compose logs -t {service}

# 특정 시간 이후
docker compose logs --since="2024-01-01T00:00:00" {service}
```

### 로그 볼륨 설정

```yaml
# docker-compose.yml
services:
  app:
    volumes:
      - ./logs:/app/logs
```

### 로그 드라이버

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 애플리케이션 로깅

### Node.js (pino)

```javascript
const pino = require('pino');
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

logger.info({ userId: 123 }, 'User logged in');
logger.error({ err, userId: 123 }, 'Failed to process request');
```

### Spring Boot (logback)

```xml
<!-- logback-spring.xml -->
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE" />
    </root>
</configuration>
```

---

## 구조화된 로깅

### JSON 로그 포맷

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "cm-land",
  "message": "Request processed",
  "context": {
    "requestId": "abc-123",
    "userId": "user-456",
    "duration": 150
  }
}
```

### 필수 필드

| 필드 | 설명 |
|------|------|
| timestamp | ISO 8601 형식 시간 |
| level | 로그 레벨 |
| service | 서비스 이름 |
| message | 로그 메시지 |
| requestId | 요청 추적 ID |

---

## 로그 분석

### 에러 로그 검색

```bash
# 특정 에러 검색
docker compose logs app 2>&1 | grep -i "error"

# 최근 5xx 에러
docker compose logs nginx 2>&1 | grep " 5[0-9][0-9] "

# 느린 요청 (1초 이상)
docker compose logs nginx 2>&1 | grep "rt=[1-9]"
```

### 로그 집계

```bash
# 상태 코드별 집계
docker compose logs nginx 2>&1 | awk '{print $9}' | sort | uniq -c | sort -rn

# 시간대별 요청 수
docker compose logs nginx 2>&1 | awk '{print $4}' | cut -d: -f2 | sort | uniq -c
```

---

## 로그 보관

### 로테이션 설정

```yaml
# docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

### 보관 정책

| 환경 | 보관 기간 | 용량 제한 |
|------|----------|----------|
| dev | 7일 | 100MB |
| stg | 14일 | 500MB |
| prod | 30일 | 2GB |
