# SEMO LiteLLM AI Gateway

> 중앙 집중식 LLM 프록시 - 비용 추적, 속도 제한, 모델 폴백

## 빠른 시작

```bash
# 1. 환경변수 설정
cp .env.example .env
# .env 파일 편집하여 API 키 입력

# 2. 서비스 시작
docker-compose up -d

# 3. 헬스 체크
curl http://localhost:4000/health
```

## 엔드포인트

| URL | 용도 |
|-----|------|
| `http://localhost:4000` | LiteLLM Proxy API |
| `http://localhost:4001` | Admin UI |

## 사용법

### Claude Code에서 사용

```bash
# 환경변수 설정
export ANTHROPIC_API_BASE=http://localhost:4000
export ANTHROPIC_API_KEY=sk-semo-team-key  # LiteLLM에서 발급한 팀 키
```

### 직접 API 호출

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-semo-team-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-default",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## 모델 목록

| 모델명 | 실제 모델 | 용도 |
|--------|----------|------|
| `claude-default` | claude-sonnet-4-20250514 | 일반 작업 |
| `claude-fast` | claude-3-5-haiku-20241022 | 간단한 작업 |
| `claude-advanced` | claude-opus-4-20250514 | 복잡한 추론 |
| `gpt-fallback` | gpt-4o | Claude 장애 시 폴백 |

## 팀별 API 키 발급

Admin UI (`http://localhost:4001`)에서:

1. Keys → Create Key
2. Team 선택 (semo-next, semo-backend 등)
3. 예산 한도 설정
4. 키 발급 후 팀에 전달

## 비용 모니터링

- **대시보드**: Admin UI → Usage
- **Slack 알림**: 예산 80% 도달 시 자동 알림
- **일일 리포트**: 매일 오전 9시 Slack 전송

## 문제 해결

### 서비스 로그 확인
```bash
docker-compose logs -f litellm
```

### 캐시 초기화
```bash
docker-compose exec redis redis-cli FLUSHALL
```

### 완전 재시작
```bash
docker-compose down -v
docker-compose up -d
```
