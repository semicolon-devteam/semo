# SEMO LangFuse 옵저버빌리티

> LLM 호출 추적, 비용 분석, 품질 모니터링

---

## ⚠️ 현재 상태: 보류 (Reserved)

**이 컴포넌트는 현재 SEMO에서 활성화되지 않습니다.**

### 이유

SEMO는 **Claude Code 기반**으로 동작하며:
- Claude Code의 내부 LLM 호출은 추적할 수 없음
- LangFuse SDK를 주입할 수 있는 레이어가 없음

### 활성화 시점

다음 시나리오에서 활성화합니다:
1. **MCP 서버**가 자체적으로 LLM API를 호출하는 기능 추가 시
2. **LiteLLM 프록시** 활성화 후 (LiteLLM → LangFuse 자동 연동)
3. **백엔드 서비스**에서 AI 기능을 직접 구현할 때

### 현재 대안

프롬프트 품질 테스트는 **Promptfoo**를 사용합니다:
```bash
cd ../promptfoo && ./run-eval.sh
```

---

## 개요

LangFuse는 LLM 애플리케이션을 위한 오픈소스 옵저버빌리티 플랫폼입니다.

### 기능

| 기능 | 설명 |
|------|------|
| **트레이싱** | 모든 LLM 호출 기록 및 추적 |
| **비용 분석** | 토큰 사용량, 비용 대시보드 |
| **품질 평가** | 응답 점수화, A/B 테스트 |
| **세션 추적** | 사용자 세션별 대화 흐름 |
| **프롬프트 관리** | 프롬프트 버전 관리 |

## 빠른 시작

```bash
# 1. 환경변수 설정
cp .env.example .env
# .env 편집: NEXTAUTH_SECRET, SALT 설정

# 2. 서비스 시작
docker-compose up -d

# 3. 웹 UI 접속
open http://localhost:3000
```

## 초기 설정

1. **계정 생성**: http://localhost:3000 접속 → Sign Up
2. **프로젝트 생성**: Settings → Projects → New Project
3. **API 키 발급**: Settings → API Keys → Create

## LiteLLM 연동

LangFuse API 키를 LiteLLM에 설정:

```yaml
# infra/litellm/config.yaml
callbacks:
  - "langfuse"

# infra/litellm/.env
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxx
LANGFUSE_HOST=http://langfuse:3000  # Docker 네트워크 내
```

## 대시보드 활용

### 트레이스 분석

```
Traces → 특정 트레이스 클릭
├── 전체 실행 시간
├── 토큰 사용량 (입력/출력)
├── 비용
└── 하위 스팬 (체인, 도구 호출 등)
```

### 비용 모니터링

```
Dashboard → Usage
├── 일별/주별/월별 비용
├── 모델별 사용량
└── 프로젝트별 비용 비교
```

### 품질 평가

```
Traces → 트레이스 선택 → Score
├── 수동 점수 (1-5)
├── 자동 평가 (LLM-as-Judge)
└── 사용자 피드백 연결
```

## 알림 설정

```
Settings → Notifications
├── 일일 비용 요약
├── 오류 알림 (5xx)
└── 비정상 지연 (> 10s)
```

## 데이터 내보내기

```bash
# 트레이스 JSON 내보내기
curl -X GET "http://localhost:3000/api/public/traces" \
  -H "X-Langfuse-Public-Key: pk-lf-xxxxx" \
  -H "X-Langfuse-Secret-Key: sk-lf-xxxxx" \
  > traces.json
```

## 문제 해결

### 서비스 상태 확인
```bash
docker-compose ps
docker-compose logs -f langfuse
```

### 데이터베이스 초기화
```bash
docker-compose down -v
docker-compose up -d
```

## References

- [LangFuse 공식 문서](https://langfuse.com/docs)
- [LiteLLM + LangFuse 연동](https://langfuse.com/docs/integrations/litellm)
