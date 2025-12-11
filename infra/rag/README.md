# SEMO Self-Learning RAG

> PR 피드백 기반 자동 학습 시스템

## 개요

GitHub PR 리뷰 코멘트를 수집하여 벡터 DB에 저장하고,
유사한 코드 패턴 발견 시 과거 피드백을 Few-shot 예제로 활용합니다.

### 동작 방식

```
┌─────────────────────────────────────────────────────────┐
│                   Self-Learning RAG                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. 수집                                                 │
│     GitHub PR Comments ──────► RAG Indexer               │
│                                    │                     │
│  2. 분류 & 인덱싱                     │                     │
│     LLM Classification ◄───────────┘                     │
│            │                                             │
│            ▼                                             │
│     Qdrant Vector DB                                     │
│                                                          │
│  3. 검색 & 활용                                           │
│     New Code ──► Similarity Search ──► Few-shot Prompt  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 빠른 시작

```bash
# 1. 환경변수 설정
export GITHUB_TOKEN=ghp_xxxxx
export ANTHROPIC_API_KEY=sk-ant-xxxxx

# 2. 서비스 시작
docker-compose up -d

# 3. 수동 인덱싱 실행
docker-compose exec rag-indexer python index_feedback.py
```

## 피드백 카테고리

| 카테고리 | 설명 | 심각도 |
|----------|------|--------|
| security | SQL Injection, XSS, 비밀키 노출 | HIGH |
| performance | N+1 쿼리, 캐싱 누락, 최적화 | MEDIUM |
| testing | 테스트 누락, 모킹, 커버리지 | MEDIUM |
| code-quality | 네이밍, 가독성, 구조 | LOW |
| documentation | 주석, README, JSDoc | LOW |
| style | 코드 스타일, 포맷팅 | LOW |

## API 사용

### 유사 피드백 검색

```python
from qdrant_client import QdrantClient

client = QdrantClient(url="http://localhost:6333")

# 코드에서 임베딩 생성 후 검색
results = client.search(
    collection_name="semo-feedback",
    query_vector=embedding,
    limit=5,
    query_filter={
        "must": [
            {"key": "category", "match": {"value": "security"}}
        ]
    }
)

# Few-shot 프롬프트 생성
for result in results:
    print(f"과거 피드백: {result.payload['body']}")
    print(f"코드 컨텍스트: {result.payload['diff_hunk']}")
```

### REST API

```bash
# 컬렉션 정보
curl http://localhost:6333/collections/semo-feedback

# 포인트 조회
curl "http://localhost:6333/collections/semo-feedback/points/scroll" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

## 수집 대상 레포

현재 다음 레포에서 PR 코멘트를 수집합니다:

- semicolon-devteam/sax-core
- semicolon-devteam/sax-next
- semicolon-devteam/sax-backend
- semicolon-devteam/sax-po
- semicolon-devteam/sax-qa

## 인덱싱 주기

- **자동**: 1시간마다
- **수동**: `docker-compose exec rag-indexer python index_feedback.py`

## 모니터링

```bash
# Qdrant 대시보드
open http://localhost:6333/dashboard

# 컬렉션 통계
curl http://localhost:6333/collections/semo-feedback | jq

# 인덱서 로그
docker-compose logs -f rag-indexer
```

## 향후 개선

- [ ] Claude Embedding API 연동 (현재: 해시 기반)
- [ ] 증분 인덱싱 (현재: 전체 스캔)
- [ ] 피드백 품질 점수화
- [ ] Agent 자동 연동
