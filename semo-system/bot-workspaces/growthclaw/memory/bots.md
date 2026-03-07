# memory/bots.md — 봇 아키텍처

## 📢 봇 운영 원칙

### 보고 원칙 (Reus 지시, 2026-02-23)
- ❌ **금지**: 작업 로그 하나하나 찍기
  - "1. logger.ts 수정", "2. sessionManager.ts 수정" 같은 중간 과정 보고 금지
- ✅ **원칙**: 결과만 보고
  - 작업 완료 후 최종 결과 한 번에 보고
  - 예: "core-backend #123 구현 완료 → PR #456 생성"
- **예외**: 블로커 발생 시에만 즉시 보고 (작업 중단 상황)

## 봇 ID 매핑
| 봇 | Slack ID | 역할 |
|---|---|---|
| GrowthClaw (나) | U0AFALA3EF7 | SEO/마케팅/그로스 분석 |
| SemiClaw | U0ADGB42N79 | 팀 코디네이터 / 봇 오케스트레이터 |
| WorkClaw | U0AFECSJHK3 | FE+BE 코딩 구현 |
| ReusClaw | U0ADF0JUU79 | - |
| PlanClaw | U0AFNMGKURX | 기획 / GitHub Issue 생성 |
| ReviewClaw | U0AF1RK0E67 | 코드 리뷰 |
| DesignClaw | U0AFC0MK2TY | 디자인 / 퍼블리싱 |
| InfraClaw | U0AFPDMCGHX | 인프라 / DB / 서버 |

## 봇 간 인계 방식 (2026-02-20, Reus 승인, 즉시 적용)
**모든 봇 간 직접 Slack 멘션 인계 전면 폐기 → 순수 라벨+폴링 방식으로 전환**

### 필수 규칙
1. ❌ **작업 인계 목적으로 다른 봇을 Slack 멘션하지 말 것**
2. ✅ **GitHub 이슈에 적절한 `bot:*` 라벨만 부착** → 다음 봇이 폴링으로 감지
3. 라벨 체인: `bot:needs-spec` → `bot:spec-ready` → `bot:needs-review` → `bot:done`
4. 리뷰 피드백: ReviewClaw은 `request changes`만. WorkClaw이 `review:changes_requested` 폴링으로 감지
5. E2E 버그: 이슈 생성 + `bot:spec-ready` 라벨만 (멘션 X)
6. 정보 요청: GitHub 이슈 `bot:info-req` 라벨 경유. 답변 후 즉시 close
7. `bot:blocked`는 SemiClaw이 15분 폴링으로 감지

### 폴링 주기
- PlanClaw: 10분
- WorkClaw: 5분
- ReviewClaw: 5분
- SemiClaw: 15분

## 봇 간 파이프라인 (폴링 기반)
GrowthClaw (분석) → GitHub Issue 생성 + `bot:spec-ready` 라벨 → PlanClaw (폴링 감지) → WorkClaw (폴링 감지) → ReviewClaw (폴링 감지) → SemiClaw (폴링 감지)

- ❌ 직접 Slack 멘션 인계 금지
- ✅ GitHub 라벨+폴링으로만 인계
- 봇 간 통신: 멘션된 대화(스레드) 내에서 진행 — `#bot-ops` (C0AFBQ209E0)는 상태 보고/공지/일일 점검 전용

## DB/인프라 관련
- Supabase 접속 정보, env 등록, 크론잡 세팅 → InfraClaw 담당
- axoracle DB feedback 테이블 파이프라인 세팅 진행 중 (InfraClaw, 2026-02-17)
