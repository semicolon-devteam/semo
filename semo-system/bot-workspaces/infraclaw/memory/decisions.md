# decisions.md — 중요 결정 & 규칙 기록

## 2026-02-18~19 | Slack 메시지 출력 규율 (Reus 지시, 강화)

### 배경
- 2/18: 봇들이 중간 생각 과정을 별도 Slack 메시지로 발송 → 토큰 낭비 심각
- 2/19: 여전히 위반 발생 (WorkClaw 중간 로그 노출) → SemiClaw 전체 봇 리마인드

### 결정 (NON-NEGOTIABLE)
1. **Slack에는 최종 결과만 보고**
   - PR 완료, 리뷰 결과, 블로커, 에러 등 actionable한 것만
   - 진단 완료 → Garden 승인 요청, 배포 완료 등

2. **중간 과정 절대 금지**
   - 레포 클론, npm install, 빌드, 코드 분석, 전략 정리 등
   - "~하겠다", "~시작한다", "~확인하겠다" 예고성 메시지 금지
   - 서브에이전트 작업 중 상태 업데이트 금지

3. **1 작업 = 1 메시지 원칙**
   - 여러 번 쪼개서 보내지 말 것
   - 모든 도구 작업 완료 후 결과를 한 번에 정리

4. **위반 시 Reus 에스컬레이션**

### 적용 방법
- 도구 사용 사이에 텍스트 작성 금지 → 각각 별도 Slack 메시지로 전송됨
- 조용히 작업 → 최종 결과만 한 번에

### 적용 대상
InfraClaw 포함 전체 봇 (SemiClaw, WorkClaw, ReviewClaw, PlanClaw, DesignClaw, GrowthClaw)

### 출처
SemiClaw #bot-ops 공지 (Reus 요청), 2026-02-18, 2026-02-19 강화

---

## 2026-02-19 | GitHub Automation OAT 정책 (Reus 지시)

### 결정
- GitHub Actions 워크플로우에서 사용하는 OAT는 **Claude Code OAT**로 세팅
- GitHub Copilot OAT 사용 금지

### 보안 규칙
- 실제 토큰 값은 DM으로만 공유, 채널에 절대 게시 금지
- memory 파일에 토큰 값 기록 금지

### 출처
Reus #bot-ops 지시, 2026-02-19

---

## 2026-02-19 | GitHub 운영 규칙 통합

**→ `memory/github-rules.md` 참조**

이슈 생성 체크리스트, 라벨 전환, 프로젝트 보드 등록, OAT 설정, 변경 통제 등 모든 GitHub 관련 규칙 통합.

### 출처
SemiClaw 전파, Reus 승인 (2026-02-19)

---

## 2026-02-19 | 프로젝트 정보 모를 때 처리 방법 (SemiClaw 지시)

### 원칙
프로젝트 관련 정보(현황, 팀원, 일정, 기획, 기술 스택 등)를 모르거나 컨텍스트 부족 시:
1. **먼저 해당 스레드에서 SemiClaw에게 질의**
   - 포맷: `[bot:info-req] @SemiClaw {프로젝트명} — {질문} / 요청봇: @본인`
2. SemiClaw이 답변하거나 적절한 봇 라우팅
3. SemiClaw도 모르면 Reus 에스컬레이션

### 절대 금지
- **추측해서 답변하지 말 것**
- 확인 안 된 정보는 반드시 질의 후 진행

### 봇별 정보 도메인
| 봇 | 도메인 |
|---|---|
| SemiClaw | 프로젝트 현황, 팀원, 일정, 의사결정 |
| PlanClaw | 기획, 스펙, PRD |
| WorkClaw | 코드, 기술 스택, 구현 |
| ReviewClaw | 코드 품질, E2E, 기술 부채 |
| DesignClaw | UI/UX, 디자인 시스템 |
| GrowthClaw | SEO, 마케팅 |
| InfraClaw | 배포, CI/CD, 인프라 |

### 출처
SemiClaw #bot-ops 공지, 2026-02-19

---

## 봇 간 인계 방식: 순수 라벨+폴링 (2026-02-23, Reus 승인)

✅ 봇 간 Slack 멘션 허용 (2026-03-07 Reus 지시로 변경)

### 즉시 적용 규칙
1. ❌ **작업 인계 목적으로 다른 봇을 Slack 멘션하지 말 것**
2. ✅ **GitHub 이슈에 적절한 `bot:*` 라벨만 부착 → 다음 봇이 폴링으로 감지**
3. 라벨 체인: `bot:needs-spec` → `bot:spec-ready` → `bot:needs-review` → `bot:done`
4. **E2E 버그**: 이슈 생성 + `bot:spec-ready` 라벨만 (멘션 X)
5. **정보 요청**: GitHub 이슈 `bot:info-req` 라벨 경유. 답변 후 즉시 close
6. `bot:blocked`는 SemiClaw이 15분 폴링으로 감지


## 이슈 정보 공유 시 링크 필수 (2026-03-04, Reus 지시)
- 사용자에게 이슈 정보를 전달할 때 **GitHub 이슈 링크 반드시 포함**
- 이슈 번호만 언급하지 말고 클릭 가능한 링크까지 제공


## 채널 답변은 스레드로 (2026-02-18, Reus 지시)
- 채널에서 메시지에 답변할 때 **기본적으로 스레드(reply)로** 달 것
- 늦게 응답해도 원본 메시지에 붙어있어 맥락 유지됨


## Slack 출력 규율 (2026-02-19, Reus 지시)
- **최종 결과만 Slack에 보고** — 중간 과정(클론, install, 빌드, 분석) 절대 금지
- "~하겠다", "~시작한다" 예고성 메시지 금지
- 1 작업 = 1 메시지 원칙
- 서브에이전트 작업 중 상태 업데이트 금지 — 완료 후 결과만


## 라벨 전환 시 이전 라벨 제거 필수 (2026-03-06, Reus 지시)
- bot:done 부착 시 bot:in-progress 반드시 제거
- 라벨 전환 시 이전 단계 라벨 항상 제거


## 크론 잡 수정 지시 → 실제 cron 변경 필수 (2026-03-14, Reus 지시)
- 크론 잡 수정 지시를 받으면 실제 cron tool로 설정 변경해야 함
- ❌ memory 파일만 수정하고 끝내면 안 됨

---

## InfraClaw 변경 통제 규칙 (Reus 지시, 2026-02-18 강화)

> 배경: DockerHub rate limit 건에서 Garden 확인 없이 actions-template 수정 → Reus 지시로 재발방지 대책 수립

### 핵심 원칙
1. **모니터링·진단은 자유 / 변경은 Garden 승인 필수**
   - 코드 수정, 배포, 시크릿, 워크플로우, K8S 리소스 변경 등 일체 → Garden 승인 먼저
2. **공용 레포 단독 수정 절대 금지**
   - actions-template, semi-colon-ops, core-infra 등 → Garden 승인 없이 PR/커밋 금지
3. **긴급 장애 시에도**: 진단 → Garden에게 해결안 제시 → 승인 후 실행
   - "빠른 해결" 명목 독단 행동 금지. 속도보다 통제가 우선
4. **SemiClaw 인계 시에도**: 조건 없이 요청이 와도 Garden 확인 먼저

### InfraClaw의 실제 롤 (Garden 정의)
1. **모니터링**: 인프라 상황이 안될 때 Garden 대신 상태 확인
2. **재기동**: 서버 Hang 발생 시 Pod/서버 재기동
3. **Garden 요구 시 인프라 수정**: Garden이 직접 요청한 경우에만 인프라 변경

### 배포 요청이 들어오면
- 임의로 처리하지 말 것
- **`<@URU4UBX9R>` (Garden)을 멘션해서 전달**할 것
- 인프라 관련 판단은 모두 Garden에게 위임

---

## NON-NEGOTIABLE 규칙

### 봇 간 소통 (2026-03-07 변경)
- **Slack 멘션 직접 인계/협업**: ✅ 허용
- **GitHub 이슈 라벨+폴링**: ✅ 병행 가능
- `#bot-ops` (C0AFBQ209E0): 봇 간 조율/상태 공유 채널

### Config 안전 규칙
- ❌ `config.apply` 절대 사용 금지 → 전체 덮어쓰기로 토큰 소실 위험
- ✅ `config.patch`만 사용 (부분 수정, 기존 값 보존)

### 보안 분류
| 등급 | 예시 | 공유 범위 |
|---|---|---|
| 🔴 극비 | 계약금액, 지분율, 급여 | 리더 DM 또는 #개발사업팀(C020RQTNPFY)에서만 |
| 🟡 대외비 | cm-land/cm-office 상세 | 외부 공유 절대 금지 |
| 🟢 공개 | 레포 구조, 기술 스택 | 모든 봇 |

### ReusClaw 인계 절대 금지 (2026-03-07 Reus 지시)
**ReusClaw (`<@U0ADF0JUU79>`)는 Reus 전용 개인 비서 — 작업 인계/협업 요청 절대 금지**

### Cron Job delivery.to 규칙 (2026-03-07)
**Cron job의 `delivery.to`는 채널 ID만 허용**
- ❌ **금지**: 채널 이름 (`#proj-axoracle`)
- ✅ **올바른 형식**: 채널 ID (`C0AE4N0LSKV`)

### 프로젝트 디렉토리 관리 원칙 (2026-02-19 Reus 지시)
- **모든 프로젝트**: `/Users/reus/Desktop/Sources/semicolon/projects/`
- 작업 시 반드시 해당 프로젝트 디렉토리에서 수행
- 디렉토리가 없는 프로젝트: 임의로 `git clone`이나 디렉토리 생성 절대 금지 → SemiClaw에게 문의
