# github-rules.md — GitHub 운영 규칙 통합

## 이슈 생성 필수 체크리스트

이슈 생성 시 반드시 순서대로:
1. `gh issue create` (한 기능에 한 이슈)
2. `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>` ← **프로젝트 보드 등록 필수!**
3. `bot:*` 라벨 부착 + 봇 서명 코멘트
4. 담당 봇에게 Slack 멘션 인계 (이슈 링크 포함)

- 프로젝트 번호: `1` / ID: `PVT_kwDOC01-Rc4AtDz2`

## OAT & 엔진

- OAT: **Claude Code OAT만 사용** (Copilot OAT 금지)
- gh-aw 엔진: Claude Code (`engine: claude`)

## 라벨 체인

`bot:needs-spec` → `bot:spec-ready` → `bot:in-progress` → `bot:needs-review` → `bot:done` / `bot:blocked`

### 라벨 정리 규칙 (2026-03-06)

**⚠️ 라벨 전환 시 이전 단계 라벨 제거 필수**
- `bot:in-progress` → `bot:done` 전환 시: `bot:in-progress` 제거 필수
- 이슈 close 시에도 `bot:in-progress` 잔존 여부 확인
- 이유: closed + bot:done 상태에서 bot:in-progress가 남아있는 이슈 다수 발견됨

### 라벨 전환 후 인계 방식 (2026-02-20 변경, Reus 승인)

**⚠️ 모든 봇 간 직접 Slack 멘션 인계 전면 폐기. 순수 라벨+폴링 방식으로만 인계.**

- 라벨만 부착하고 다음 봇이 폴링으로 감지. Slack 멘션 인계 금지.
- WorkClaw: `bot:needs-review` 붙이기만 → ReviewClaw이 5분 폴링으로 감지
- PlanClaw: `bot:spec-ready` 붙이기만 → WorkClaw이 5분 폴링으로 감지
- ReviewClaw: approve+머지 후 `bot:done` 붙이기만 → SemiClaw이 15분 폴링으로 감지
- ReviewClaw: `request changes`만 → WorkClaw이 `review:changes_requested` 폴링으로 감지
- E2E 버그: 이슈 생성 + `bot:spec-ready` 라벨만 (멘션 X)
- `bot:blocked`: SemiClaw이 15분 폴링으로 감지
- 정보 요청: GitHub 이슈 `bot:info-req` 라벨 경유. 답변 후 즉시 close

### WorkClaw 폴링 쿼리
1. `label:bot:spec-ready -label:bot:in-progress` (5분) — 새 구현 작업 감지
2. `is:pr is:open review:changes_requested` (5분) — 리뷰 피드백 반영 필요 감지

## 이슈 R&R

- 버그/단순 수정 → SemiClaw이 이슈 등록 → 담당 봇 인계
- 기획 필요 → PlanClaw 기획 → 이슈 생성 → 담당 봇 인계
- DesignClaw는 코멘트만 (이슈 직접 생성 안 함)
- **이슈 등록 없이 슬랙 멘션만으로 작업 인계 금지**

## 변경 통제

- 공용 레포(actions-template 등) 봇 단독 수정 금지
- 모든 변경은 Garden 승인 필수

## 봇 서명 (작업 추적)

이슈 생성, 라벨 변경, PR 생성 등 모든 GitHub 작업 시 코멘트:
```
🤖 작업 로그 (WorkClaw)
- 액션: [이슈 생성 / 라벨 변경 / PR 생성 / 이슈 업데이트]
- 라벨 변경: [before] → [after]
- 사유: [간단한 사유]
```

## 서브에이전트 PR 머지 금지 (2026-02-19)

- 서브에이전트 task에 반드시 "PR 생성까지만, 머지 절대 금지" 명시
- 모든 머지는 ReviewClaw approve 후에만
