# P4 — Personal 대시보드 실행 계획

> 출처 플랜: `/Users/reus/.claude/plans/planclaw-swirling-clarke.md` (§P4)
> 작성: PlanClaw (2026-04-23)
> 리뷰 대상: ReviewClaw

---

## 1. 현황 분석

기존 `packages/semo-dashboard` 는 Next.js 16 + pg 직접 연결. **pg 직접 사용은 딱 2개 파일**에 격리돼 있어 분리 난이도 낮음.

- **pg 의존 격리 지점 (모두 lib 레이어 서버 전용)**:
  - `packages/semo-dashboard/lib/db.ts:8,18` — `Pool` import + `getPool()` 싱글톤
  - `packages/semo-dashboard/lib/core/kb.ts:6,49` — 별도 `Pool` 인스턴스, voyage 임베딩
  - 그 외 `lib/core/action-items.ts`, API route (`app/api/*`) 는 모두 `query()` wrapper 경유 → Store 인터페이스로 교체 가능
- **컴포넌트 pg 무의존 확인**: `grep 'from .pg.\|@/lib/db'` → `components/action-items/*`, `BotCard`, `DomainCard`, `action-items/useActionItems.ts` 모두 0 hits. **순수 React + fetch**
- **재사용 가능 컴포넌트** (LOC):
  - `components/action-items/` (782 LOC) — Card/Form/Kanban/List/Timeline + `useActionItems` 훅
  - `components/BotCard.tsx` (63), `components/DomainCard.tsx` (42), `components/LayerModal.tsx`
  - `app/kb/page.tsx` (도메인/엔트리 2탭), `app/bots/page.tsx`, `app/action-items/page.tsx`
- **기존 Solo 자산** (이미 구축돼 있음, 재활용 필수):
  - `packages/kb-core/src/adapters/sqlite/sqlite-kb-store.ts` — FTS5 + 폴링 watch
  - `packages/ops-store/src/adapters/sqlite/sqlite-ops-store.ts` — `bot_commitments`, seats, cron
  - `packages/cli/src/config/store-factory.ts` — 프로파일→Store 팩토리
  - `packages/cli-solo/src/index.ts` — `semo-solo` 참고 구현
  - `packages/cli/src/commands/deploy.ts` — `semo deploy local` 이미 존재

**핵심 갭 1건**: `semo.action_items` 테이블이 SQLite ops-store 에 **미정의**. 현 `packages/cli/src/commands/action-items.ts` 는 PG `getPool()` 하드코딩. → P4.2 착수 전 ops-store 에 `action_items` 스키마 추가 필요 (별도 선행 PR).

---

## 2. P4.1 상세 계획 — 패키지 분리

### 2.1 디렉토리 구조

```
packages/semo-dashboard-personal/
├── package.json                    # next, react, better-sqlite3. pg 미포함
├── next.config.ts                  # standalone output, telemetry off
├── tsconfig.json
├── app/
│   ├── layout.tsx                  # PersonalNav (간소화 — auth 없음)
│   ├── page.tsx                    # 홈 (KB/봇/AI 요약 3카드)
│   ├── kb/page.tsx                 # @dashboard-ui 의 KBBrowser 렌더
│   ├── bots/page.tsx               # BotStatusList
│   ├── action-items/page.tsx       # ActionItemsPage
│   └── api/
│       ├── kb/{list,get,search}/route.ts
│       ├── bots/route.ts
│       └── action-items/route.ts
├── lib/
│   ├── store.ts                    # getKbStore() / getOpsStore() 싱글톤 (SEMO_HOME 기반)
│   ├── bot-scan.ts                 # ~/.semo/workspaces/ 파일 스캔
│   └── config.ts                   # loadProfile() 래퍼
└── public/

packages/dashboard-ui/              # 신규 공유 패키지 (workspace)
├── package.json                    # peer: react, react-dom
├── src/
│   ├── index.ts                    # 공개 export
│   ├── action-items/               # ActionItemCard/Form/Kanban/List/Timeline/useActionItems
│   ├── kb/                         # DomainCard, LayerModal, KBBrowser (app/kb/page.tsx 에서 추출)
│   ├── bots/                       # BotCard, BotList
│   └── common/                     # 공통 타입 (ActionItem, KBEntry, Bot 등)
```

### 2.2 공유 UI 분리 전략

**권장: 별도 `packages/dashboard-ui/` 워크스페이스 패키지로 추출**. 심볼릭 import (`../../semo-dashboard/components/...`) 는 거부.

근거:

- Team(`semo-dashboard`) 과 Personal(`semo-dashboard-personal`) 이 **데이터 소스만 다르고 UI/UX 는 동일**. Next.js App Router 특성상 `'use client'` 컴포넌트는 packages 간 tsconfig paths 로 안전하게 import 가능
- 추후 모바일/Electron 확장 시 동일 패키지 재사용
- 심볼릭 import 는 빌드 순서/트리셰이킹에서 문제. workspace 패키지가 npm publish 전환 시에도 단순

**경계**: UI 패키지는 **Store 인터페이스에 의존하지 않는다**. 부모 Next.js 앱이 `'use server'` 데이터 패칭 후 prop 으로 주입. UI 는 `fetch('/api/...')` 만 호출.

### 2.3 package.json 핵심

```jsonc
// packages/semo-dashboard-personal/package.json
{
  "name": "@team-semicolon/semo-dashboard-personal",
  "private": true,
  "dependencies": {
    "@team-semicolon/semo-kb-core": "*",
    "@team-semicolon/semo-ops-store": "*",
    "@team-semicolon/dashboard-ui": "*",
    "@team-semicolon/semo-common": "*",
    "better-sqlite3": "^11.0.0",
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "smol-toml": "^1.6.1",
  },
  // pg, @types/pg, @supabase/*, pixi.js, mermaid 모두 제외
}
```

`npm ls pg --workspace @team-semicolon/semo-dashboard-personal` → 0 hits 가 검증 기준.

### 2.4 PR 단위 (3개 분할 권장, 큰 1개 반대)

| PR       | 범위                                                                                             | 디프 추정                       | 머지 기준                                                     |
| -------- | ------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------- |
| **PR-A** | `packages/dashboard-ui/` 신규 + 기존 `semo-dashboard` 가 UI 패키지 소비하도록 리팩터 (동작 동일) | ~1,200 LOC 이동 + tsconfig path | Team 대시보드 playwright e2e grn, `npm run build` 통과        |
| **PR-B** | `packages/semo-dashboard-personal/` 스캐폴드 (빈 페이지 + api stub + `lib/store.ts`)             | ~400 LOC 신규                   | `npm run build` 통과, `npm ls pg` 0, `next dev` 로 로컬 구동  |
| **PR-C** | `packages/cli/src/commands/dashboard.ts` 신규 — `semo dashboard --local` 로 PR-B 기동            | ~150 LOC                        | `semo dashboard --local` → localhost:3939 에서 빈 페이지 렌더 |

큰 1개 PR 반대 이유: PR-A 만으로도 Team 대시보드에 regression 리스크. UI 추출과 Personal 패키지 작성을 섞으면 roll-back 어려움.

---

## 3. P4.2 상세 계획 — 최소 기능

### 3.1 데이터 소스 매트릭스

| 페이지            | 데이터 소스                                                                               | 구현 위치                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `/kb` (도메인 탭) | `SqliteKbStore.list(undefined)` → domain 집계                                             | `app/api/kb/domains/route.ts` — `getKbStore().list()` 후 서버에서 GROUP BY |
| `/kb` (엔트리 탭) | `SqliteKbStore.list(domain?, botId?)`                                                     | `app/api/kb/list/route.ts`                                                 |
| `/kb` 상세 모달   | `SqliteKbStore.get(domain, key, subKey)`                                                  | `app/api/kb/get/route.ts`                                                  |
| `/kb` 검색        | `SqliteKbStore.search(q, { topK })`                                                       | `app/api/kb/search/route.ts`                                               |
| `/bots` 목록      | **파일 스캔** `~/.semo/workspaces/{botId}/` — `IDENTITY.md` 파싱 + `mtime` 을 last_active | `lib/bot-scan.ts`                                                          |
| `/bots` 메일박스  | `~/.semo/mailbox/{botId}/inbox/`, `outbox/` 카운트                                        | `lib/bot-scan.ts`                                                          |
| `/bots/:id` 세션  | `SqliteOpsStore.listSeats(botId)`                                                         | `app/api/bots/[id]/route.ts`                                               |
| `/action-items`   | **`SqliteOpsStore.listActionItems()`** — **선행: ops-store schema 확장 필요**             | `app/api/action-items/route.ts`                                            |

### 3.2 KB 열람 구현 방침

- **경로**: `loadProfile()` → `config.kb.sqlite.path` (기본 `${SEMO_HOME}/kb.db`, `SEMO_HOME` 미설정 시 `~/.semo`)
- **싱글톤**: `lib/store.ts` 가 프로세스당 1개 `SqliteKbStore` 유지. dev reload 에 대비해 `globalThis` 캐시
- **검색**: Personal 기본은 FTS5 only (noop embedding). `config.embedding.provider='ollama'` 면 `OllamaEmbeddingProvider` 로 주입 (store-factory 재사용)
- **쓰기 금지**: Personal 대시보드 MVP 는 **read-only**. 수정은 `semo kb upsert` CLI 로. 버튼은 `copy-to-clipboard` 의 CLI 커맨드 힌트만 제공. (이유: 로컬 단일 사용자지만 conflict/watch 를 끌어들이면 MVP 범위 초과)

### 3.3 봇 상태 구현 방침

- **스캔 대상**: `${SEMO_HOME}/workspaces/{botId}/` 디렉토리 열거
  - `IDENTITY.md` → name/emoji/role (기존 `parseIdentityContent` 재사용)
  - `.last-active` 파일 or 워크스페이스 최신 mtime → last_active
  - `${SEMO_HOME}/mailbox/{botId}/inbox/*.json` 개수 → pending
- **온라인 판정**: last_active < 5분 = online. (Personal 은 seat=1 가정)
- **PG 의존 제거**: Team 의 `SELECT FROM semo.bot_status` 는 **쓰지 않음**. `bot_status` 는 슬랙-라우터가 UPDATE 하는 PG 전용 테이블

### 3.4 액션 아이템 구현 방침

⚠️ **선행 조건 PR (P4.2 시작 전)**: `ops-store` SQLite migrations 에 `action_items` 스키마 추가 + `SqliteOperationalStore.{list,create,update,delete,complete}ActionItem()` 구현. PG 스키마 `semo.action_items` 의 핵심 컬럼만 이식:

```sql
CREATE TABLE action_items (
  action_item_id TEXT PRIMARY KEY,
  owner_domain   TEXT NOT NULL,
  target_domain  TEXT,
  description    TEXT NOT NULL,
  assignee       TEXT,
  deadline       TEXT,      -- ISO date
  status         TEXT NOT NULL DEFAULT 'open',
  priority       TEXT NOT NULL DEFAULT 'normal',
  category       TEXT,
  source         TEXT,
  related_url    TEXT,
  sort_order     INTEGER DEFAULT 0,
  metadata       TEXT,      -- JSON
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  completed_at   TEXT
);
```

그 후 `packages/cli/src/commands/action-items.ts` 를 `loadProfile()` 기반으로 PG/SQLite 분기 (Team 프로파일은 PG, Personal 은 SQLite). **Personal 대시보드는 읽기 + toggle complete 만**. 생성/편집은 CLI.

### 3.5 PR 단위 (4개)

| PR       | 범위                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **PR-D** | ops-store `action_items` schema + `OperationalStore.*ActionItem` 인터페이스 확장 + SQLite 구현 + `semo action-items` CLI 프로파일 분기 |
| **PR-E** | `/kb` 페이지 3개 API + `KBBrowser` 재사용 + 검색                                                                                       |
| **PR-F** | `/bots` 페이지 + `bot-scan.ts` + IDENTITY.md 파싱                                                                                      |
| **PR-G** | `/action-items` 페이지 (read + toggle) + 홈 요약 카드                                                                                  |

---

## 4. P4.3 상세 계획 — 로컬 실행

### 4.1 Electron vs `semo dashboard --local` — **후자 권장**

| 기준          | Electron                             | `semo dashboard --local`                           |
| ------------- | ------------------------------------ | -------------------------------------------------- |
| 번들 크기     | 120MB+                               | 0 (Next.js standalone, better-sqlite3 이미 있음)   |
| 업데이트 경로 | 자체 updater 필요                    | `npm update -g @team-semicolon/semo-cli`           |
| 보안 모델     | BrowserWindow + nodeIntegration 이슈 | localhost-only + loopback bind                     |
| 개발 복잡도   | 메인/렌더러 프로세스 2개, IPC        | Next.js 단독                                       |
| 사용자 경험   | Dock 아이콘, 단독 창                 | 브라우저 탭 — **대부분 사용자 이미 브라우저 상주** |
| 크로스 플랫폼 | electron-builder 매트릭스            | node 18+ 면 끝                                     |

**결정 근거**: P4 는 MVP. Dock 아이콘 가치 < 번들링/업데이트 비용. Personal 사용자는 이미 터미널에서 `semo` 쓰는 프로필. Electron 은 P6 이후 수요 기반 재검토.

### 4.2 실행 플로우

```
$ semo dashboard --local [--port 3939] [--no-open]
  1. loadProfile() — ~/.semo/config.toml 확인 (없으면 semo init 권유하고 exit 1)
  2. profile.kind == 'personal' 강제 (team 이면 경고 + 진행)
  3. Next.js standalone 번들 위치 탐색:
     - 개발: packages/semo-dashboard-personal 로 cwd 이동 후 `next dev --port ${port}`
     - 배포: `node ${installDir}/server.js` (standalone output)
  4. 포트 충돌 시 --port 자동 증가 (3939 → 3940 ...) 3회 retry
  5. 서버 listen 감지 후 `open http://127.0.0.1:${port}` (--no-open 이면 skip)
  6. SIGINT 시 서버 graceful shutdown
```

- **Auth 없음**: `127.0.0.1` 전용 bind. 외부 인터페이스 bind 거부 (안전 기본값). reverse proxy 가 필요하면 명시 flag 요구
- **환경 주입**: `SEMO_HOME`, `DATABASE_URL=` (빈값으로 덮어써 실수로 Team PG 붙는 것 차단), `NODE_ENV=production` (배포) or `development` (dev)
- **로깅**: stdout 에 Next.js 로그 + `semo` 프리픽스 헤더 1줄. 에러는 stderr

### 4.3 `semo deploy local` 통합

기존 `deploy.ts` 플레이북 (init → migrate-sqlite → seats add → doctor) 에 **선택 단계 추가**:

```
deploy local [--with-dashboard]
  ├── init
  ├── migrate-sqlite
  ├── seats add
  ├── doctor
  └── (--with-dashboard) → dashboard --local --no-open & 후 URL 프린트
```

P4.3 에서는 `--with-dashboard` 플래그만 추가. 기본값은 **미포함** — `semo dashboard --local` 는 별도 호출. (이유: 데몬 수명 관리를 deploy 가 떠안지 않게)

### 4.4 PR 단위 (2개)

| PR       | 범위                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **PR-H** | `packages/cli/src/commands/dashboard.ts` — `semo dashboard --local` 구현. Standalone 빌드 경로 탐색 + spawn + open. 테스트: mock spawn |
| **PR-I** | `deploy.ts` 에 `--with-dashboard` 플래그. 문서 업데이트 (`cli/docs/deploy.md`)                                                         |

---

## 5. 리스크 & 가정

### 리스크 Top 3

1. **UI 패키지 추출 시 Team 대시보드 regression** — `semo-dashboard` 가 상당수 컴포넌트를 inline 호출 중. tsconfig path, `'use client'` 지시어, Tailwind content glob 경로가 끊기면 렌더 실패. 완화: PR-A 단독 머지 + playwright full suite 통과 강제
2. **FTS5 한국어 tokenize 품질** — `SqliteKbStore` 기본 FTS5 는 ASCII 토크나이저. 한국어 검색 recall 저하 위험. P2.3 (embedding 통합) 이 선행되지 않으면 Personal 사용자 "검색 안 됨" 불만 가능. 완화: P4.2 MVP 에서는 `LIKE '%query%'` 폴백 결합 + P2.3 과 동시 릴리스
3. **`better-sqlite3` native 모듈 cross-platform 빌드** — Next.js standalone 번들이 native `.node` 파일을 누락하는 이슈 기보고. 완화: `next.config.ts` `serverExternalPackages: ['better-sqlite3']` 지정 + PR-B smoke test 에 `darwin/arm64`, `linux/x64` 2개 확인

### 가정 (unverified — 실행 중 재확인)

- `packages/semo-dashboard` 의 Tailwind v4 content glob 이 monorepo 상대경로로 UI 패키지 소스를 스캔 가능 (`content: ['../dashboard-ui/src/**/*.{tsx,ts}']`). 불가 시 Tailwind v3 재구성 검토
- `SqliteKbStore.list(domain?)` API 는 이미 KbStore 인터페이스에 존재 (kb-core `types.ts` 에서 확인 필요 — 미확인)
- Personal 사용자 기준 KB 엔트리 수 < 10K 가정. `/api/kb/list` 페이지네이션 없이 전체 반환해도 OK. 10K 초과하면 P4 후반에 cursor 추가
- Team `semo-dashboard` 의 `@/types` / `@/lib` path alias 가 UI 패키지 추출 후에도 깨지지 않도록 재매핑 가능

---

## 6. 공수 추정 (PR 개수 기준)

| 페이즈   | PR                                                                              | 추정 공수                                               |
| -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| P4.1     | PR-A (UI 추출) + PR-B (Personal 스캐폴드) + PR-C (dashboard 커맨드 stub)        | **3 PR / 2–3 man-day** (PR-A 가 ~1.5 day, 나머지 0.5씩) |
| P4.2     | PR-D (ops-store action_items) + PR-E (KB) + PR-F (Bots) + PR-G (AI 페이지 + 홈) | **4 PR / 3–4 man-day** (PR-D 가 가장 크고 회귀 영향)    |
| P4.3     | PR-H (dashboard --local) + PR-I (deploy 통합)                                   | **2 PR / 1 man-day**                                    |
| **합계** | **9 PR / 6–8 man-day**                                                          | WorkClaw 1인 기준, ReviewClaw 병렬 리뷰 가정            |

---

## 7. 즉시 착수 가능한 첫 태스크 — **PR-A**

**제목**: `refactor(dashboard): UI 컴포넌트를 @team-semicolon/dashboard-ui 패키지로 추출`

**범위**:

- `packages/dashboard-ui/` 신규 워크스페이스 패키지 생성 (package.json, tsconfig, src/index.ts)
- `packages/semo-dashboard/components/action-items/*`, `BotCard.tsx`, `DomainCard.tsx`, `LayerModal.tsx` → `packages/dashboard-ui/src/` 로 **이동** (복사 아님)
- `packages/semo-dashboard/app/kb/page.tsx` 에서 UI 부분만 `KBBrowser` 컴포넌트로 추출 → UI 패키지로 이동. 데이터 fetch 는 app 에 잔존
- `packages/semo-dashboard/` 의 기존 import path 를 `@team-semicolon/dashboard-ui` 로 갱신
- tsconfig path alias 설정, Tailwind content glob 확장
- root `package.json` workspaces 에 추가

**성공 기준**:

- `npm run build --workspace semo-dashboard` 통과
- `npx playwright test` (기존 e2e) 통과 — KB 페이지, 액션 아이템 페이지, 봇 페이지 전부 시각적 동일
- `rg "from '@/components/action-items" packages/semo-dashboard` → 0 hits
- diff size ~1,200 LOC (대부분 이동, 신규 코드 ~100 LOC)

**왜 첫 태스크인가**: P4 전체의 기반. PR-A 가 merge 되지 않으면 PR-B 이후 전부 블록. 동시에 Team 대시보드에 regression 만 없으면 **가치 중립** (즉시 릴리스 가능, Personal 시작 전에 머지 후 안정화)

---

## ReviewClaw 검토 포인트 3가지

1. **UI 패키지의 경계 강제** — `packages/dashboard-ui/src/**` 에서 `'pg'`, `'@/lib/db'`, `'next/server'` import 가 **절대** 발생하지 않도록 lint 규칙 or `package.json` `peerDependencies`/`eslint-plugin-boundaries` 구성이 들어갔는지. 경계가 runtime 이 아닌 compile-time 에 차단돼야 Personal 의 pg-free 보장이 유지됨
2. **`semo dashboard --local` 의 포트/바인드 안전성** — `127.0.0.1` bind 강제 (0.0.0.0 금지), `--port` 충돌 시 fail-fast vs auto-increment 정책, `SIGINT`/`SIGTERM` 시 Next.js 서버 graceful shutdown (좀비 프로세스 방지), `SEMO_HOME` 환경변수 미설정 시 fallback 경로가 테스트 샌드박스를 해치지 않는지 (e.g. 유닛 테스트가 `~/.semo/kb.db` 를 touch 하는지 확인)
3. **ops-store `action_items` 스키마 이식 정합성** — PG 스키마 (`packages/cli/migrations/*` 중 action_items DDL) 대비 SQLite 스키마가 **어떤 컬럼을 의도적으로 drop** 했는지 명시됐는지 (예: `iteration_id`, JOIN 기반 `owner_label` 등). 추후 Team→Personal 이행 시나리오에서 `semo export | semo import` 경로가 이 diff 를 어떻게 처리하는지 문서화. PR-D 머지 전 migration rollback plan 도 요구

---

_끝._
