# SEMO Infrastructure

> AI 에이전트 인프라 - LiteLLM + LangFuse + Promptfoo

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      SEMO Infrastructure                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│   │  Claude     │────►│  LiteLLM    │────►│  LangFuse   │  │
│   │  Code       │     │  Gateway    │     │  Observ.    │  │
│   └─────────────┘     └──────┬──────┘     └─────────────┘  │
│                              │                              │
│                              ▼                              │
│                    ┌─────────────────┐                     │
│                    │   Anthropic     │                     │
│                    │   OpenAI        │                     │
│                    │   (Fallback)    │                     │
│                    └─────────────────┘                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 컴포넌트

| 컴포넌트 | 포트 | 용도 |
|----------|------|------|
| LiteLLM Proxy | 4000 | AI Gateway, 비용 관리 |
| LiteLLM UI | 4001 | 관리 대시보드 |
| LangFuse | 3000 | 옵저버빌리티 |
| PostgreSQL x2 | - | LiteLLM/LangFuse DB |
| Redis | - | 캐싱 |

## 빠른 시작

### 전체 스택 실행

```bash
cd infra

# 1. 환경변수 설정
cp .env.example .env
# .env 편집

# 2. 전체 스택 실행
docker-compose -f docker-compose.full.yaml up -d

# 3. 상태 확인
docker-compose -f docker-compose.full.yaml ps
```

### 개별 컴포넌트 실행

```bash
# LiteLLM만
cd litellm && docker-compose up -d

# LangFuse만
cd langfuse && docker-compose up -d
```

## 접속 URL

| 서비스 | URL |
|--------|-----|
| LiteLLM API | http://localhost:4000 |
| LiteLLM Admin | http://localhost:4001 |
| LangFuse | http://localhost:3000 |

## 초기 설정 순서

1. **LangFuse 계정 생성**
   - http://localhost:3000 → Sign Up
   - 프로젝트 생성 → API 키 발급

2. **LangFuse 키를 .env에 추가**
   ```
   LANGFUSE_PUBLIC_KEY=pk-lf-xxxxx
   LANGFUSE_SECRET_KEY=sk-lf-xxxxx
   ```

3. **LiteLLM 재시작**
   ```bash
   docker-compose -f docker-compose.full.yaml restart litellm
   ```

4. **LiteLLM 팀 키 발급**
   - http://localhost:4001 → Keys → Create

## 디렉토리 구조

```
infra/
├── docker-compose.full.yaml  # 통합 스택
├── .env.example              # 환경변수 템플릿
├── README.md                 # 이 파일
├── litellm/                  # LiteLLM 설정
│   ├── config.yaml
│   ├── docker-compose.yaml
│   └── README.md
├── langfuse/                 # LangFuse 설정
│   ├── docker-compose.yaml
│   └── README.md
└── promptfoo/                # 품질 평가
    ├── promptfooconfig.yaml
    ├── run-eval.sh
    └── README.md
```

## 모니터링

### 비용 확인
- LiteLLM UI → Usage
- LangFuse → Dashboard

### 로그 확인
```bash
docker-compose -f docker-compose.full.yaml logs -f litellm
docker-compose -f docker-compose.full.yaml logs -f langfuse
```

## 문제 해결

### 전체 재시작
```bash
docker-compose -f docker-compose.full.yaml down
docker-compose -f docker-compose.full.yaml up -d
```

### 데이터 초기화
```bash
docker-compose -f docker-compose.full.yaml down -v
docker-compose -f docker-compose.full.yaml up -d
```
