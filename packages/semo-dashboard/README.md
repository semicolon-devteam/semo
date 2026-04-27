# semo-dashboard

> SEMO 팀 운영 대시보드. PostgreSQL SoT 위에서 봇 상태·KB·커밋먼트·액션아이템·서비스 파이프라인을 실시간 조회/제어한다.

Next.js 15 (App Router) · TypeScript · Tailwind · Supabase Auth (SSO) · 자체 PostgreSQL.

---

## 역할

| 영역       | 화면                                                 |
| ---------- | ---------------------------------------------------- |
| 봇 운영    | `/bots` 봇 상태/세션/heartbeat, `/cost` 비용 추적    |
| KB         | `/kb` 도메인/키 검색·열람·이력, `/kb-stitch` 산출물  |
| 작업 흐름  | `/action-items` 액션아이템 보드, `/board` 일정/회의  |
| 프로젝트   | `/projects/[id]` 파이프라인, `/services` 서비스 메타 |
| 인큐베이터 | `/incubator` 신규 프로젝트 보드                      |
| 사람       | `/person/[domain]` 팀원·역할                         |
| 관리자     | `/admin` 권한·온톨로지                               |

각 화면은 `app/api/*/route.ts` 가 노출하는 RPC/REST 엔드포인트를 호출. DB 는 단일 PostgreSQL (semo 스키마).

---

## 데이터 흐름

```
사용자 브라우저
   ↓ Next.js (SSR + RSC)
app/(routes) + app/api/*/route.ts
   ↓ pg pool (DATABASE_URL)
PostgreSQL (semo 스키마)
   ↑ 다른 컴포넌트도 같은 DB 공유:
   - semo-cli (운영 CLI)
   - slack-router / discord-router (메신저 게이트웨이)
   - 봇 워크스페이스 (Claude Code / Codex 세션)
```

DB 가 SoT — Dashboard 는 read-mostly 뷰 + 일부 쓰기 (action-items, KB upsert, 서비스 메타 변경). 봇 파일은 `bot_workspace_files` 테이블에서 읽음 (FS 의존성 없음 → Docker 호환).

---

## 실행

### 로컬 개발

```bash
# 1) 환경변수 (~/.semo/dashboard.env 또는 .env.local)
cat > .env.local <<EOF
DATABASE_URL=postgresql://user:pass@localhost:5432/semo
OPENAI_API_KEY=sk-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
EOF

# 2) DB 터널 (운영 DB 사용 시 — LaunchAgent: com.semicolon.semo-db-tunnel)
launchctl load ~/Library/LaunchAgents/com.semicolon.semo-db-tunnel.plist

# 3) 개발 서버
npm install
npm run dev          # http://localhost:3000
```

### 빌드 + 운영

```bash
npm run build
npm start
```

### 테스트

```bash
npm run lint
npm test             # vitest 단위
npm run test:e2e     # playwright e2e
```

---

## 배포 (CI/CD)

`dev` 브랜치 push 시 자동:

1. `.github/workflows/dev-ci-cd.yml` 트리거
2. Docker 이미지 빌드 (이 패키지가 단일 컨텍스트 — 다른 워크스페이스 패키지는 `lib/shared-ui/` 로 흡수, KB decision `dashboard-ui-absorbed-into-host` 참조)
3. 이미지 push → Kustomize 매니페스트 갱신 → ArgoCD 배포 → Slack 알림

상세: 루트 `.claude/CLAUDE.md` 의 "Quality Gate" + 프로젝트 KB `decision/dashboard-ui-absorbed-into-host`.

---

## 환경변수

| 변수                                     | 용도                                     | 필수                  |
| ---------------------------------------- | ---------------------------------------- | --------------------- |
| `DATABASE_URL`                           | PostgreSQL 연결 (semo 스키마 read/write) | ✅                    |
| `OPENAI_API_KEY`                         | KB 임베딩 생성 (text-embedding-3-small)  | (KB 쓰기 시)          |
| `SLACK_BOT_TOKEN`                        | Slack 알림/봇 메시지 송신                | (Slack 사용 시)       |
| `SLACK_SIGNING_SECRET`                   | Slack interaction 검증                   | (interaction 사용 시) |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | SSO 로그인 (Supabase Auth)               | ✅                    |
| `SEMO_HEARTBEAT_SECRET`                  | 봇 heartbeat 인증 토큰                   | (incubator 사용 시)   |

---

## 주요 의존성

- `next@15` — App Router + Server Actions
- `@supabase/ssr` / `@supabase/supabase-js` — SSO 인증 (parent-domain 쿠키)
- `pg@8` — PostgreSQL 드라이버
- `tailwindcss` — 스타일
- `recharts` — 차트
- `@team-semicolon/semo-common` 패키지의 KB/Slack 헬퍼 일부 사용

---

## 관련 패키지

- `packages/cli` — 운영 CLI (`semo` / `semo-cli`)
- `packages/slack-router` — Slack 메시지 → 봇 디스패치
- `packages/discord-router` — Discord 어댑터
- `packages/common` — 공통 라이브러리 (mailbox, slack, runtime portable interfaces)
- `packages/semo-dashboard-personal` — 개인 사용자용 자가호스팅 dashboard (`lib/shared-ui/` 복제 흡수)

---

## 라이선스

Apache-2.0 (LICENSE 참조)
