# memory/github-rules.md — GitHub 운영 규칙 통합

> PlanClaw 전용 GitHub 이슈/라벨/워크플로우 규칙 통합 문서

---

## 🚨 이슈 생성 시 필수 체크리스트 (반드시 순서대로 실행)

1. **이슈 생성**: `gh issue create` (라벨 `bot:needs-spec` 또는 `bot:spec-ready` 부착)
2. **프로젝트 보드 등록** ⚠️ 필수:
   ```bash
   gh project item-add 1 --owner semicolon-devteam --url <이슈URL>
   ```
   - 프로젝트 번호: `1` (이슈관리 보드, ID: `PVT_kwDOC01-Rc4AtDz2`)
   - 누락 시 프로젝트 보드에서 이슈가 사라짐 → **절대 누락 금지**
3. **담당 봇에게 Slack 멘션 인계** (이슈 링크 포함)
4. **한 기능에 한 이슈 원칙**

---

## 이슈 등록 R&R (2026-02-17 Reus 지시 확정)

1. **버그/단순 수정 요청** → SemiClaw이 GitHub 이슈 직접 등록 → 담당 봇 인계 (이슈 링크 포함)
2. **기획이 필요한 기능 요청** → PlanClaw 기획 → 이슈 생성 → 담당 봇 인계
3. **필수 규칙**
   - 이슈 등록 없이 Slack 멘션만으로 작업 인계 ❌
   - 인계 시 반드시 GitHub 이슈 링크 포함

---

## 라벨 워크플로우

`bot:needs-spec` → `bot:spec-ready` → `bot:in-progress` → `bot:needs-review` → `bot:done` / `bot:blocked`

### 라벨 체인 즉시 알림 프로토콜 (2026-02-17 SemiClaw 지시)

폴링(10분) 단축용. 라벨 전환 시 다음 봇에 즉시 Slack 멘션.

| 상황 | 알림 대상 | 메시지 |
|------|-----------|--------|
| `bot:spec-ready` 붙인 후 | `<@U0AFECSJHK3>` | `[레포#이슈번호] 기획서 완료, 구현 부탁` |
| `bot:blocked` 붙인 후 | `<@U0ADGB42N79>` | `[레포#이슈번호] 블로커 발생: (사유)` |

채널: 해당 레포 프로젝트 채널 (해당 스레드에서 진행)

---

## GitHub Actions 설정

### OAT 정책 (2026-02-19 Reus 지시)

- GitHub Actions 워크플로우 OAT: **Claude Code OAT 사용**
- GitHub Copilot OAT 사용 금지
- 토큰 값 자체는 DM으로만 공유, 채널에 절대 게시 금지

### gh-aw 엔진

- `engine: claude`

---

## 변경 통제

- **공용 레포** (actions-template 등) 단독 수정 금지
- 모든 변경은 Garden(InfraClaw) 승인 필수

---

## 이슈 생성 R&R (누가 만드는가)

- **버그/단순 수정** → SemiClaw이 이슈 등록 → WorkClaw
- **기획 필요한 기능** → PlanClaw 기획 → 이슈 등록 → WorkClaw
- **DesignClaw** → 코멘트만 (이슈 생성 금지)

---

_Updated: 2026-02-19 (메모리 정리 — SemiClaw 지시, Reus 승인)_
