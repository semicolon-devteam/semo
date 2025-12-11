# SEMO LiteLLM AI Gateway

> 중앙 집중식 LLM 프록시 - 비용 추적, 속도 제한, 모델 폴백

---

## ⚠️ 현재 상태: 보류 (Reserved)

**이 컴포넌트는 현재 SEMO에서 활성화되지 않습니다.**

### 이유

SEMO는 **Claude Code 기반**으로 동작하며, Claude Code는:
- 내부적으로 Anthropic API를 직접 호출
- 커스텀 프록시 엔드포인트 설정을 지원하지 않음

따라서 LiteLLM 프록시를 경유할 수 없습니다.

### 활성화 시점

다음 시나리오에서 활성화합니다:
1. **MCP 서버**가 자체적으로 LLM API를 호출하는 기능 추가 시
2. **백엔드 서비스**에서 AI 기능을 직접 구현할 때
3. **Claude Code 외부**의 커스텀 도구 개발 시

---

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

### ~~Claude Code에서 사용~~ (미지원)

> ⚠️ Claude Code는 커스텀 API 엔드포인트를 지원하지 않습니다.
> 아래 설정은 동작하지 않습니다.

```bash
# ❌ 동작하지 않음
# export ANTHROPIC_API_BASE=http://localhost:4000
# export ANTHROPIC_API_KEY=sk-semo-team-key
```

### 직접 API 호출 (MCP 서버, 백엔드 등)

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
