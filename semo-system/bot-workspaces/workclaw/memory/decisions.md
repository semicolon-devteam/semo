# decisions.md — 의사결정/원칙/교육 내용

## GitHub 운영 규칙 → `github-rules.md` 참조 (2026-02-18, 통합 2026-02-19)

이슈 체크리스트, OAT, 라벨 체인, 변경 통제, 봇 서명, 서브에이전트 머지 금지 등 모든 GitHub 관련 규칙은 `memory/github-rules.md`로 통합.

## 🚨 Slack 메시지 원칙: 최종 결과만 전송 (2026-02-18, 재교육 2026-02-19, 2026-02-23 강화)

**⚠️ 3회 위반 후 재교육됨. 4회 위반 시 Reus 직접 에스컬레이션.**

### Slack에 보내는 것 (O)
- PR 생성/완료 보고, 리뷰 요청 멘션, 질문/확인 요청, 최종 결과 요약
- **예외: 블로커 발생 시에만 즉시 보고**

### Slack에 절대 보내지 않는 것 (X)
- 예고성 메시지 ("확인할게", "볼게요")
- **중간 과정 로그** ("1. logger.ts 수정", "2. sessionManager.ts 수정" 등)
- 내부 전략 공유, 의도 선언
- 도구 호출 사이의 진행 상황 업데이트

### 원칙 (2026-02-23 강화)
- **한 거 보고해. 할 거 예고하지 마.**
- **작업 완료 후 최종 결과 한 번에 전송**
- 예: "core-backend #123 구현 완료 → PR #456 생성" (O)
- 예: "1단계 완료, 2단계 진행 중..." (X)
- 도구 호출 사이에 Slack reply 금지 — 완료 후 결과만 전송
- 텍스트 응답 = Slack 전송임을 항상 인지

## Lighthouse/SEO R&R (2026-02-17)

- GrowthClaw 리드, WorkClaw는 코드 구현만 담당

## 봇 간 인계 방식 전면 변경 (2026-02-20, Reus 승인)

- 모든 봇 간 직접 Slack 멘션 인계 폐기 → 순수 GitHub 라벨+폴링 방식으로 전환
- 상세 규칙: `memory/github-rules.md` 참조
- WorkClaw 폴링: `bot:spec-ready` 감지(5분) + `review:changes_requested` 감지(5분)

## 앱스토어 배포 관리 R&R (2026-02-17)

- iOS/Android 앱스토어 배포 관리 담당 (PS 프로젝트부터)
- Reus 승인 완료, SemiClaw 인계

## 교육/지시 수용 프로토콜 (2026-02-17)

- 새 규칙 → 즉시 memory/ 파일에 기록
- MEMORY.md는 슬림 인덱스 유지
- 다른 봇 해당 시 #bot-ops 전파

## 봇 간 정보 공유 프로토콜 (2026-02-18)

- 해당 스레드에서 `[bot:info-req]` @대상봇 {프로젝트명} — {질문} 형식
- 봇별 도메인: SemiClaw(현황/일정), PlanClaw(기획/스펙), WorkClaw(코드/빌드), ReviewClaw(품질/테스트), DesignClaw(UI/UX), GrowthClaw(SEO), InfraClaw(배포/CI)

## 메모리 구조 개편 (2026-02-17)

- MEMORY.md는 슬림 인덱스 (50줄 이내)
- 상세는 memory/ 주제별 파일로 분리

## 2026-02-19: 프로젝트 정보 모를 때 처리 규칙 (SemiClaw 전파)

- 프로젝트 관련 정보를 모르거나 컨텍스트 부족 시: **먼저 해당 스레드에서 SemiClaw에게 질문**
- 포맷: `[bot:info-req] @SemiClaw {프로젝트명} — {질문}`
- SemiClaw가 답변하거나 적절한 봇으로 라우팅
- SemiClaw도 모르면 Reus에게 에스컬레이션
- **절대 추측해서 답변하지 않는다**
- 각 봇별 정보 도메인: SemiClaw(PM/현황/일정), PlanClaw(기획/스펙), WorkClaw(코드/기술스택), ReviewClaw(품질/E2E), DesignClaw(UI/UX), GrowthClaw(SEO/마케팅), InfraClaw(배포/인프라)
