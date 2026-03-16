# app/api/bots/

Bot API 엔드포인트. `semo.bot_status` 테이블과 GitHub API를 데이터 소스로 사용한다.

## 엔드포인트 목록

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/bots` | GET | 전체 봇 목록 (Bot[]) |
| `/api/bots/:botId` | GET | 단건 봇 조회 (Bot + syncedAt) |
| `/api/bots/:botId/detail` | GET | 봇 상세 (BotDetail: config·files·memory·activity) |
| `/api/bots/:botId/files` | GET | 워크스페이스 루트 디렉토리 목록 |
| `/api/bots/:botId/files/:filePath` | GET | 파일/디렉토리 콘텐츠 조회 (sha 포함) |
| `/api/bots/:botId/files/:filePath` | PUT | 파일 업데이트 (SHA 기반 충돌 방지) |

## 데이터 흐름

```
GET /api/bots
  → semo.bot_status (DB, primary)
  → GitHub IDENTITY.md (name/emoji/role 없을 때 폴백)
  → DB 업데이트 (비동기, 옵션)

GET /api/bots/:botId/detail
  → semo.bot_sessions (DB, Step 1)
  → semo.bot_cron_jobs (DB, Step 2)
  → GitHub SOUL/AGENTS/USER.md (Step 3)
  → GitHub workspace files (Step 4)
  → GitHub memory/decisions.md, team.md (Step 5)
  → GitHub memory/YYYY-MM-DD.md × 3 (Step 6)
```

## 주의사항

- 모든 routes: `export const dynamic = 'force-dynamic'` 필수
- 파일 API: 봇 ID는 `[a-zA-Z0-9_-]` 패턴만 허용 (경로 주입 방지)
- 파일 쓰기: SHA 일치 확인 필수 (GitHub API 요구사항)
