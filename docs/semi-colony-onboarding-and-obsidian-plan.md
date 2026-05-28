# Semi/Colony 온보딩 풀 흐름 + 옵시디언 양방향 연동 — 디자인 플랜

> 2026-05-28 작성. 단발 세션에 모두 구현하기엔 큰 작업이라 별도 트랙으로 분리.

## 현재 (오늘 적용된 부분)

- Slack sender (`msg.user`) → KB `slack-id` 매핑 lookup
- 등록자: `nickname`/`role`/`memory`/`identity` 컨텍스트를 prompt 앞에 prepend → 봇이 호명·맥락 인지 응답
- 미등록자: default 모드로 처리 + 응답 끝에 한 줄 온보딩 권유 (`semo kb upsert <domain> slack-id --content <user_id>`)

## Phase 2 — 대화 기반 온보딩 (별도 구현 필요)

### 목표

사용자가 미등록 상태에서 처음 멘션하면 Semi/Colony 가 자연스러운 대화를 통해 다음 정보를 수집:

1. **이름/닉네임** — 어떤 이름으로 부를까요?
2. **역할** — 어떤 일을 주로 하세요? (개발자/디자이너/PO/마케터/대표 등)
3. **IT/AI 친숙도** — "AI 잘 모르시는 편? 보통? 익숙한 편?" 3단계 정도로 톤 조절 기준
4. **관심 영역** — SEMO 의 어느 프로젝트에 가까운지

이 정보들은 KB 의 `{user-domain}` 에 저장:

```
{user-domain}/slack-id     ← 식별자 (이미 적용 가능)
{user-domain}/nickname     ← 호명 시 사용
{user-domain}/role         ← 역할
{user-domain}/it-fluency   ← 친숙도 (beginner|intermediate|expert)
{user-domain}/interests    ← 관심 프로젝트 (csv)
{user-domain}/memory       ← 누적 컨텍스트 메모
```

### 구현 옵션

**옵션 A (가벼움) — Semi/Colony 의 SOUL.md 에 온보딩 mode 추가**

- Semi 의 prompt context 에 "미등록 사용자" 표시 시, 첫 응답은 라우팅 대신 친근한 인사 + 첫 질문
- 사용자 답 → 다음 질문 (multi-turn). slack thread 단위로 진행
- 모든 정보 수집 후 라우팅 모드로 전환

**문제점**: Hermes 의 stateful multi-turn 이 slack thread 기준으로 일관성 유지 어려움. session resume 필요.

**옵션 B (안정) — 별도 onboarding-bot (`@SemiOnboard` 등) + Slack interactive blocks**

- 미등록자 첫 멘션 → Semi 가 "처음 뵙는 분이네요! 잠시 자기소개 받아도 될까요?" + Slack button block (이름 입력, 역할 dropdown 등)
- block_actions 이벤트 처리해서 답 수집
- KB upsert 후 완료 메시지

**문제점**: Slack block UX 디자인 필요, 코드량 큼.

**옵션 C (현실적, 권장) — Semi/Colony 가 첫 번째 응답에서 친근한 자기소개 + 한 줄 자기소개 요청**

- 미등록자 → 봇이 "안녕하세요! 처음 뵙겠습니다 😊 어떻게 부르면 좋을까요? 그리고 어떤 일을 주로 하시는지 짧게 알려주시면 더 잘 도와드릴 수 있어요." 응답
- 사용자가 자유 텍스트로 답 → 봇이 자연어 추출해서 KB upsert
- 이후 멘션은 등록자 모드

→ **옵션 C 가 Phase 2 의 본구현으로 적합**. 별도 dispatch hook 필요:

1. slack-router 의 `resolveSenderProfile()` 가 미등록자 감지 시 onboarding state 표시
2. Semi/Colony SOUL.md 에 "미등록 사용자 발화 시 라우팅 전에 자기소개 권유" 룰 추가
3. 사용자가 다음 메시지에서 자기소개 → Semi 가 KB upsert 수행 → 후속 라우팅 진행

## Phase 3 — 옵시디언 양방향 연동

### 목표

사용자 KB 데이터를 옵시디언 vault 와 양방향 동기화. 사용자가 Obsidian 에서 자기 프로필 / 메모를 수정해도 SEMO 에 반영되고, SEMO 의 메모리 갱신이 Obsidian markdown 으로 export.

### 디자인 옵션

**A. Obsidian 측 → SEMO**

- Obsidian vault 의 `team/{user-domain}.md` 마크다운 파일을 file watcher 로 감시
- frontmatter 또는 정형 섹션 (`## nickname`, `## role` 등) 파싱
- `semo kb upsert` 호출로 동기화
- 도구: `chokidar` 기반 watcher (Node.js), 또는 Obsidian plugin

**B. SEMO 측 → Obsidian**

- `semo kb upsert` 시 hook 으로 markdown 파일 write
- 파일 경로: `{obsidian_vault}/team/{domain}.md`
- frontmatter 에 lastSync timestamp 기록

**C. Conflict 해결**

- updated_at 비교, newer-wins
- 충돌 시 사용자에게 알림 (Slack DM)

### 구현 단계

1. `packages/obsidian-sync/` 신규 패키지 — Node.js watcher daemon
2. `semo obsidian sync` CLI 명령 — 일회성 양방향 동기화
3. `semo obsidian watch` — 백그라운드 watcher (launchd 등록)
4. KB upsert hook 연동 (PG trigger 또는 application-level)
5. Obsidian plugin (선택) — UI 에서 SEMO 데이터 직접 편집

### 추정 작업량

- A+B 기본 동기화: 1~2일
- C 충돌 해결 + UX: 1일
- Obsidian plugin: 2~3일 (선택)

## 일정 제안

- **Phase 2 (대화 온보딩) — 옵션 C**: 1~2일 작업, 빠르면 다음 1주 안
- **Phase 3 (옵시디언 연동)**: 2~3일 작업, Phase 2 안정 후

## 우선순위 (사용자 결정 필요)

- ☐ Phase 2 (옵션 C 권장) — Semi/Colony 가 자연스럽게 사용자 정보 수집
- ☐ Phase 3 (옵시디언 양방향)
- ☐ delegation-check hook 해결 (오늘 진단한 commitment 미실행 원인)
- ☐ OpenClaw 봇 Slack App private 처리 (One Agent Experience 완성)

## Refs

- [[semo/decision/one-agent-experience-implementation-2026-05-27]]
- [[semo/decision/colony-slack-primary-bot-2026-05-27]]
