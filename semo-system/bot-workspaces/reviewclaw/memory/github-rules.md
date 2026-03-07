# github-rules.md — GitHub 운영 규칙 (통합)

## 🔴 이슈 생성 시 필수 체크리스트 (2026-02-19 통합)
1. `gh issue create` (한 기능에 한 이슈)
2. `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>` ← 프로젝트 보드 등록 필수!
3. 담당 봇에게 Slack 멘션 인계 (이슈 링크 포함)

## 통합 운영 규칙 (2026-02-19)
- OAT: Claude Code OAT만 사용 (Copilot OAT 금지)
- gh-aw 엔진: Claude Code (engine: claude)
- 라벨 체인: `bot:needs-spec` → `bot:spec-ready` → `bot:in-progress` → `bot:needs-review` → `bot:done` / `bot:blocked`
- 변경 통제: 공용 레포(actions-template 등) 단독 수정 금지, Garden 승인 필수
- 이슈 R&R: 버그→SemiClaw→WorkClaw, 기획→PlanClaw→WorkClaw

## claude-code-review.yml (전담 워크플로우)
- 트리거: PR opened / synchronize / ready_for_review / reopened
- 현재 적용 레포: `core-backend`, `core-interface`
- Action: `anthropics/claude-code-action@v1` + code-review 플러그인
- Secret: `CLAUDE_CODE_OAUTH_TOKEN`

## GitHub 폴링 자율 리뷰 (2026-02-23 개정)
- cron job ID: `01870a0f-0820-46a8-ab39-24b52d540b92`
- 주기: 5분 (300,000ms)
- 쿼리: `org:semicolon-devteam+is:pr+is:open+review:none+-label:bot:blocked` (bot:blocked 필터 필수!)
- 한 번에 최대 3개 PR 리뷰
- 라벨: `bot:needs-review`, `bot:in-progress`, `bot:done`, `bot:blocked`

### 🔴 bot:blocked 체크 규칙 (2026-02-23 추가)
1. PR 폴링 쿼리에 `-label:bot:blocked` 필수 포함
2. PR 리뷰 전 `gh pr view <number> --json labels` 로 bot:blocked 재확인
3. PR과 연결된 이슈가 bot:blocked면 리뷰 스킵 + 해당 스레드에 알림
4. bot:blocked PR을 실수로 approve한 경우 즉시 리버트 권장

## bot:* 라벨 전환 (ReviewClaw 담당, 2026-03-06 개정)
1. PR approve 시: PR에 `bot:needs-review` 제거 + `bot:done` 추가 → **머지 X** → 프로젝트 채널에 결과 공유
2. PR request changes 시: PR에 `bot:blocked` 추가 → 프로젝트 채널에 결과 공유
3. E2E 버그 발견 시: 이슈 생성 + `bot:spec-ready` (명확) 또는 `bot:needs-spec` (기획 확인 필요)
4. 리뷰 완료 후 **대상 프로젝트 Slack 채널에 결과 공유** (#bot-ops 아님)
5. 모든 GitHub 작업에 🤖 작업 로그 코멘트 필수
6. 🔴 **`bot:done` 부착 시 `bot:in-progress` 반드시 제거** (2026-03-06 추가)
   - 이슈 close 시에도 `bot:in-progress` 잔존 여부 확인 필수
   - 라벨 전환 시 이전 단계 라벨 정리 누락 방지

## 🔴 봇 PR 머지 금지 규칙 (2026-02-27 추가, Reus 승인)
### 절대 금지
- ❌ **모든 봇이 `gh pr merge` 명령 사용 금지**
- ❌ 어떤 상황에서도 봇이 직접 PR 머지 불가
- ❌ `--admin` 플래그 사용 금지

### 리뷰 완료 후 액션 (ReviewClaw)
1. ✅ GitHub PR 리뷰 제출 (approve/changes_requested)
2. ✅ 라벨 변경: `bot:done` 또는 `bot:blocked`
3. ✅ Slack 보고: 머지 가능 상태 알림
4. ⏸️ **사람이 머지** (봇은 머지 ❌)

### Self-Approve 처리 (2026-02-27)
- **Self-PR 감지 시**: Approve 시도 ❌ → **코멘트만**
- **코멘트 내용**: "✅ 리뷰 완료. Self-PR로 Approve 불가. 사람이 직접 Approve+머지 필요."
- **라벨**: `bot:done`
- **Slack 보고**: Self-Approve 불가 명시
- **Self-PR 판단**: PR 작성자 = 현재 봇 계정 (reus-jeon)
