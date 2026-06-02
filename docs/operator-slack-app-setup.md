# SEMO Operator — Slack App 설치/통합 가이드

> 매니페스트: `docs/operator-slack-manifest.yaml` (전 권한, 적대적 검증 완료 — 무효 스코프 workflows.steps:execute 제거).
> 설계: `docs/superpowers/specs/2026-06-02-agent-behavior-sot-and-propagation-design.md`
> Operator = base persona(SOUL) DB SoT 편집자. 관리 채널에서 @Operator 로 컨펌 기반 수정.

## SEMO slack-router 에 Operator 전용 앱 붙이기

검증 출처(실제 코드 확인):

- `packages/slack-router/src/index.ts:93-95` — `OPERATOR_BOT_ID`('operator') / `OPERATOR_HERMES_PROFILE`('semo-operator') / `OPERATOR_ADMIN_CHANNEL`
- `index.ts:118-136` — main gateway = Semi 앱, `buildDedicatedInboundSlackGateways()`(제외 필터: slack, semobot, OPENCLAW_BOTS)
- `index.ts:1172-1185` — `if (OPERATOR_ADMIN_CHANNEL)` 일 때만 `ORCHESTRATORS[operator]`(personaAdmin: true) 등록
- `index.ts:2135-2153` — 채널+키워드 게이트(2138) → `msg.route_bot_id && ORCHESTRATORS[...]`(2152) 자동 라우팅
- `packages/common/src/slack/bot-web-client-pool.ts:30,38` — `envKeyFor` → `{BOTID}_SLACK_BOT_TOKEN`, 누락 시 SemoBot fallback + warn

### 1) Slack 앱 생성

1. https://api.slack.com/apps → Create New App → From an app manifest → 워크스페이스 선택 → 위 `manifest_yaml` 붙여넣기 → Create.
2. Install to Workspace → bot token(`xoxb-...`) 발급. → `OPERATOR_SLACK_BOT_TOKEN` 으로 사용.
3. Basic Information → App-Level Tokens → Generate Token and Scopes → 스코프 `connections:write` 추가(Socket Mode 필수, 매니페스트로는 발급 불가) → `xapp-...` 발급. → `OPERATOR_SLACK_APP_TOKEN` 으로 사용.

### 2) env 추가 (`~/.claude/semo/.env`)

```
OPERATOR_SLACK_BOT_TOKEN=xoxb-...     # 1)-2 에서 발급
OPERATOR_SLACK_APP_TOKEN=xapp-...     # 1)-3 에서 발급 (connections:write)
OPERATOR_ADMIN_CHANNEL=C...           # @오퍼레이터 운영 채널 ID (필수: 이게 비면 operator 비활성)
# OPERATOR_BOT_ID, OPERATOR_HERMES_PROFILE 는 기본값 operator / semo-operator 로 충분
```

env 키 규칙은 `botId.replace(/-/g,'_').toUpperCase()` 이므로 botId 'operator' → 정확히 위 두 이름이어야 한다.

### 3) inbound 게이트웨이 자동 생성 확인

- `OPERATOR_SLACK_BOT_TOKEN` + `OPERATOR_SLACK_APP_TOKEN` 둘 다 있으면 `listBotsWithDedicatedToken()` 가 'operator' 반환 → `buildDedicatedInboundSlackGateways()` 가 Operator 전용 socket-mode 게이트웨이를 추가 생성.
- 단 제외 필터(`index.ts:129`)에 걸리지 않아야 한다: operator 가 `OPENCLAW_BOTS`(env `OPENCLAW_NATIVE_BOTS` / KB `semo/bot-ids` metadata.runtime_source) 에 포함되지 않게 확인. 현재 fallback 목록에 operator 없음 → 통과.
- 이 게이트웨이가 수신한 메시지는 `route_bot_id='operator'` 가 자동으로 박힌다(`slack-gateway.ts` 생성자).

### 4) 발신(postAsBot) 명의

- `getWebClientForBot('operator')` 가 `OPERATOR_SLACK_BOT_TOKEN` 을 자동 사용 → operator 명의로 발신. 토큰 없으면 SemoBot 토큰으로 fallback + `[slack-pool] No per-bot token...` warn.
- `bot-config.ts` 의 `SLACK_PROFILES` / `FALLBACK_SLACK_PROFILES` 등록은 hermes/orchestrator 경로(`slack.postAsBot`)에 필수 아님(blocks 변환만 사용). 일관성을 원하면 `FALLBACK_SLACK_PROFILES` 에 `operator: { username: 'Operator', icon_emoji: ':gear:' }` 추가는 선택.

### 5) route_bot_id=operator → ORCHESTRATORS[operator] 라우팅 (코드 변경 불요)

- `OPERATOR_ADMIN_CHANNEL` 이 설정돼 있으면 `ORCHESTRATORS[operator]`(personaAdmin: true) 가 등록된다(`index.ts:1172`).
- Operator 전용 앱 수신 메시지는 `route_bot_id='operator'` → `index.ts:2152` 분기에서 `handleOrchestrator(operator)` 로 자동 라우팅. personaAdmin 경로(SOUL 주입 + APPLY_PERSONA 파싱 → applyPersona DB 반영)는 수신 경로와 무관하게 그대로 동작.
- 주의: 현재 `index.ts:2138-2146` 의 채널+키워드 게이트(Semi 앱으로 들어온 메시지를 `OPERATOR_ADMIN_CHANNEL`+@오퍼레이터 정규식으로 가로채는 로직)는 전용 앱 도입 후 이중 처리/충돌 소지가 있다. 권장 정리:
  - (a) Operator 전용 앱만 쓸 거면 2138 게이트 제거(2152 가 처리).
  - (b) "관리 채널 한정" 정책을 유지하려면 게이트를 채널 검사만 남기고 키워드는 전용 앱 멘션에 위임. 또는 `handleOrchestrator(operator)` 진입 직전에 `msg.channel === OPERATOR_ADMIN_CHANNEL` 가드를 두어 채널 밖 멘션을 차단.
- (선택) 채널 무관 활성화를 원하면 등록 조건(`index.ts:1172`)을 `if (process.env.OPERATOR_SLACK_APP_TOKEN || OPERATOR_ADMIN_CHANNEL)` 로 완화. 기본은 `OPERATOR_ADMIN_CHANNEL` 유지(보안 디폴트) 권장.

### 6) 접근 제어: 관리 채널에만 초대

- 봇은 `message.*` 이벤트를 **자신이 멤버인 채널에서만** 수신한다(전체 채널 firehose 없음). Operator 앱을 `OPERATOR_ADMIN_CHANNEL` 한 곳에만 `/invite @Operator` 로 초대하면, 그 채널 밖에서는 물리적으로 메시지를 못 받아 자연스러운 접근 제어가 된다.
- 비공개 채널이면 `groups:read`/`groups:history` 로 충분(매니페스트 포함됨).

### 7) router 재기동 (cmux pane 안에서 — daemon 금지)

```
cd /Users/reus/Desktop/Sources/semicolon/projects/semo
set -a && source ~/.claude/semo/.env && set +a
npx tsx packages/slack-router/src/index.ts > ~/.semo/logs/slack-router.log 2>&1 &
```

부팅 로그에서 Operator 게이트웨이 `auth.test` 성공(봇 user_id) 확인.

### 8) E2E 검증

관리 채널에서 `@Operator {요청}` → 로그상 `route_bot_id='operator'` → `handleOrchestrator(operator)` → personaAdmin SOUL 주입 → 응답의 APPLY_PERSONA → `applyPersona` 가 `semo.agent_personas` UPDATE + `agent_persona_revisions` INSERT + `profiles/semo-{slug}/SOUL.md` 동기화까지 확인.

### 9) 3자 동기화

- 소스코드: 위 env/게이트 정리.
- KB: `semo kb get semo bot-ids` 의 operator 항목 runtime_source 가 `openclaw` 가 아닌지 확인(아니어야 inbound 게이트웨이 생성됨). 전용 앱 도입 사실을 `semo decision` 또는 `semo/bot-ids` 메타에 기록.
- 봇 파일: hermes `profiles/semo-operator/` 프로파일 존재 확인(`OPERATOR_HERMES_PROFILE`).

---

## 주의사항

1. **App-Level Token (`connections:write`) 은 매니페스트로 발급 불가.**
   매니페스트의 `settings.socket_mode_enabled: true` 는 Socket Mode 토글만 한다. 실제 WebSocket 연결 권한인 `connections:write` 는 OAuth bot/user 스코프와 **다른 트랙**의 app-level token(`xapp-`)에만 부여되며, Basic Information → App-Level Tokens → Generate Token and Scopes 에서 **UI로 수동 발급**해야 한다. 이 값이 `OPERATOR_SLACK_APP_TOKEN`. 따라서 `connections:write` 는 매니페스트 `oauth_config.scopes` 에 절대 넣지 않는다(넣으면 import 실패).

2. **Enterprise Grid 전용 스코프는 의도적으로 제외.**
   `admin.*` 계열(admin.conversations:_, admin.users:_, admin.teams:_, admin.apps:_, admin.roles:_, admin.barriers:_, admin.invites:_, admin.usergroups:_, admin.workflows:_, admin.analytics:read, admin.app_activities:read 등)과 `auditlogs:read`, `admin`, `search:read.enterprise` 는 Enterprise Grid org 어드민 유저 토큰에서만 유효하다. 일반(비-Grid) 워크스페이스에서 매니페스트 import 시 **"invalid scope" 로 import 자체가 실패**하므로 기본 매니페스트에서 뺐다. Enterprise Grid 환경이라면 `oauth_config.scopes.user` 에 다음을 추가하고 `settings.org_deploy_enabled: true` 로 바꿔라:
   `admin`, `admin.analytics:read`, `admin.apps:read`, `admin.apps:write`, `admin.barriers:read`, `admin.barriers:write`, `admin.conversations:read`, `admin.conversations:write`, `admin.invites:read`, `admin.invites:write`, `admin.roles:read`, `admin.roles:write`, `admin.teams:read`, `admin.teams:write`, `admin.usergroups:read`, `admin.usergroups:write`, `admin.users:read`, `admin.users:write`, `admin.workflows:read`, `admin.workflows:write`, `auditlogs:read`, `search:read.enterprise`. (admin._ 는 메서드별 미세 변형이 더 있으며 각 API 메서드 문서가 SoT.)

3. **Socket Mode 앱은 Slack Marketplace 등재 불가.** 내부 운영봇이라 무관하지만, 외부 배포를 원하면 HTTP(request URL) 모드로 전환해야 한다. 그때는 `socket_mode_enabled: false` + `event_subscriptions.request_url` + `interactivity.request_url` 를 채워야 한다(현재 매니페스트는 Socket Mode이므로 두 URL 생략 — 둘 중 하나라도 "either request_url OR socket_mode" 규칙을 만족하면 됨).

4. **socket vs http — 권장값.** 내부 단일 워크스페이스 운영봇 기준 `socket_mode_enabled: true`, `org_deploy_enabled: false`, `token_rotation_enabled: false` 가 권장. `token_rotation_enabled: true` 는 토큰이 ~12h 만료되어 refresh flow 구현이 강제되므로 단일 테넌트엔 불필요(매니페스트는 false). 단, 토큰 로테이션은 OAuth bot/user 토큰에만 적용되며 Socket Mode `xapp-` app-level 토큰엔 무관하다.

5. **이벤트 중복(dedupe) 필요.** `app_mention` 과 `message.channels` 를 둘 다 구독하면 공개 채널 멘션 1건이 **두 이벤트**로 들어온다. slack-router 핸들러는 `event.client_msg_id` / `event_ts` 기준 dedupe 가 되어 있어야 한다(Migration 089 의 slack_event_id 부분 유니크 인덱스가 commitment 레벨 중복도 차단).

6. **봇 메시지 수신 범위.** 봇은 자신이 멤버인 채널에서만 `message.*` 를 받는다(전체 채널 firehose 없음). 따라서 매니페스트 스코프가 "모든 권한"이어도 실제 수신은 초대된 채널로 제한된다 — 이게 6번(관리 채널 한정) 접근 제어의 기반이다.

7. **user 스코프 추가 시 별도 인증 화면.** `oauth_config.scopes.user` 가 채워져 있으면 설치 시 사용자 토큰(`xoxp-`) 동의 화면이 추가로 뜬다. Operator 런타임(slack-router)은 현재 **bot 토큰만** 사용하므로(`OPERATOR_SLACK_BOT_TOKEN`), user 스코프는 "모든 권한 승인" 요구를 충족하기 위한 것이고 런타임 동작엔 필요 없다. user 토큰 동의 자체를 피하고 싶으면 `oauth_config.scopes.user` 블록 전체를 삭제해도 봇 동작엔 영향 없다.

8. **commitment 추적 경계.** Operator 는 orchestrator 경로(line 2152)로 처리되므로 `routeDirectSlackAppMessage`/`applySlackRouterPolicy` 의 mailbox 정책 가드를 거치지 않는다. 반드시 `ORCHESTRATORS[operator]` 에 등록되어 line 2152 에서 가로채져야 하며, 미등록 시 line 2170 `routeDirectSlackAppMessage` 로 빠져 policy 검사를 받게 되어 의도와 달라진다 → `OPERATOR_ADMIN_CHANNEL`(또는 완화 조건) 을 반드시 채워둘 것.
