# SEMO Infrastructure

> AI 에이전트 인프라 - Promptfoo + RAG + (향후) LiteLLM/LangFuse

## 현재 사용 패턴

SEMO는 **Claude Code 기반**으로 동작합니다:

```
┌─────────────────────────────────────────────────────────────┐
│                    SEMO 현재 아키텍처                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   개발자 ──► Claude Code ──► Anthropic API (내부 처리)       │
│                  │                                           │
│                  └─► .claude/ Agent/Skill 실행               │
│                                                              │
│   ⚠️ Claude Code는 자체적으로 Anthropic API를 호출하며,       │
│      외부 프록시(LiteLLM) 경유를 지원하지 않습니다.            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 컴포넌트 상태

| 컴포넌트 | 상태 | 용도 | Claude Code 호환 |
|----------|------|------|-----------------|
| **Promptfoo** | ✅ 활성 | Agent/Skill 프롬프트 품질 테스트 | ✅ 오프라인 테스트 |
| **Qdrant RAG** | ✅ 활성 | PR 피드백 수집 및 Few-shot 학습 | ✅ 독립 동작 |
| **LiteLLM** | ⏳ 보류 | AI Gateway, 비용 관리 | ❌ Claude Code 미지원 |
| **LangFuse** | ⏳ 보류 | LLM 호출 추적, 옵저버빌리티 | ❌ Claude Code 미지원 |

### LiteLLM/LangFuse가 보류인 이유

Claude Code는 내부적으로 Anthropic API를 직접 호출하며, 커스텀 프록시 엔드포인트를 지원하지 않습니다. 따라서:

- ❌ LiteLLM 프록시를 경유할 수 없음
- ❌ LangFuse로 Claude Code 호출을 추적할 수 없음

### 향후 활성화 시나리오

LiteLLM/LangFuse가 필요해지는 경우:

1. **MCP 서버에서 직접 LLM API 호출 시**
   - `@semicolon/semo-mcp`가 자체적으로 Claude/GPT API 호출
   - 이 경우 LiteLLM 프록시 경유 가능

2. **백엔드 서비스에서 AI 기능 추가 시**
   - API 서버가 직접 LLM 호출
   - 비용 추적, 모델 폴백 필요

3. **커스텀 AI 도구 개발 시**
   - Claude Code 외부에서 동작하는 도구

---

## 현재 사용 가능한 인프라

### 1. Promptfoo (품질 평가) ✅

Agent/Skill 프롬프트의 품질을 자동으로 테스트합니다.

```bash
cd promptfoo

# 평가 실행
./run-eval.sh

# 빠른 평가 (Haiku만)
./run-eval.sh --quick

# 결과 보기
./run-eval.sh --view
```

**측정 지표:**
- Pass@k: k번 시도 중 성공 확률
- LLM-as-Judge: LLM이 품질 평가

### 2. Qdrant RAG (피드백 학습) ✅

GitHub PR 코멘트를 수집하여 Few-shot 학습에 활용합니다.

```bash
cd rag

# Qdrant 시작
docker-compose up -d

# 수동 인덱싱
docker-compose exec rag-indexer python index_feedback.py
```

**기능:**
- PR 리뷰 코멘트 자동 수집
- 피드백 카테고리 분류 (security, performance, testing 등)
- 유사 피드백 검색 (Few-shot 프롬프트 생성)

---

## 향후 확장용 인프라 (보류)

### LiteLLM + LangFuse

MCP 서버 확장 또는 백엔드 AI 기능 추가 시 활성화합니다.

```bash
# 전체 스택 실행 (향후)
docker-compose -f docker-compose.full.yaml up -d
```

| 서비스 | URL | 용도 |
|--------|-----|------|
| LiteLLM API | http://localhost:4000 | AI Gateway |
| LiteLLM Admin | http://localhost:4001 | 관리 대시보드 |
| LangFuse | http://localhost:3000 | 옵저버빌리티 |

---

## 디렉토리 구조

```
infra/
├── README.md                 # 이 파일
├── .env.example              # 환경변수 템플릿
│
├── promptfoo/                # ✅ 활성 - 품질 평가
│   ├── promptfooconfig.yaml
│   ├── run-eval.sh
│   └── README.md
│
├── rag/                      # ✅ 활성 - PR 피드백 학습
│   ├── docker-compose.yaml
│   ├── indexer/
│   └── README.md
│
├── litellm/                  # ⏳ 보류 - AI Gateway
│   ├── config.yaml
│   ├── docker-compose.yaml
│   └── README.md
│
├── langfuse/                 # ⏳ 보류 - 옵저버빌리티
│   ├── docker-compose.yaml
│   └── README.md
│
└── docker-compose.full.yaml  # ⏳ 보류 - 통합 스택
```

---

## 빠른 시작

### 현재 사용 가능한 컴포넌트만 실행

```bash
cd infra

# 1. Promptfoo 품질 테스트
cd promptfoo && ./run-eval.sh

# 2. RAG 피드백 수집
cd ../rag && docker-compose up -d
```

### 향후 전체 스택 실행 (MCP 서버 확장 시)

```bash
cd infra

# 환경변수 설정
cp .env.example .env
# .env 편집

# 전체 스택 실행
docker-compose -f docker-compose.full.yaml up -d
```

---

## FAQ

### Q: Claude Code에서 LiteLLM을 사용할 수 있나요?

**A: 아니오.** Claude Code는 Anthropic API를 내부적으로 직접 호출하며, 커스텀 엔드포인트나 프록시 설정을 지원하지 않습니다.

### Q: 그럼 LiteLLM/LangFuse는 왜 있나요?

**A:** 향후 확장을 위해 준비해둔 것입니다:
- MCP 서버가 자체적으로 LLM API를 호출하는 기능 추가 시
- 백엔드 서비스에서 AI 기능을 구현할 때
- Claude Code 외부의 커스텀 도구 개발 시

### Q: 지금 당장 사용할 수 있는 것은?

**A:**
- **Promptfoo**: Agent/Skill 프롬프트 품질 테스트
- **Qdrant RAG**: PR 피드백 수집 및 Few-shot 학습
