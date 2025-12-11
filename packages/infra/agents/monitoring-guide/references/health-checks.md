# Health Checks

## Docker Compose 헬스체크

### Next.js 서비스

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

### Spring Boot 서비스

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

### Node.js 서비스

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "const http = require('http'); const options = { hostname: 'localhost', port: 3001, path: '/health', timeout: 5000 }; const req = http.request(options, (res) => { res.statusCode === 200 ? process.exit(0) : process.exit(1); }); req.on('error', () => process.exit(1)); req.end();"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

---

## Nginx Upstream 헬스체크

### 패시브 헬스체크

```nginx
upstream backend {
    server backend:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

- `max_fails`: 실패 횟수 임계값
- `fail_timeout`: 실패 후 제외 시간

---

## 헬스 엔드포인트 구현

### Liveness vs Readiness

| 유형 | 용도 | 실패 시 동작 |
|------|------|-------------|
| Liveness | 프로세스 생존 확인 | 컨테이너 재시작 |
| Readiness | 트래픽 수신 가능 확인 | 트래픽 제외 |

### Liveness 엔드포인트

```typescript
// 간단한 생존 확인
app.get('/health/live', (req, res) => {
  res.status(200).send('OK');
});
```

### Readiness 엔드포인트

```typescript
// 의존성 확인 포함
app.get('/health/ready', async (req, res) => {
  try {
    // DB 연결 확인
    await db.ping();
    // 캐시 연결 확인
    await redis.ping();
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

---

## 헬스체크 상태 확인

### Docker 명령어

```bash
# 컨테이너 헬스 상태
docker inspect --format='{{.State.Health.Status}}' {container}

# 상세 헬스 로그
docker inspect --format='{{json .State.Health}}' {container} | jq

# 모든 컨테이너 헬스 상태
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Docker Compose

```bash
# 서비스별 상태
docker compose ps

# JSON 형식
docker compose ps --format json | jq '.[] | {Service, State, Health}'
```

---

## 헬스체크 모범 사례

1. **빠른 응답**: 헬스체크는 1초 이내 응답
2. **경량 로직**: 무거운 연산 피하기
3. **의존성 분리**: 외부 의존성 실패가 전체 헬스 실패로 이어지지 않도록
4. **적절한 간격**: 너무 빈번하면 부하, 너무 드물면 감지 지연
5. **로깅**: 헬스체크 실패 시 로그 기록
