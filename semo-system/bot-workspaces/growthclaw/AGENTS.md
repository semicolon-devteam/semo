# AGENTS.md

## Every Session
1. Read `SOUL.md` — who you are
2. Read `MEMORY.md` — team context

## Memory
- Daily notes: `memory/YYYY-MM-DD.md`
- Long-term: `MEMORY.md` (슬림 인덱스 유지 — 상세 내용은 `memory/` 하위 파일)
- 상세 파일: `memory/team.md`, `memory/bots.md`, `memory/services.md`, `memory/decisions.md`
- 세션 시작 시: 관련 키워드로 `memory_search` 먼저 실행하여 과거 컨텍스트 recall

## 교육/지시 수용 프로토콜 (SemiClaw 전달, Reus 승인, 2026-02-17)
Reus(또는 리더)가 새로운 원칙/규칙/R&R/프로세스를 교육할 때:
1. 즉시 적절한 `memory/` 파일에 기록 ("알겠어"만 하고 끝내지 않기)
2. `MEMORY.md`에는 상세 넣지 않기 (슬림 인덱스 유지)
3. 다른 봇에게도 해당되면 `#bot-ops`로 전파
4. 기록 완료 후 "decisions.md에 기록했어" 등 간단히 확인
- 핵심: 한번 교육받은 내용은 파일에 남겨서 다음 세션에서 `memory_search`로 recall. 같은 설명 두 번 시키는 일 없게.

## 🏷️ GitHub `bot:*` 라벨링 프로토콜 (필수!)

모든 GitHub 이슈 작업에서 `bot:*` 라벨을 반드시 관리해야 한다. 라벨 없이 작업하면 파이프라인이 끊긴다.

### 라벨 종류
| 라벨 | 의미 |
|---|---|
| `bot:needs-spec` | 기획서 필요 → PlanClaw |
| `bot:spec-ready` | 기획 완료, 구현 대기 → WorkClaw |
| `bot:in-progress` | 작업 중 (락) |
| `bot:needs-review` | PR 리뷰 필요 → ReviewClaw |
| `bot:done` | 완료 |
| `bot:blocked` | 사람 개입 필요 → SemiClaw 알림 |

### 내가 해야 하는 라벨 전환
1. **이슈 직접 생성 시**: 적절한 `bot:*` 라벨 부착
2. **작업 착수 시**: `bot:in-progress` 추가
3. **작업 완료 시**: 다음 단계 라벨로 전환
4. **블로커 발생 시**: `bot:blocked` 추가 + SemiClaw(<@U0ADGB42N79>) 멘션

### 라벨 전환 후 Slack 멘션 (즉시 알림)
- 다음 담당 봇에게 해당 스레드에서 멘션

### 명령어 예시
```bash
gh issue edit <number> --repo semicolon-devteam/<repo> --add-label "bot:spec-ready"
gh issue edit <number> --repo semicolon-devteam/<repo> --remove-label "bot:in-progress"
```

### 🤖 작업 추적 (봇 서명) — 필수!
이슈 생성, 라벨 변경 등 모든 GitHub 작업 시 **코멘트로 작업 로그를 남겨라**:

```
🤖 작업 로그 (GrowthClaw)
- 액션: [이슈 생성 / 라벨 변경 / SEO 작업 등]
- 라벨 변경: [이전] → [이후]
- 사유: [간단한 사유]
```

이 로그가 없으면 라벨 감사에서 **위반으로 잡히고 재교육 대상**이 된다.

### ⚠️ 절대 규칙
- **이슈 생성 시 `bot:*` 라벨 필수** — 라벨 없는 이슈 생성 금지
- **기존 라벨과 공존** — `bot:*`는 워크플로우 전용

## Safety
- Don't exfiltrate private data
- `trash` > `rm`
- When in doubt, ask


## 🔍 프로젝트 정보 모를 때 (필수!)
- **프로젝트 관련 정보를 모르거나 컨텍스트가 부족하면 → 추측하지 말고 해당 스레드에서 SemiClaw(<@U0ADGB42N79>)한테 먼저 물어봐**
- 포맷: `[bot:info-req] @SemiClaw {프로젝트명} — {질문}`
- SemiClaw이 답변하거나 적절한 봇을 라우팅해줌
- 봇별 정보 도메인:
  - SemiClaw(PM): 프로젝트 현황, 팀원, 일정, 의사결정
  - PlanClaw: 기획, 스펙, PRD
  - WorkClaw: 코드, 기술 스택, 구현
  - ReviewClaw: 코드 품질, E2E, 기술 부채
  - DesignClaw: UI/UX, 디자인 시스템
  - GrowthClaw: SEO, 마케팅
  - InfraClaw: 배포, CI/CD, 인프라
