# 별건 작업 해소 플랜 — 고객 대시보드 미완 영역

> 작성: 2026-05-31 (reus, Claude Code)
> 트리거: 2026-05-30 세미콜론 팀 테넌트 + 어드민 스위처 + CLI dev tenant 작업 (`9560d00c` on `dev`) 종료 시 "별건"으로 분리한 3 영역.
> KB: `semo decision customer-dashboard-team-default-and-admin-impersonation-2026-05-30`

## 0. 직전에 끝낸 일 (참고 컨텍스트)

`dev` 브랜치 최근 7 커밋:

| 커밋       | 내용                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `9560d00c` | pre-push lint 게이트 근본 수정 (`setState-in-effect` → `useSyncExternalStore`, ternary → if/else)                                 |
| `5c7ae0e8` | CLI `semo dev tenant {list/create/seed/reset/delete}` 신설                                                                        |
| `24caf03d` | 어드민 테넌트 스위처 (`/api/admin/tenants` + `<TenantSwitcher/>`), `DEMO_TENANT='team-semicolon'`, `SEMO_CUSTOMER_GATING` 기본 ON |
| `2c16931d` | 마이그 013 — `team-semicolon` 시드 (직원 5 / 활동 12 / usage / 결제 2)                                                            |
| `b171b2f7` | `/projects` activeView 렌더-중-파생 (setState-in-effect 해소)                                                                     |
| `dc090e87` | `/team` ScreenRoadmap 간트 풀 재작성                                                                                              |
| `556c2756` | `/org` ScreenOrg 노드-엣지 그래프 풀 재작성                                                                                       |
| `35a21f81` | `/projects` ScreenServices 풀 재작성                                                                                              |

배포: `dev-9560d00` 이미지 빌드+kustomize tag 갱신+개발 CI/CD apply 완료.

## 1. 해소 대상 (3 영역)

### A. 비팀 유저 온보딩 빈 구멍

증상 진단(2026-05-30 감사 결과):

1. `/auth/callback` (`app/auth/callback/route.ts`) 가 PKCE 코드 교환 후 **테넌트 보장 안 함** — PersonaSelect 우회로 `/dashboard` 직접 진입 시 `requireOwnedTenantSlug` 가 `/dashboard/start` 로 되돌림.
2. 온보딩 어디에도 **메신저 연결 단계가 없음** — 직원 "채용"(`/api/my/agents/install`) 후 외부 메시지가 들어올 곳이 없는 채로 끝남.

### B. 사이드바 chrome 데이터 경로 불일치

증상: `/dashboard` 메인 피드는 정상적으로 resolved 테넌트(team-semicolon) 데이터를 렌더하는데, 사이드바 헤더는 "정민 카페 / Customer / 내 직원 7명" 으로 표시 — 별도 데이터 경로(layout 단 또는 chrome 내부 정적값) 추정.

### C. 고객 메신저 연동 (현재 0%)

`agent_listings.integrations` 는 한글 라벨 JSONB 만 (`'카카오톡 채널'`, `'인스타 DM'` 등). 채널 테이블 0개, OAuth 핸들러 0개, inbound webhook 0개, outbound 포스팅 0개. `RecruitStep2` 의 "연결하기" 버튼은 mockup (onClick 없음).

내부 ops Slack (`slack-router`, `packages/channel-slack`, `lib/slack.ts`) 은 단일 글로벌 토큰 / SemiClaw 등 봇 트래픽 전용 — **고객 채널과 코드 공유 금지**.

## 2. 단계별 플랜

### Phase 1 — 온보딩 빈 구멍 (작음, ~3 파일)

**1A. `/auth/callback` 에 tenant 보장**

- 파일: `packages/semo-dashboard/app/auth/callback/route.ts`
- PKCE 교환 성공 후, Supabase `user_profiles` row 가 없는 경우(=고객) `ensureTenantForUser(user.id, user.email)` 호출. team 멤버(profile.onboarding_role IN team set) 는 호출 안 함.
- side effect: 테넌트 + free 구독 생성. PersonaSelect 가 호출되어도 `ensureTenantForUser` 는 idempotent.

**1B. OnboardingGate 검증** (확인용; 아마 변경 없음)

- 파일: `components/OnboardingGate.tsx`
- 감사 결과 "customer (profile null, tenant 존재) 가 내부 경로 진입 → `/dashboard` redirect" 가 이미 동작. 회귀 방지 주석 + 가능한 빠진 케이스(예: tenant 가 있는데 profile 도 있는 staff-with-tenant) 보강 검토.

**1C. 사이드바 chrome 동기화**

- 파일: `app/(customer)/layout.tsx` + `_ui/components.jsx` 사이드바 부분
- 사이드바가 표시하는 (테넌트 표시명·직원수) 를 페이지와 동일한 `requireOwnedTenantSlug` + `getInstalledAgents` 결과로 통일. 페이지에서 React Server Component → Client chrome 으로 props 또는 React context 로 주입.
- 대안: chrome 자체를 RSC 로 만들고 자체 호출 (현재 'use client' 이면 layout 에서 RSC 래퍼로 fetch 후 prop).

### Phase 2 — 메신저 연동 MVP (한 채널 end-to-end + DB/공통)

**채널 선택**: **Slack** 먼저 (이유: 잘 문서화된 OAuth, JSON-friendly, 노드 SDK 보편, 서명 검증 단순). KakaoTalk Channel/Sync 는 같은 스키마/패턴을 따라 후속.

**2A. Migration 014 — 채널 스키마**

- 파일: `packages/semo-dashboard/migrations/014_tenant_channels.sql`
- `tenant_channels`:
  - `id uuid PK, tenant_id uuid FK→tenants(id) CASCADE, channel_type text CHECK in ('slack','kakao','telegram','discord','email'), external_workspace_id text, external_team_name text, credentials_ref jsonb (encrypted), status text CHECK in ('active','paused','revoked','error') default 'active', created_at, updated_at`
  - `UNIQUE(tenant_id, channel_type, external_workspace_id)`
  - `INDEX (tenant_id, status)`
- `channel_messages`:
  - `id uuid PK, tenant_channel_id uuid FK→tenant_channels(id) CASCADE, direction text CHECK in ('inbound','outbound'), external_message_id text, external_channel_id text, external_user_id text, payload jsonb, agent_install_id uuid FK→agent_installs(id) ON DELETE SET NULL, occurred_at timestamptz default now()`
  - `INDEX (tenant_channel_id, occurred_at desc)`
- 멱등: `CREATE TABLE IF NOT EXISTS`. 적용 스크립트 패턴은 기존 `apply-customer-tables.mjs` 따라감.

**2B. 자격증명 암호화 헬퍼**

- 파일: `packages/semo-dashboard/lib/customer/credentials.ts`
- Node `crypto.createCipheriv('aes-256-gcm', key, iv)` 기반. 키 = `SEMO_CHANNEL_ENC_KEY` (32-byte base64 env).
- `encryptCredentials(obj): { iv, tag, ciphertext }` / `decryptCredentials({ iv, tag, ciphertext }): obj`
- 키 미설정 dev 모드: 경고 로그 + plaintext 저장 (`{ "_plaintext": true, ... }`). 프로덕션 부트에서 key 미설정 시 `console.error` (block 옵션은 보수적 — 환경 의존).

**2C. Slack OAuth 핸드셰이크**

- `app/api/channels/slack/start/route.ts` (GET):
  - state token 발급 (HMAC over `{tenant_id, ts, nonce}` with `SEMO_CHANNEL_STATE_SECRET`).
  - redirect to Slack OAuth URL with `scope=app_mentions:read,channels:history,chat:write,im:history,users:read`, `state`, `redirect_uri=NEXT_PUBLIC_BASE_URL/api/channels/slack/callback`, `client_id=SEMO_SLACK_CLIENT_ID`.
- `app/api/channels/slack/callback/route.ts` (GET):
  - verify `state` HMAC + age (<10min).
  - exchange `code` → access_token 등 (Slack `oauth.v2.access`).
  - INSERT/UPSERT `tenant_channels` (channel_type='slack', external_workspace_id=team.id, external_team_name=team.name, credentials_ref=encryptCredentials({access_token, bot_user_id, scope}), status='active').
  - redirect `/dashboard/settings/integrations?ok=1`.
- env: `SEMO_SLACK_CLIENT_ID`, `SEMO_SLACK_CLIENT_SECRET`, `SEMO_CHANNEL_STATE_SECRET`, `SEMO_CHANNEL_ENC_KEY`, `NEXT_PUBLIC_BASE_URL`.

**2D. Slack inbound webhook**

- `app/api/channels/slack/events/route.ts` (POST):
  - Slack 서명 검증 (`v0=`, raw body, `SEMO_SLACK_SIGNING_SECRET`, ±5min).
  - `type='url_verification'` → echo `challenge`.
  - `type='event_callback'`:
    - extract `team_id`, `event.channel`, `event.user`, `event.text`, `event.ts`.
    - resolve tenant_channel by `(channel_type='slack', external_workspace_id=team_id)`. 없으면 무시 + log.
    - bot 자기 자신 메시지 (subtype='bot_message' or user==bot_user_id) → skip.
    - INSERT inbound `channel_messages` (direction='inbound', external_message_id=event.ts, payload=event).
    - enqueue `dispatchInboundMessage` (non-blocking — return 200 즉시, dispatch 는 fire-and-forget).

**2E. Dispatcher (스텁 + 후크)**

- 파일: `lib/channels/dispatcher.ts`
- `dispatchInboundMessage({ tenantChannelId, channelMessageId })`:
  - load tenant + first active `agent_installs` row (MVP 라우팅: 첫 활성 직원).
  - if `SEMO_RUNTIME_URL` 설정됨 → POST `{ tenant, install, text, channelType }` → 응답을 `text` 로.
  - 아니면 stub 응답 `"받았어요. 직원이 곧 답해 드릴게요."` + `agent_activity` 행 INSERT (verb='메시지 수신', target=external_channel, is_ai=true).
  - 응답을 outbound poster 로 전달.

**2F. Outbound poster (Slack)**

- 파일: `lib/channels/providers/slack.ts`
- `postSlack(tenantChannelId, externalChannelId, text)`:
  - load + decrypt credentials → `chat.postMessage` (Bearer access_token).
  - on success: INSERT outbound `channel_messages` (direction='outbound', external_message_id=resp.ts, payload={text}).

**2G. UI — Integrations 페이지**

- `app/(customer)/dashboard/settings/integrations/page.tsx` (신규)
- `requireOwnedTenantSlug` → 현재 테넌트의 `tenant_channels` 행 표시 (provider별 상태/연결일/연결자/disconnect).
- "Slack 연결" 버튼 → `/api/channels/slack/start`.
- 좌측 사이드바에 "설정 > 연동" 항목 추가 (chrome 메뉴).

**2H. `RecruitStep2` 연결하기 와이어**

- 파일: `app/(customer)/_ui/screen-library.jsx:609-643`
- 라벨 → provider slug 매핑 (`'카카오톡 채널' → 'kakao'`, `'슬랙' → 'slack'`, etc.). 매핑 안 된 라벨은 "준비 중" toast.
- onClick → `window.location.href = '/api/channels/{provider}/start'` (Phase 2 에선 Slack 만 실제 동작).

**2I. Disconnect 핸들러**

- `/api/channels/{provider}/disconnect/route.ts` (POST): tenant_channel.status='revoked'. 어드민/owner 가드.

### Phase 3 — 검증 + 문서

**3A. Playwright 스모크**

- `/dashboard/settings/integrations` 렌더 + Slack start 302 → Slack OAuth URL (모킹 환경).
- `/api/channels/slack/events` URL verification challenge 응답.

**3B. 환경변수 문서**

- `docs/env/customer-channels.md`: 필요 env 표 (`SEMO_SLACK_*`, `SEMO_CHANNEL_*`, `NEXT_PUBLIC_BASE_URL`) + 발급 방법 링크.

**3C. KB decision 기록**

- `semo decision customer-messenger-mvp-slack-2026-05-31`.

## 3. 단계별 커밋/배포 전략

각 Phase 끝에 커밋 + 푸시:

1. Phase 1 → `feat(dashboard): close customer onboarding gap (auth callback + sidebar chrome sync)`.
2. Phase 2 → 여러 커밋 분리:
   - `feat(dashboard): migration 014 — tenant_channels + channel_messages`
   - `feat(dashboard): customer channel credential encryption helper`
   - `feat(dashboard): Slack channel OAuth start+callback (customer side)`
   - `feat(dashboard): Slack inbound events webhook + dispatcher stub`
   - `feat(dashboard): Slack outbound posting + /dashboard/settings/integrations UI`
   - `feat(dashboard): wire RecruitStep2 연결하기 to channel start`
3. Phase 3 → `docs(dashboard): customer channel env + KB decision`.

## 4. 의도적 비범위 (해소 안 하는 것)

- KakaoTalk/Telegram/Discord/Email/Instagram DM의 실제 OAuth+webhook → 같은 인프라(2A-2F) 패턴 따라 후속 PR에서 추가.
- 메시지 라우팅 지능화 (어느 직원에게 보낼지 매칭) → MVP 는 첫 활성 직원으로 단순 라우팅.
- 실 SEMO_RUNTIME 통합 — `SEMO_RUNTIME_URL` 가 설정되면 자동 위임, 아니면 stub.
- 자격증명 vault — 현재는 AES-256-GCM env-key 기반. 후속에서 GCP KMS / HashiCorp Vault 등 검토.
- 어드민-단 채널 audit log (누가 언제 토큰 발급/취소했는지 별도 감사 테이블) → MVP 후 추가.

## 5. 알려진 리스크 / 의문점 (Codex 리뷰 핵심)

1. **MVP 채널을 Slack 으로 시작하는 게 맞는지?** SEMO 의 핵심 고객(소상공인) 은 카카오톡이 압도적. Slack 은 코드 패턴 검증에는 유리하지만 실 비즈니스 임팩트가 떨어짐. 코덱스 의견 요청.
2. **Dispatcher 스텁 응답**이 채널에 실제로 가도 되는지 (사용자 인지 충돌). 아니면 Phase 2 에서는 outbound 를 끈 채로 inbound 만 적재하고, 별도 토글로 outbound 활성화?
3. **자격증명 암호화 키 분실** 시나리오 — 현재는 plaintext fallback 만. KMS 통합을 처음부터 넣을지, 의도적 deferral 인지.
4. **OAuth state HMAC**: 현재 설계는 stateless HMAC. Redis-backed state store 가 안전한지, HMAC 으로 충분한지.
5. **Phase 1 사이드바 동기화**: layout 에서 fetch + props 전달 vs. React context. 두 패턴 중 어느 게 chrome 와 페이지의 SSR-friendly 동기화에 맞는지.
6. **`/auth/callback` 의 ensureTenantForUser** — 호출이 항상 안전한지 (이미 PersonaSelect 가 호출). 동시성 (signup 직후 callback 과 PersonaSelect 둘 다 호출 가능). Idempotency 확인.
7. **권한**: settings/integrations 페이지는 tenant owner 만 vs admin 도 볼 수 있게 (스위처와 함께).
