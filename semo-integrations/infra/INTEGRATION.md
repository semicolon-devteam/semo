# SEMO Integration: Infra

> 내부 인프라 도구 (Doppler, LiteLLM, LangFuse, Docker)

**위치**: `semo-integrations/infra/`
**Layer**: Layer 2 (External Connections)

---

## 개요

내부 인프라 및 개발 도구 연동을 제공합니다.

> **Gemini 제안**: Security 도구(Doppler)를 별도 패키지가 아닌 integrations/infra/에 통합

---

## 하위 모듈

| 모듈 | 역할 | 상태 |
|------|------|------|
| **doppler** | 시크릿 관리 | ✅ Active |
| **litellm** | LLM 프록시 | ⏳ Reserved |
| **langfuse** | LLM 추적/분석 | ⏳ Reserved |
| **docker** | Docker Compose | ✅ Active |

---

## Doppler (Active)

### 용도

- 환경 변수 중앙 관리
- 시크릿 안전한 배포
- 환경별 설정 분리 (dev, staging, prod)

### 사용 예시

```bash
# 시크릿 주입하여 실행
doppler run -- npm run dev

# 환경 변수 확인
doppler secrets
```

### 환경 변수

| 변수 | 용도 |
|------|------|
| `DOPPLER_TOKEN` | Doppler API 토큰 |

---

## LiteLLM (Reserved)

### 용도

- LLM API 프록시
- 여러 LLM 제공자 통합
- 비용 추적

### 활성화 조건

> Claude Code는 내부적으로 Anthropic API를 직접 호출하므로 프록시 경유 불가.
> 다음 조건에서 활성화:

- MCP 서버에서 직접 LLM API 호출 시
- 백엔드 애플리케이션에서 LLM 호출 시

### 설정 예시 (활성화 시)

```yaml
# litellm_config.yaml
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY
```

---

## LangFuse (Reserved)

### 용도

- LLM 호출 추적
- 비용 분석
- 프롬프트 버전 관리

### 활성화 조건

LiteLLM과 동일. Claude Code 내부 호출은 추적 불가.

---

## Docker (Active)

### 용도

- 개발 환경 컨테이너화
- 인프라 서비스 구성 (DB, Redis 등)

### 사용 예시

```bash
# 개발 환경 시작
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

---

## ADR 참조

Reserved 결정 상세: [decisions.md](../../.claude/memory/decisions.md) - ADR-002

---

## 참조

- [SEMO Principles](../../semo-core/principles/PRINCIPLES.md)
- [Doppler 문서](https://docs.doppler.com/)
- [LiteLLM 문서](https://docs.litellm.ai/)
