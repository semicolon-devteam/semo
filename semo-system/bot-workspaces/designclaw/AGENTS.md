# AGENTS.md

## Every Session
1. Read `SOUL.md` — who you are
2. Read `MEMORY.md` — team context

## 🎨 디자인 워크플로우 (필수! 2026-03-01)

**모든 디자인 작업은 인터랙티브 프리뷰 먼저!**

1. **디자인 요청 접수** (from PlanClaw, SemiClaw, etc.)
2. **HTML 프로토타입 작성** (TailwindCSS, 실제 동작하는 코드)
3. **인터랙티브 프리뷰 공유 (웹 URL 필수!)**:
   
   **반드시 웹을 통해 공유해야 함** — Reus와 물리적으로 다른 PC에 있음!
   
   **우선순위 순서**:
   1. **CodePen/JSFiddle/CodeSandbox 업로드** → 웹 URL 공유
   2. `browser` tool로 Playwright 브라우저에서 직접 확인 후 스크린샷
   3. Canvas 렌더링 (`canvas` tool)
   
   **❌ 절대 금지**: 로컬 파일 경로 공유 (`file://...` 또는 workspace 경로) — Reus가 볼 수 없음!

4. **본인이 먼저 확인**:
   - Playwright로 직접 렌더링해서 UI 제대로 나오는지 검증
   - 문제 있으면 수정 후 다시 공유
   
5. **Reus 리뷰 & 피드백 반영**

6. **최종 승인 받으면 → 그때 구현 이슈 생성**

**❌ 절대 금지**:
- 로컬 파일 경로만 공유하고 끝
- 마크다운 문서만 작성하고 바로 구현 이슈 생성
- 승인 없이 다음 단계 진행
- 본인이 확인 안 하고 공유

**참고**: 과거 `point-exchanger-mockup.html` 방식 (CodePen 업로드)

**승인 전까지는 절대 WorkClaw 인계하지 말 것!**

## Memory
- Daily notes: `memory/YYYY-MM-DD.md`
- Long-term: `MEMORY.md` (슬림 인덱스 유지 — 상세는 `memory/` 하위 파일로)
- 세션 시작 시 관련 키워드로 `memory_search` 먼저 실행 → 과거 컨텍스트 recall

## 교육/지시 수용 프로토콜
Reus(또는 리더)가 새로운 원칙/규칙/R&R/프로세스를 교육할 때:
1. 즉시 적절한 `memory/` 파일에 기록 ("알겠어"만 하고 끝내지 않기)
2. `MEMORY.md`에는 상세 넣지 않기 (슬림 인덱스 유지)
3. 다른 봇에게도 해당되면 `#bot-ops`로 전파
4. 기록 완료 후 "decisions.md에 기록했어" 등 간단히 확인
→ 한번 교육받은 내용은 파일에 남겨 다음 세션에서 `memory_search`로 recall — 같은 설명 두 번 시키지 않기

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
1. **이슈 직접 생성 시**: 적절한 `bot:*` 라벨 부착 (디자인 스펙이면 `bot:spec-ready`, 기획 필요하면 `bot:needs-spec`)
2. **작업 착수 시**: `bot:in-progress` 추가
3. **작업 완료 시**: 다음 단계 라벨로 전환 (예: `bot:spec-ready` 추가 + `bot:in-progress` 제거)
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
🤖 작업 로그 (DesignClaw)
- 액션: [이슈 생성 / 라벨 변경 / 디자인 스펙 작성 등]
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
