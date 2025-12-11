# LangFuse 관측성 설정 가이드

> SEMO AI 에이전트 동작 가시성 확보를 위한 LangFuse 통합

---

## Overview

LangFuse는 LLM 애플리케이션을 위한 오픈소스 관측성 플랫폼입니다. SEMO 에이전트의 동작을 추적하고 분석할 수 있습니다.

### 핵심 기능

| 기능 | 설명 | 용도 |
|------|------|------|
| **Tracing** | 요청-응답 흐름 추적 | 디버깅, 성능 분석 |
| **Scoring** | 출력 품질 점수화 | 품질 모니터링 |
| **Analytics** | 사용량/비용 대시보드 | 비용 관리 |
| **Prompt Management** | 프롬프트 버전 관리 | A/B 테스트 |

---

## 설정 방법

### 1. LangFuse 계정 설정

**옵션 A: LangFuse Cloud (권장)**

```bash
# https://cloud.langfuse.com 가입
# Project 생성 후 API 키 발급
```

**옵션 B: Self-Hosted**

```bash
# Docker Compose로 로컬 실행
git clone https://github.com/langfuse/langfuse.git
cd langfuse
docker compose up -d
```

### 2. 환경 변수 설정

```bash
# Doppler에 추가 (권장)
doppler secrets set LANGFUSE_PUBLIC_KEY="pk-lf-..."
doppler secrets set LANGFUSE_SECRET_KEY="sk-lf-..."
doppler secrets set LANGFUSE_HOST="https://cloud.langfuse.com"  # 또는 self-hosted URL

# 또는 로컬 환경 변수
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_HOST="https://cloud.langfuse.com"
```

### 3. MCP 설정 (선택적)

`~/.claude.json`에 추가:

```json
{
  "mcpServers": {
    "langfuse": {
      "command": "npx",
      "args": ["-y", "@langfuse/mcp-server"],
      "env": {
        "LANGFUSE_PUBLIC_KEY": "${LANGFUSE_PUBLIC_KEY}",
        "LANGFUSE_SECRET_KEY": "${LANGFUSE_SECRET_KEY}",
        "LANGFUSE_HOST": "${LANGFUSE_HOST}"
      }
    }
  }
}
```

---

## 트레이싱 포인트

### SEMO 트레이싱 구조

```
[SEMO] Orchestrator 요청
├── trace_id: "semo-{uuid}"
├── user_id: "{github_id}"
├── session_id: "{session_uuid}"
│
├── span: "orchestrator"
│   ├── input: 사용자 요청
│   ├── output: 라우팅 결정
│   └── metadata: { package, intent }
│
├── span: "agent/{agent_name}"
│   ├── input: 위임된 작업
│   ├── output: 에이전트 결과
│   └── tool_calls: [ ... ]
│
└── span: "skill/{skill_name}"
    ├── input: 스킬 파라미터
    ├── output: 스킬 결과
    └── duration_ms: 1234
```

### 트레이싱 대상

| 위치 | 트레이스 내용 | 우선순위 |
|------|--------------|----------|
| **Orchestrator** | 요청 라우팅 결정 | HIGH |
| **Agent 실행** | 도구 호출 목록 | HIGH |
| **Skill 실행** | 입력/출력 | MEDIUM |
| **에러 발생** | 스택 트레이스 | HIGH |
| **비용** | 토큰 사용량 | MEDIUM |

---

## 대시보드 구성

### 1. 핵심 메트릭

| 메트릭 | 설명 | 알림 임계값 |
|--------|------|------------|
| **요청 수** | 일일/주간 요청량 | - |
| **평균 레이턴시** | 응답 시간 | >30초 |
| **에러율** | 실패 비율 | >5% |
| **토큰 사용량** | 일일 토큰 소비 | 예산 80% |
| **비용** | 일일/월간 API 비용 | 예산 초과 |

### 2. 대시보드 패널

```
┌─────────────────────────────────────────────────────────────┐
│                    SEMO Observability Dashboard              │
├─────────────────────┬───────────────────────────────────────┤
│  Daily Requests     │  Latency Distribution                 │
│  ████████░░ 847     │  p50: 5.2s  p95: 18.3s  p99: 45.1s  │
├─────────────────────┼───────────────────────────────────────┤
│  Error Rate         │  Top Agents by Usage                  │
│  ██░░░░░░░░ 2.3%    │  1. semo-architect (45%)               │
│                     │  2. code-generator (30%)               │
│                     │  3. bug-fixer (15%)                    │
├─────────────────────┼───────────────────────────────────────┤
│  Token Usage        │  Cost Breakdown                       │
│  Today: 125K        │  Claude: $12.50                       │
│  Week: 890K         │  GPT-4: $0.00                         │
│  Month: 3.2M        │  Total: $12.50                        │
└─────────────────────┴───────────────────────────────────────┘
```

---

## 스코어링 설정

### 자동 스코어링 기준

| 스코어 | 기준 | 범위 |
|--------|------|------|
| **accuracy** | 요구사항 충족도 | 0-1 |
| **latency** | 응답 시간 점수 | 0-1 (낮을수록 좋음) |
| **token_efficiency** | 토큰 대비 품질 | 0-1 |
| **user_feedback** | 사용자 평가 | 0-5 |

### LLM-as-Judge 연동

```yaml
# evaluation/promptfoo.yaml에서 LangFuse로 결과 전송
evaluateOptions:
  callbacks:
    - type: langfuse
      config:
        publicKey: ${LANGFUSE_PUBLIC_KEY}
        secretKey: ${LANGFUSE_SECRET_KEY}
```

---

## 알림 설정

### Slack 통합

```json
{
  "alerts": [
    {
      "name": "High Error Rate",
      "condition": "error_rate > 5%",
      "channel": "#_협업",
      "severity": "HIGH"
    },
    {
      "name": "Budget Warning",
      "condition": "daily_cost > $20",
      "channel": "#_협업",
      "severity": "MEDIUM"
    },
    {
      "name": "Latency Spike",
      "condition": "p95_latency > 60s",
      "channel": "#_협업",
      "severity": "MEDIUM"
    }
  ]
}
```

---

## Feature Flag 연동

LangFuse의 Feature Flag를 통해 기능 점진적 롤아웃:

```markdown
| Flag | 설명 | 기본값 |
|------|------|--------|
| `enable_langfuse_tracing` | 트레이싱 활성화 | false |
| `enable_cost_tracking` | 비용 추적 | false |
| `enable_auto_scoring` | 자동 스코어링 | false |
```

---

## 구현 예시

### Python SDK 사용

```python
from langfuse import Langfuse

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host=os.getenv("LANGFUSE_HOST")
)

# 트레이스 생성
trace = langfuse.trace(
    name="semo-orchestrator",
    user_id=github_id,
    session_id=session_id,
    metadata={"package": "semo-next", "intent": "code_generation"}
)

# 스팬 추가
span = trace.span(
    name="agent/semo-architect",
    input={"task": "컴포넌트 설계"},
    metadata={"model": "claude-sonnet-4-20250514"}
)

# 스팬 완료
span.end(output={"result": "설계 완료"})

# 스코어 추가
trace.score(
    name="accuracy",
    value=0.95,
    comment="요구사항 충족"
)
```

### CLI 사용 (Claude Code 환경)

```bash
# LangFuse CLI로 트레이스 조회
langfuse traces list --limit 10

# 특정 세션 조회
langfuse traces get --id "semo-{uuid}"
```

---

## 도입 단계

### Phase 1: 기본 트레이싱 (현재)

- [ ] LangFuse 계정 생성
- [ ] 환경 변수 설정 (Doppler)
- [ ] Orchestrator 트레이싱 구현

### Phase 2: 스코어링

- [ ] 자동 스코어링 설정
- [ ] LLM-as-Judge 연동
- [ ] 품질 대시보드 구성

### Phase 3: 알림 및 자동화

- [ ] Slack 알림 설정
- [ ] 이상 탐지 룰 추가
- [ ] 자동 롤백 트리거

---

## Troubleshooting

### 트레이스가 보이지 않는 경우

1. API 키 확인
   ```bash
   curl -X GET "https://cloud.langfuse.com/api/public/health" \
     -H "X-Langfuse-Public-Key: $LANGFUSE_PUBLIC_KEY"
   ```

2. 네트워크 연결 확인

3. 버퍼 플러시 확인
   ```python
   langfuse.flush()
   ```

### 비용이 정확하지 않은 경우

- 모델 가격 설정 확인
- 토큰 카운트 정확성 확인

---

## References

- [LangFuse Documentation](https://langfuse.com/docs)
- [LangFuse Python SDK](https://github.com/langfuse/langfuse-python)
- [SEMO 전환 계획](../../.claude/plans/prancy-scribbling-falcon.md)
- [Doppler 보안 설정](../_shared/mcp-config.md)
