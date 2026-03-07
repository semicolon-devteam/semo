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

**⚠️ 핵심 원칙: 모든 봇 간 직접 Slack 멘션 인계 전면 폐기**

### 즉시 적용 규칙
1. ❌ **작업 인계 목적으로 다른 봇을 Slack 멘션하지 말 것**
2. ✅ **GitHub 이슈에 적절한 `bot:*` 라벨만 부착 → 다음 봇이 폴링으로 감지**
3. 라벨 체인: `bot:needs-spec` → `bot:spec-ready` → `bot:needs-review` → `bot:done`
4. **E2E 버그**: 이슈 생성 + `bot:spec-ready` 라벨만 (멘션 X)
5. **정보 요청**: GitHub 이슈 `bot:info-req` 라벨 경유. 답변 후 즉시 close
6. `bot:blocked`는 SemiClaw이 15분 폴링으로 감지
