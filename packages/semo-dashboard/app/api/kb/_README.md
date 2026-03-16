# app/api/kb/

Knowledge Base API 엔드포인트. `semo.knowledge_base`(팀 KB)와 `semo.bot_knowledge`(봇별 KB)를 관리한다.

## 엔드포인트 목록

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/kb` | GET | KB 목록·통계·도메인 조회 (action/search/domain/bot_id 파라미터) |
| `/api/kb` | POST | KB 항목 생성 |
| `/api/kb` | PATCH | KB 항목 업데이트 |
| `/api/kb` | DELETE | KB 항목 삭제 |
| `/api/kb/search` | POST | KB 시맨틱 검색 (Voyage-3 임베딩 + pgvector) |

## GET /api/kb 쿼리 파라미터

| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `action=stats` | 전체 KB 통계 반환 | `?action=stats` |
| `action=domains` | 도메인 목록 반환 | `?action=domains` |
| `search=<텍스트>` | 시맨틱 검색 (최대 20건) | `?search=배포` |
| `domain=<도메인>` | 도메인 필터 | `?domain=process` |
| `bot_id=<봇ID>` | 봇 KB 필터 | `?bot_id=workclaw` |
| `key=<키>&domain=<도메인>` | 단건 조회 | `?domain=rules&key=git-flow` |

## 시맨틱 검색 흐름

```
POST /api/kb/search { query, limit?, bot_id? }
  → genEmbedding(query)  // OpenAI text-embedding-3-small 1024d
  → pgvector <=> (코사인 거리)
  → KBItem[] (similarity_pct 포함)
```

## 주의사항

- `GET /api/kb`와 `POST /api/kb/search` 모두 시맨틱 검색 지원 (`search` 파라미터 vs body)
- bot_id 지정 시 `semo.bot_knowledge` 테이블 조회, 미지정 시 `semo.knowledge_base`
- upsert 기준: `(domain, key)` unique constraint
