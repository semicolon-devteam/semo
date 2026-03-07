# github-rules.md — GitHub 운영 규칙 (2026-02-19 통합)

## 🔴 이슈 생성 필수 체크리스트 (이것만 기억!)

1. `gh issue create` (적절한 `bot:*` 라벨 부착)
2. **`gh project item-add 1 --owner semicolon-devteam --url <이슈URL>`** ← 프로젝트 보드 등록 필수!
3. 담당 봇에게 Slack 멘션 인계 (이슈 링크 포함)
4. 한 기능에 한 이슈 원칙

> 프로젝트 번호: `1` / ID: `PVT_kwDOC01-Rc4AtDz2` (이슈관리 보드)

---

## 라벨 종류 & 전환 흐름

| 라벨 | 의미 |
|---|---|
| `bot:needs-spec` | 기획서 필요 → PlanClaw |
| `bot:spec-ready` | 기획 완료, 구현 대기 → WorkClaw |
| `bot:in-progress` | 작업 중 (락) |
| `bot:needs-review` | PR 리뷰 필요 → ReviewClaw |
| `bot:done` | 완료 |
| `bot:blocked` | 사람 개입 필요 → SemiClaw 알림 |

**전환**: `bot:needs-spec` → `bot:spec-ready` → `bot:in-progress` → `bot:needs-review` → `bot:done` / `bot:blocked`

---

## 내가 해야 하는 라벨 전환

1. **이슈 직접 생성 시**: 적절한 `bot:*` 라벨 부착 + 프로젝트 보드 등록
2. **작업 착수 시**: `bot:in-progress` 추가
3. **작업 완료 시**: 다음 단계 라벨로 전환
4. **블로커 발생 시**: `bot:blocked` 추가 + SemiClaw(<@U0ADGB42N79>) 멘션

---

## 🤖 작업 추적 (봇 서명) — 필수!

이슈 생성, 라벨 변경 등 모든 GitHub 작업 시 **코멘트로 작업 로그를 남겨라**:

```
🤖 작업 로그 (InfraClaw)
- 액션: [이슈 생성 / 라벨 변경 / 인프라 작업 등]
- 라벨 변경: [이전] → [이후]
- 사유: [간단한 사유]
```

이 로그가 없으면 라벨 감사에서 **위반으로 잡히고 재교육 대상**이 된다.

---

## OAT & 엔진 설정

- **OAT**: Claude Code OAT만 사용 (GitHub Copilot OAT 금지)
- **gh-aw 엔진**: `engine: claude` (Claude Code 엔진)

### 보안 규칙
- 실제 토큰 값은 DM으로만 공유, 채널에 절대 게시 금지
- memory 파일에 토큰 값 기록 금지

---

## 이슈 R&R (Role & Responsibility)

- **버그**: SemiClaw → WorkClaw
- **기획**: PlanClaw → WorkClaw
- **DesignClaw**: 코멘트만 (이슈 생성/라벨 변경 없음)

---

## 변경 통제 (공용 레포)

- **actions-template, semi-colon-ops, core-infra** 등 공용 레포는 봇 단독 수정 절대 금지
- Garden 승인 필수 (InfraClaw 변경 통제 규칙과 동일)

---

## ⚠️ 절대 규칙

- **이슈 생성 시 `bot:*` 라벨 + 프로젝트 보드 등록 필수**
- **기존 라벨과 공존** — `bot:*`는 워크플로우 전용

---

**출처**: SemiClaw 전파, Reus 승인 (2026-02-19)
