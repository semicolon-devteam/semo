# lib/

SEMO 대시보드 서버 사이드 헬퍼 모듈. API Routes와 서버 컴포넌트에서만 import한다.

## 모듈별 역할

| 모듈 | 파일 | 의존성 | 설명 |
|------|------|--------|------|
| `db` | `db.ts` | `pg`, `DATABASE_URL` | PostgreSQL 연결 풀 싱글톤 |
| `github` | `github.ts` | `GITHUB_TOKEN`, `GITHUB_REPO` | GitHub API 래퍼 (bot-workspaces) |
| `kb` | `kb.ts` | `db`, `voyage`, `DATABASE_URL` | KB CRUD + 시맨틱 검색 |
| `voyage` | `voyage.ts` | `OPENAI_API_KEY` | OpenAI 임베딩 생성 |
| `openclaw` | `openclaw.ts` | `db` | 봇 세션·크론잡 DB 조회 |
| `constants` | `constants.ts` | - | 경로 헬퍼 함수 |

## Import 경로

```typescript
import { query, transaction } from '@/lib/db';
import { getFileContent, getBotFiles } from '@/lib/github';
import { search, list, upsertItem } from '@/lib/kb';
import { genEmbedding } from '@/lib/voyage';
import { listSessions, listCronJobs } from '@/lib/openclaw';
import { getBotWorkspacePath } from '@/lib/constants';
```

## 주의사항

- 클라이언트 컴포넌트(`'use client'`)에서 lib/* import 금지 — Node.js 전용 모듈 포함
- `lib/kb.ts`는 자체 Pool을 생성함 (lib/db.ts와 별도, 동일 DATABASE_URL 사용)
- `lib/voyage.ts` 파일명은 레거시 네이밍 (실제로는 OpenAI API 사용)
