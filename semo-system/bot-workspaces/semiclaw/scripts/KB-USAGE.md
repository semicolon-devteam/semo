# KB (Knowledge Base) 사용 가이드

## 개요
팀 공유 지식(knowledge_base)과 봇별 고유 지식(bot_knowledge)을 PostgreSQL + pgvector로 관리.
벡터 유사도 검색(Voyage-3, 1024dim)과 정확 매칭 모두 지원.

## 사전 조건
SSH 터널이 열려 있어야 함:
```bash
bash ~/.openclaw/workspace/scripts/kb-tunnel.sh start
```

## CLI 사용법

모든 명령은 다음 형태:
```bash
cd /Users/reus/Desktop/Sources/semicolon/projects/semo && \
  NODE_PATH=./node_modules node ~/.openclaw/workspace/scripts/kb-cli.js <command> [args...]
```

### 공통 KB (knowledge_base)

| 명령 | 설명 | 예시 |
|---|---|---|
| `search "질문"` | 벡터 유사도 검색 (top 5) | `search "프론트엔드 개발자" 3` |
| `get <domain> <key>` | 정확 매칭 조회 | `get team reus` |
| `list [domain]` | 목록 조회 | `list project` |
| `list-domains` | 도메인 목록 | `list-domains` |
| `upsert <domain> <key> "내용" [작성자]` | 추가/수정 | `upsert team newbie "신규 팀원" workclaw` |
| `stats` | 전체 통계 | `stats` |

### 봇별 KB (bot_knowledge)

| 명령 | 설명 | 예시 |
|---|---|---|
| `bot-search <bot_id> "질문"` | 봇별 벡터 검색 | `bot-search workclaw "코드 스타일"` |
| `bot-get <bot_id> <domain> <key>` | 봇별 정확 매칭 | `bot-get semiclaw config role` |
| `bot-list [bot_id]` | 봇별 목록 | `bot-list workclaw` |
| `bot-upsert <bot_id> <domain> <key> "내용"` | 봇별 추가/수정 | `bot-upsert workclaw learned pr-convention "PR 규칙..."` |

### 도메인 종류
- `team` — 팀원 정보, R&R
- `project` — 프로젝트 현황, 기술 스택
- `decision` — 의사결정 기록
- `process` — 업무 프로세스, 규칙
- `infra` — 인프라 구성, 서버, CI/CD

### 봇별 도메인 (자유)
- `config` — 봇 설정, 역할 정의
- `learned` — 학습한 내용
- `context` — 프로젝트별 컨텍스트

## 출력 형식
모든 출력은 JSON. `jq`로 파싱 가능:
```bash
node kb-cli.js search "배포 규칙" 3 | jq '.[].key'
```

## 임베딩
- upsert 시 자동으로 Voyage-3 임베딩 생성
- Rate limit: 무료 3RPM (빠른 대량 처리 시 주의)
