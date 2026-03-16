# app/

Next.js 14 App Router 디렉토리. 모든 라우트와 API 핸들러가 여기에 위치한다.

## 라우팅 구조

| 경로 | 파일 | renderMode | 설명 |
|------|------|------------|------|
| `/` | `page.tsx` | SSR | `/dashboard` 리다이렉트 |
| `/dashboard` | `dashboard/page.tsx` | CSR | 메인 대시보드 (BotOverview) |
| `/bots` | `bots/page.tsx` | SSR | 봇 팀 전체 목록 |
| `/bots/[botId]` | `bots/[botId]/page.tsx` | CSR | 봇 상세 (Files·Sessions·KB 탭) |
| `/kb` | `kb/page.tsx` | CSR | KB 관리 (검색·CRUD) |

## API Routes

| 경로 | 파일 | 메서드 | 설명 |
|------|------|--------|------|
| `/api/bots` | `api/bots/route.ts` | GET | 전체 봇 목록 |
| `/api/bots/[botId]` | `api/bots/[botId]/route.ts` | GET | 단건 봇 조회 |
| `/api/bots/[botId]/detail` | `api/bots/[botId]/detail/route.ts` | GET | 봇 상세 (세션·크론·파일) |
| `/api/bots/[botId]/files` | `api/bots/[botId]/files/route.ts` | GET | 워크스페이스 루트 목록 |
| `/api/bots/[botId]/files/[...filePath]` | `api/bots/[botId]/files/[...filePath]/route.ts` | GET/PUT | 파일 읽기/쓰기 |
| `/api/kb` | `api/kb/route.ts` | GET/POST/PATCH/DELETE | KB CRUD |
| `/api/kb/search` | `api/kb/search/route.ts` | POST | KB 시맨틱 검색 |

## 규칙

- 서버 컴포넌트(SSR)는 `async` 함수로 데이터를 직접 fetch
- 클라이언트 컴포넌트(CSR)는 `'use client'` 선언 + `useEffect`로 fetch
- API Routes는 모두 `export const dynamic = 'force-dynamic'` (빌드 타임 DB 연결 방지)
